import { useState, useEffect } from "react";
import { getQualificationCutoff, setQualificationCutoff } from "@/components/crm/emailUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Search, Download, Activity, Mail, Brain, Target,
  Users, AlertTriangle, CheckCircle, Settings, Sliders,
  MapPin, DollarSign, Clock, Wrench, UserCheck, Send,
  FileText, ArrowRight, Pause, RotateCcw, XCircle, Globe
} from "lucide-react";
import { format, isThisWeek, formatDistanceToNow } from "date-fns";
import { useSearchParams } from "react-router-dom";

const tabs = [
  { key: "log", label: "Automation Log" },
  { key: "sequences", label: "Sequence Status" },
  { key: "config", label: "Configuration" },
];

// Human-readable action labels and descriptions
const ACTION_MAP: Record<string, { label: string; description: string; icon: typeof Mail; color: string }> = {
  "follow_up_sequence_created": {
    label: "Follow-up sequence started",
    description: "Automated email sequence was created for a lead",
    icon: Send,
    color: "text-blue-500",
  },
  "crm_record_created": {
    label: "Added to CRM",
    description: "Lead was scored and a CRM record was created",
    icon: UserCheck,
    color: "text-green-500",
  },
  "lead_qualified": {
    label: "Lead qualified",
    description: "Lead scored above threshold and was marked as qualified",
    icon: CheckCircle,
    color: "text-green-500",
  },
  "lead_scored": {
    label: "Lead scored",
    description: "Qualification score was calculated",
    icon: Target,
    color: "text-amber-500",
  },
  "routing_decision": {
    label: "Routing decided",
    description: "System determined next steps for this lead",
    icon: ArrowRight,
    color: "text-primary",
  },
  "sequence_paused": {
    label: "Sequence paused",
    description: "Lead replied — automated emails paused for human follow-up",
    icon: Pause,
    color: "text-amber-500",
  },
  "sequence_completed": {
    label: "Sequence finished",
    description: "All scheduled emails in the sequence have been sent",
    icon: CheckCircle,
    color: "text-green-500",
  },
};

function humanizeAction(action: string): { label: string; icon: typeof Mail; color: string } {
  const mapped = ACTION_MAP[action];
  if (mapped) return { label: mapped.label, icon: mapped.icon, color: mapped.color };

  // Fallback: convert snake_case to readable
  const label = action
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  return { label, icon: Activity, color: "text-muted-foreground" };
}

function humanizeDetail(action: string, details: any): string {
  if (!details) return "";
  if (typeof details === "string") return details;

  const d = details as Record<string, any>;

  if (action === "follow_up_sequence_created") {
    const seqLabels: Record<string, string> = {
      A: "Qualified Outreach",
      B: "Nurture — General",
      C: "Nurture — Budget",
      D: "Nurture — Location",
    };
    const seqName = seqLabels[d.sequence_type] || `Sequence ${d.sequence_type}`;
    return `${seqName} sequence — ${d.message_count || "?"} emails scheduled`;
  }

  if (action === "crm_record_created") {
    return `Routed as ${d.routing_decision || "unknown"} with score ${d.qualification_score || "?"}/100`;
  }

  // Generic fallback: pick useful keys
  const useful = ["lead_name", "full_name", "routing_decision", "score", "qualification_score", "sequence_type"];
  const parts = useful
    .filter(k => d[k])
    .map(k => `${k.replace(/_/g, " ")}: ${d[k]}`);
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(d).slice(0, 120);
}

const SEQUENCE_INFO: Record<string, { name: string; description: string; icon: typeof Mail }> = {
  A: {
    name: "Qualified Outreach",
    description: "For leads scoring 50+. Summary email → gentle nudge → educational resource → final check-in over 14 days.",
    icon: CheckCircle,
  },
  B: {
    name: "Nurture — General",
    description: "For leads scoring below 50. Educational content and periodic check-ins over 45 days to build trust and re-score.",
    icon: RotateCcw,
  },
  C: {
    name: "Nurture — Budget",
    description: "For leads who didn't share budget or indicated below $35k. Transparent pricing breakdown sent immediately.",
    icon: DollarSign,
  },
  D: {
    name: "Nurture — Location",
    description: "For leads outside the core service area or with unconfirmed location. Quick location check sent immediately.",
    icon: MapPin,
  },
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "log";
  const [search, setSearch] = useState("");
  const setTab = (tab: string) => setSearchParams({ tab });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: followUpMessages } = useQuery({
    queryKey: ["follow-up-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_messages").select("*, leads(full_name)").order("created_at", { ascending: false });
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

  const { data: sequences } = useQuery({
    queryKey: ["follow-up-sequences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_sequences").select("*, leads(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  
  const { data: socialConnections } = useQuery({
    queryKey: ["social-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_connections")
        .select("*")
        .order("platform");
      if (error) throw error;
      return data;
    },
  });

  const socialPlatforms = [
    { platform: "instagram", label: "Instagram", desc: "Meta Graph API for posts, reels, stories" },
    { platform: "facebook", label: "Facebook", desc: "Meta Graph API for page posts and videos" },
    { platform: "tiktok", label: "TikTok", desc: "Content Posting API for video uploads" },
    { platform: "linkedin", label: "LinkedIn", desc: "Share API for posts and articles" },
    { platform: "x", label: "X / Twitter", desc: "API v2 for tweets and media" },
  ];

  const getConnectionStatus = (platform: string) => {
    const conn = socialConnections?.find((c: any) => c.platform === platform);
    if (conn?.is_active) return { status: "Connected", connected: true, since: conn.connected_at };
    return { status: "Not Connected", connected: false, since: null };
  };
  
  // Build unified activity feed with humanized labels
  const activityFeed: Array<{ time: string; label: string; detail: string; icon: typeof Mail; color: string }> = [];

  followUpMessages?.forEach(m => {
    if (m.sent_at) {
      const leadName = (m as any).leads?.full_name || "Unknown";
      activityFeed.push({
        time: m.sent_at,
        label: `Email sent to ${leadName}`,
        detail: `Message ${m.message_number}: "${m.subject}"`,
        icon: Mail,
        color: "text-blue-500",
      });
    }
  });

  crmRecords?.forEach(r => {
    const segment = r.customer_segment || "New Lead";
    activityFeed.push({
      time: r.created_at,
      label: `${r.full_name} added to CRM`,
      detail: `Scored ${r.qualification_score || 0}/100 · Routed as ${r.routing_decision || "Pending"} · Segment: ${segment}`,
      icon: UserCheck,
      color: "text-green-500",
    });
  });

  auditLogs?.forEach(log => {
    const { label, icon, color } = humanizeAction(log.action);
    activityFeed.push({
      time: log.created_at,
      label,
      detail: humanizeDetail(log.action, log.details),
      icon,
      color,
    });
  });

  activityFeed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const filteredFeed = search
    ? activityFeed.filter(a => a.label.toLowerCase().includes(search.toLowerCase()) || a.detail.toLowerCase().includes(search.toLowerCase()))
    : activityFeed;

  // Sequence health with human-readable info
  const sequenceHealth = (["A", "B", "C", "D"] as const).map(type => {
    const info = SEQUENCE_INFO[type];
    const seqs = sequences?.filter((s: any) => s.sequence_type === type) || [];
    const activeSeqs = seqs.filter((s: any) => s.status === "active");
    const pausedSeqs = seqs.filter((s: any) => s.status === "paused");
    const msgs = followUpMessages?.filter(m => seqs.some((s: any) => s.lead_id === m.lead_id)) || [];
    const sentThisWeek = msgs.filter(m => m.sent_at && isThisWeek(new Date(m.sent_at))).length;
    const replied = msgs.filter(m => m.responded_at).length;
    const requalified = seqs.filter((s: any) => s.status === "completed").length;
    return {
      type,
      name: info.name,
      description: info.description,
      Icon: info.icon,
      activeLeads: activeSeqs.length,
      pausedLeads: pausedSeqs.length,
      sentThisWeek,
      replyRate: msgs.length > 0 ? `${Math.round((replied / msgs.length) * 100)}%` : "—",
      requalified,
      warning: activeSeqs.length > 0 && sentThisWeek === 0,
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Automation, sequences, and configuration</p>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automation Log */}
      {activeTab === "log" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search activity — e.g. 'email sent', 'CRM', a lead name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
            {filteredFeed.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredFeed.slice(0, 100).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5`}>
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
                      {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">When leads are scored, emails sent, or CRM records created, they'll show up here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sequence Status */}
      {activeTab === "sequences" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">These are the automated email sequences running in the background. Each one handles a different type of lead based on their qualification score.</p>
          <div className="grid gap-4">
            {sequenceHealth.map(s => (
              <div key={s.type} className="glass-card rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <s.Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">{s.description}</p>
                    </div>
                  </div>
                  {s.warning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-[10px] font-bold shrink-0">
                      <AlertTriangle className="h-3 w-3" /> No emails sent this week
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Active leads</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{s.activeLeads}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Emails this week</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{s.sentThisWeek}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Reply rate</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{s.replyRate}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Re-qualified</p>
                    <p className="text-lg font-bold font-mono mt-0.5">{s.requalified}</p>
                    {s.pausedLeads > 0 && (
                      <p className="text-[10px] text-amber-500 mt-0.5">{s.pausedLeads} paused (replied)</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Service Connections</h2>
            <div className="space-y-3">
              {[
                { label: "Email API (Outlook/Gmail)", status: "Not Connected", connected: false },
                { label: "CRM Integration (Twenty CRM)", status: "Not Connected", connected: false },
                { label: "Microsoft Bookings", status: "Not Connected", connected: false },
              ].map(c => (
                <div key={c.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className={`text-xs font-bold ${c.connected ? "text-green-600" : "text-muted-foreground"}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social Media Connections</h2>
            <p className="text-xs text-muted-foreground">Connect your social accounts to publish content directly from the Publishing Queue. API credentials are stored securely.</p>
            <div className="space-y-3">
              {socialPlatforms.map(sp => {
                const cs = getConnectionStatus(sp.platform);
                return (
                  <div key={sp.platform} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <span className="text-sm font-medium">{sp.label}</span>
                      <p className="text-xs text-muted-foreground">{sp.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cs.connected && cs.since && (
                        <span className="text-[10px] text-muted-foreground">
                          since {format(new Date(cs.since), "MMM d")}
                        </span>
                      )}
                      <span className={`text-xs font-bold ${cs.connected ? "text-green-600" : "text-muted-foreground"}`}>
                        {cs.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Social API integrations require paid API access from each platform. Once you have API credentials, you can configure them here to enable direct posting.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scoring Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Qualification Cutoff Score</p>
                <p className="text-xs text-muted-foreground">Leads scoring at or above this threshold are marked as Qualified</p>
              </div>
              <Input
                type="number"
                defaultValue={getQualificationCutoff()}
                className="w-20 text-center"
                onBlur={e => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0 && val <= 100) setQualificationCutoff(val);
                }}
              />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notifications</h2>
            <div className="space-y-3">
              {[
                { label: "Escalation alerts (score ≥ 80)", default: true },
                { label: "Response alerts (lead replied)", default: true },
                { label: "Daily summary email", default: false },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between">
                  <span className="text-sm">{n.label}</span>
                  <Switch defaultChecked={n.default} />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agent Controls</h2>
            <div className="space-y-3">
              {[
                { label: "Conversation Agent (Kai)", desc: "Chats with incoming leads to gather project info", default: true },
                { label: "Qualification Agent", desc: "Scores leads across 5 categories (0–100)", default: true },
                { label: "CRM Action Agent", desc: "Creates CRM records and prescribes recovery actions", default: true },
                { label: "Follow-Up Agent", desc: "Generates personalized email sequences", default: true },
                { label: "Marketing Content Agent", desc: "Creates social posts, ads, and blog content", default: true },
              ].map(a => (
                <div key={a.label} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{a.label}</span>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  <Switch defaultChecked={a.default} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
