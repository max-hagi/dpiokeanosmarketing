import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, UserCheck, Phone, Mail, ArrowRight, MessageSquare,
  Eye, MoreHorizontal, Clock, Activity, ExternalLink, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  format, isToday, isThisWeek, differenceInHours, formatDistanceToNow,
  subDays
} from "date-fns";
import { getRoutingLabel, sequenceTypeLabels, getSegmentLabel } from "@/components/crm/emailUtils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

// ---------- helpers ----------
function getQualificationCutoff(): number {
  const stored = localStorage.getItem("qualification_cutoff_score");
  return stored ? parseInt(stored, 10) : 50;
}

function getSnoozedIds(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("overview_snoozed") || "{}");
  } catch { return {}; }
}
function snoozeId(id: string) {
  const s = getSnoozedIds();
  s[id] = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem("overview_snoozed", JSON.stringify(s));
}
function isSnoozed(id: string): boolean {
  const s = getSnoozedIds();
  return (s[id] ?? 0) > Date.now();
}

// ---------- types ----------
type ActionPriority = "escalate" | "call_today" | "replied" | "info";
interface ActionItem {
  priority: ActionPriority;
  leadId: string;
  name: string;
  description: string;
  time: string;
  emailSubject?: string;
}

const priorityConfig: Record<ActionPriority, { label: string; emoji: string; color: string; bg: string }> = {
  escalate: { label: "ESCALATE", emoji: "🔴", color: "text-destructive", bg: "bg-destructive/10" },
  call_today: { label: "CALL TODAY", emoji: "🟡", color: "text-warning", bg: "bg-warning/10" },
  replied: { label: "REPLIED", emoji: "🔵", color: "text-primary", bg: "bg-primary/10" },
  info: { label: "INFO", emoji: "⚪", color: "text-muted-foreground", bg: "bg-muted" },
};

const PRIORITY_ORDER: ActionPriority[] = ["escalate", "call_today", "replied", "info"];

// ---------- component ----------
export default function Overview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionItemsRef = useRef<HTMLDivElement>(null);
  const [callNoteLeadId, setCallNoteLeadId] = useState<string | null>(null);
  const [callNote, setCallNote] = useState("");
  const [replyViewLeadId, setReplyViewLeadId] = useState<string | null>(null);
  const [, setRefresh] = useState(0); // force re-render after snooze

  // ---------- queries ----------
  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: crmRecords } = useQuery({
    queryKey: ["crm-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: followUpMessages } = useQuery({
    queryKey: ["follow-up-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_messages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sequences } = useQuery({
    queryKey: ["follow-up-sequences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_sequences").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  // ---------- mutations ----------
  const markLostMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await supabase.from("crm_records").update({ is_won: false, closed_at: new Date().toISOString() }).eq("lead_id", leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records-all"] });
      toast({ title: "Lead marked as lost" });
    },
  });

  const logContactMutation = useMutation({
    mutationFn: async ({ leadId, note }: { leadId: string; note?: string }) => {
      await supabase.from("crm_records").update({ last_interaction_date: new Date().toISOString(), notes: note || "Contact logged from Overview" }).eq("lead_id", leadId);
      await supabase.from("audit_log").insert({ action: "contact_logged", details: { lead_id: leadId, note: note || "Contact logged from Overview" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records-all"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs-recent"] });
      toast({ title: "Contact logged" });
      setCallNoteLeadId(null);
      setCallNote("");
    },
  });

  // ---------- stats ----------
  const cutoff = getQualificationCutoff();

  // Card 1: New leads today (completed conversation today)
  const newLeadsToday = leads?.filter(l =>
    (l.conversation_status === "complete") && isToday(new Date(l.created_at))
  ).length ?? 0;

  // Card 2: Qualified this week
  const qualifiedThisWeek = leads?.filter(l => {
    const label = getRoutingLabel(l.routing_action);
    return label === "QUALIFIED" && isThisWeek(new Date(l.created_at));
  }).length ?? 0;

  // Card 3: Calls to make today
  const callsToMake = crmRecords?.filter(r => {
    const label = getRoutingLabel(r.routing_decision);
    return (label === "QUALIFIED" || label === "DIRECT BOOKING") && r.is_won === null &&
      differenceInHours(new Date(), new Date(r.last_interaction_date || r.created_at)) > 24;
  }).length ?? 0;

  // Card 4: Nurture emails this week
  const weekAgo = subDays(new Date(), 7);
  const nurtureEmailsThisWeek = followUpMessages?.filter(m =>
    m.sent_at && new Date(m.sent_at) >= weekAgo
  ).length ?? 0;

  // ---------- action items (deduplicated) ----------
  const actionMap = new Map<string, ActionItem>();

  // Escalate: score >= 80
  crmRecords?.filter(r => (r.qualification_score ?? 0) >= 80 && r.is_won === null && !isSnoozed(r.lead_id)).forEach(r => {
    const lead = leads?.find(l => l.id === r.lead_id);
    const city = lead?.location || "Unknown location";
    const budget = lead?.budget?.replace(/_/g, " ") || "Budget unknown";
    actionMap.set(r.lead_id, {
      priority: "escalate",
      leadId: r.lead_id,
      name: r.full_name,
      description: `Scored ${r.qualification_score}/100 · ${city} · ${budget} · No contact made — call today`,
      time: format(new Date(r.created_at), "MMM d"),
    });
  });

  // Call today: qualified, no contact 24h
  crmRecords?.filter(r => {
    const label = getRoutingLabel(r.routing_decision);
    return (label === "QUALIFIED" || label === "DIRECT BOOKING") && r.is_won === null &&
      differenceInHours(new Date(), new Date(r.last_interaction_date || r.created_at)) > 24 &&
      !isSnoozed(r.lead_id);
  }).forEach(r => {
    if (actionMap.has(r.lead_id)) return; // already escalated
    const daysAgo = Math.floor(differenceInHours(new Date(), new Date(r.created_at)) / 24);
    actionMap.set(r.lead_id, {
      priority: "call_today",
      leadId: r.lead_id,
      name: r.full_name,
      description: `Qualified ${daysAgo} days ago · No call logged yet`,
      time: `${differenceInHours(new Date(), new Date(r.last_interaction_date || r.created_at))}h ago`,
    });
  });

  // Replied: lead responded to follow-up
  followUpMessages?.filter(m => m.responded_at && !isSnoozed(m.lead_id)).forEach(m => {
    if (actionMap.has(m.lead_id)) return;
    const lead = leads?.find(l => l.id === m.lead_id);
    if (!lead) return;
    actionMap.set(m.lead_id, {
      priority: "replied",
      leadId: lead.id,
      name: lead.full_name,
      description: `Replied to "${m.subject}" · Sequence paused · Review their message`,
      time: format(new Date(m.responded_at!), "MMM d"),
      emailSubject: m.subject,
    });
  });

  const actionItems = Array.from(actionMap.values())
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));

  // ---------- pipeline funnel ----------
  const conversationCount = leads?.filter(l => l.conversation_status === "complete" || l.conversation_status === "in_progress").length ?? 0;
  const scoredCount = leads?.filter(l => l.qualification_data).length ?? 0;
  const qualifiedInCrmCount = crmRecords?.filter(r => {
    const label = getRoutingLabel(r.routing_decision);
    return (label === "QUALIFIED" || label === "DIRECT BOOKING") && r.is_won === null;
  }).length ?? 0;
  const quotedCount = leads?.filter(l => l.lead_stage === "quoted").length ?? 0;
  const wonCount = crmRecords?.filter(r => r.is_won === true).length ?? 0;

  const funnelStages = [
    { label: "Conversations", count: conversationCount, color: "hsl(205, 78%, 72%)" },
    { label: "Scored", count: scoredCount, color: "hsl(205, 78%, 55%)" },
    { label: "Qualified / In CRM", count: qualifiedInCrmCount, color: "hsl(var(--success))" },
    { label: "Quoted", count: quotedCount, color: "hsl(var(--warning))" },
    { label: "Won", count: wonCount, color: "hsl(152, 60%, 32%)" },
  ];

  const activeSequenceCount = sequences?.filter(s => s.status === "active").length ?? 0;

  // ---------- recent activity ----------
  const recentActivity: Array<{ time: string; text: string }> = [];

  followUpMessages?.forEach(m => {
    if (m.sent_at) {
      const lead = leads?.find(l => l.id === m.lead_id);
      const seq = sequences?.find(s => s.id === m.sequence_id);
      const seqLabel = seq ? (sequenceTypeLabels[seq.sequence_type] || seq.sequence_type) : "";
      recentActivity.push({
        time: m.sent_at,
        text: `Nurture email sent to ${lead?.full_name || "Unknown"} (${seqLabel}, Email ${m.message_number})`,
      });
    }
  });

  leads?.forEach(l => {
    if (l.qualification_score != null) {
      const label = getRoutingLabel(l.routing_action);
      recentActivity.push({
        time: l.updated_at,
        text: `New lead: ${l.full_name} (scored ${l.qualification_score}/100, routed to ${label.toLowerCase()})`,
      });
    }
  });

  crmRecords?.forEach(r => {
    recentActivity.push({
      time: r.created_at,
      text: `${r.full_name} added to CRM (scored ${r.qualification_score || 0}/100)`,
    });
  });

  recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const topActivity = recentActivity.slice(0, 5);

  // Last automated action timestamp
  const lastAutoTime = recentActivity.length > 0 ? recentActivity[0].time : null;

  // Reply viewer data
  const replyMessages = replyViewLeadId
    ? followUpMessages?.filter(m => m.lead_id === replyViewLeadId && m.responded_at).sort((a, b) => new Date(b.responded_at!).getTime() - new Date(a.responded_at!).getTime())
    : [];
  const replyLead = replyViewLeadId ? leads?.find(l => l.id === replyViewLeadId) : null;

  // ---------- stat cards ----------
  const statCards = [
    {
      label: "New Leads Today",
      value: newLeadsToday,
      icon: Users,
      gradient: "from-muted to-muted",
      iconColor: "text-muted-foreground",
      onClick: () => navigate("/pipeline"),
    },
    {
      label: "Qualified This Week",
      value: qualifiedThisWeek,
      icon: UserCheck,
      gradient: "from-success/10 to-success/5",
      iconColor: "text-success",
      onClick: () => navigate("/crm"),
    },
    {
      label: "Calls to Make Today",
      value: callsToMake,
      icon: Phone,
      gradient: callsToMake > 0 ? "from-warning/10 to-warning/5" : "from-muted to-muted",
      iconColor: callsToMake > 0 ? "text-warning" : "text-muted-foreground",
      badge: callsToMake > 0,
      onClick: () => actionItemsRef.current?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      label: "Nurture Emails This Week",
      value: nurtureEmailsThisWeek,
      icon: Mail,
      gradient: "from-muted to-muted",
      iconColor: "text-muted-foreground",
      subtext: "automated — no action needed",
      onClick: () => navigate("/settings?tab=log"),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Your sales pipeline at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${s.gradient} hover:shadow-md transition-shadow duration-300 text-left w-full`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <div className={`h-9 w-9 rounded-xl bg-card flex items-center justify-center shadow-sm ${s.iconColor} relative`}>
                <s.icon className="h-4 w-4" />
                {s.badge && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-warning text-warning-foreground text-[9px] font-bold flex items-center justify-center">
                    {s.value}
                  </span>
                )}
              </div>
            </div>
            <p className="font-heading text-3xl font-bold mt-3 tracking-tight">{s.value}</p>
            {s.subtext && <p className="text-[11px] text-muted-foreground mt-1">{s.subtext}</p>}
          </button>
        ))}
      </div>

      {/* Action Items */}
      <div ref={actionItemsRef} className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Today's Action Items</h2>
        </div>
        {actionItems.length > 0 ? (
          <div className="divide-y divide-border">
            {actionItems.slice(0, 10).map((item) => {
              const p = priorityConfig[item.priority];
              return (
                <div key={item.leadId} className="flex items-center gap-3 px-6 py-3.5 group">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase shrink-0 ${p.bg} ${p.color}`}>
                    {p.emoji} {p.label}
                  </span>
                  <span className="text-sm font-medium shrink-0">{item.name}</span>
                  <span className="text-sm text-muted-foreground flex-1 truncate">{item.description}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{item.time}</span>

                  {/* Primary action */}
                  {(item.priority === "escalate" || item.priority === "call_today") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs shrink-0"
                      onClick={() => setCallNoteLeadId(item.leadId)}
                    >
                      <Phone className="h-3 w-3" /> Log Call
                    </Button>
                  )}
                  {item.priority === "replied" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs shrink-0"
                      onClick={() => setReplyViewLeadId(item.leadId)}
                    >
                      <MessageSquare className="h-3 w-3" /> View Reply
                    </Button>
                  )}

                  {/* View CRM */}
                  <Link to={`/pipeline/lead/${item.leadId}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0">
                      <ArrowRight className="h-3.5 w-3.5" /> View
                    </Button>
                  </Link>

                  {/* More menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { snoozeId(item.leadId); setRefresh(r => r + 1); toast({ title: "Snoozed for 24 hours" }); }}>
                        <Clock className="h-3.5 w-3.5 mr-2" /> Snooze 24h
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { logContactMutation.mutate({ leadId: item.leadId }); }}>
                        <Phone className="h-3.5 w-3.5 mr-2" /> Mark as Contacted
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => markLostMutation.mutate(item.leadId)}>
                        <X className="h-3.5 w-3.5 mr-2" /> Not a fit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center space-y-2">
            <p className="text-muted-foreground">✅ All caught up — the system is handling the rest.</p>
            {lastAutoTime && (
              <p className="text-xs text-muted-foreground">Last automated action: {formatDistanceToNow(new Date(lastAutoTime), { addSuffix: true })}</p>
            )}
          </div>
        )}
      </div>

      {/* Pipeline at a Glance — Visual Funnel */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Pipeline at a Glance</h2>
        <div className="flex items-end gap-2 justify-center">
          {funnelStages.map((stage, i) => {
            const maxCount = Math.max(...funnelStages.map(s => s.count), 1);
            // Funnel narrowing: max width shrinks for later stages
            const maxWidthPct = 100 - i * 12;
            const barHeight = Math.max(44, (stage.count / maxCount) * 120);
            return (
              <div key={stage.label} className="flex flex-col items-center flex-1" style={{ maxWidth: `${maxWidthPct}%` }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="w-full rounded-lg flex items-center justify-center transition-all cursor-default"
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor: stage.color,
                        opacity: 0.85,
                      }}
                    >
                      <span className="font-heading text-lg font-bold text-white drop-shadow-sm">{stage.count}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{stage.label}: {stage.count}</TooltipContent>
                </Tooltip>
                <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider text-center leading-tight">{stage.label}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {nurtureEmailsThisWeek} nurture emails sent this week · {activeSequenceCount} leads in active sequences
        </p>
      </div>

      {/* Recent Automated Activity */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">Recent Automated Activity</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">These actions happened automatically — no action needed.</p>
          </div>
          <Link to="/settings?tab=log" className="text-xs text-primary hover:underline flex items-center gap-1">
            View full log <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {topActivity.length > 0 ? (
          <div className="divide-y divide-border">
            {topActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground shrink-0 w-24">
                  {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                </span>
                <span className="text-sm truncate">{item.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No automated activity yet.</p>
          </div>
        )}
      </div>

      {/* Log Call Dialog */}
      <Dialog open={!!callNoteLeadId} onOpenChange={o => { if (!o) { setCallNoteLeadId(null); setCallNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Brief call notes (optional)..."
            value={callNote}
            onChange={e => setCallNote(e.target.value)}
            rows={3}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCallNoteLeadId(null); setCallNote(""); }}>Cancel</Button>
            <Button onClick={() => { if (callNoteLeadId) logContactMutation.mutate({ leadId: callNoteLeadId, note: callNote }); }}>
              Save & Log Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Reply Dialog */}
      <Dialog open={!!replyViewLeadId} onOpenChange={o => { if (!o) setReplyViewLeadId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Replies from {replyLead?.full_name || "Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {replyMessages && replyMessages.length > 0 ? replyMessages.map(m => (
              <div key={m.id} className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Re: {m.subject}</p>
                <p className="text-xs text-muted-foreground">Replied {formatDistanceToNow(new Date(m.responded_at!), { addSuffix: true })}</p>
                <p className="text-sm mt-1">{m.body}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No reply details available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
