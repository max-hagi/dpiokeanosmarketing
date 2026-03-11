import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Mail, AlertTriangle, Phone, Eye, ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, isToday, isThisWeek, differenceInHours } from "date-fns";

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  escalate: { label: "ESCALATE", color: "text-destructive", bg: "bg-destructive/10" },
  call_today: { label: "CALL TODAY", color: "text-warning", bg: "bg-warning/10" },
  review: { label: "REVIEW", color: "text-primary", bg: "bg-primary/10" },
  info: { label: "INFO", color: "text-muted-foreground", bg: "bg-muted" },
};

const pipelineStages = [
  { key: "conversations", label: "Conversations" },
  { key: "scored", label: "Scored" },
  { key: "qualified", label: "Qualified" },
  { key: "in_crm", label: "In CRM" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
];

export default function Overview() {
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

  // Stats
  const newLeadsToday = leads?.filter(l => isToday(new Date(l.created_at))).length ?? 0;
  const qualifiedThisWeek = leads?.filter(l => (l.qualification_score ?? 0) >= 50 && isThisWeek(new Date(l.updated_at))).length ?? 0;
  const followUpsSentToday = followUpMessages?.filter(m => m.sent_at && isToday(new Date(m.sent_at))).length ?? 0;

  // Action items
  const actionItems: Array<{ priority: string; name: string; action: string; time: string; leadId: string }> = [];

  // Escalate: score >= 80
  crmRecords?.filter(r => (r.qualification_score ?? 0) >= 80 && r.is_won === null).forEach(r => {
    actionItems.push({ priority: "escalate", name: r.full_name, action: "High-score lead — prioritize outreach", time: format(new Date(r.created_at), "MMM d"), leadId: r.lead_id });
  });

  // Call today: qualified, no contact in 24h
  crmRecords?.filter(r => r.routing_decision === "QUALIFIED" && r.is_won === null && differenceInHours(new Date(), new Date(r.last_interaction_date || r.created_at)) > 24).forEach(r => {
    const hrs = differenceInHours(new Date(), new Date(r.last_interaction_date || r.created_at));
    actionItems.push({ priority: "call_today", name: r.full_name, action: "No contact made yet", time: `${hrs}h ago`, leadId: r.lead_id });
  });

  // Review: lead responded to follow-up
  followUpMessages?.filter(m => m.responded_at && m.status !== "responded").forEach(m => {
    const lead = leads?.find(l => l.id === m.lead_id);
    if (lead) actionItems.push({ priority: "review", name: lead.full_name, action: "Responded to follow-up — sequence paused", time: format(new Date(m.responded_at!), "MMM d"), leadId: lead.id });
  });

  const needsAttention = actionItems.length;

  // Pipeline funnel counts
  const conversationCount = leads?.filter(l => l.conversation_status === "complete" || l.conversation_status === "in_progress").length ?? 0;
  const scoredCount = leads?.filter(l => l.qualification_data).length ?? 0;
  const qualifiedCount = leads?.filter(l => (l.qualification_score ?? 0) >= 50).length ?? 0;
  const inCrmCount = crmRecords?.filter(r => r.is_won === null).length ?? 0;
  const quotedCount = leads?.filter(l => l.lead_stage === "quoted").length ?? 0;
  const wonCount = crmRecords?.filter(r => r.is_won === true).length ?? 0;
  const funnelCounts = [conversationCount, scoredCount, qualifiedCount, inCrmCount, quotedCount, wonCount];

  const emailsSentThisWeek = followUpMessages?.filter(m => m.sent_at && isThisWeek(new Date(m.sent_at))).length ?? 0;

  const statCards = [
    { label: "New Leads Today", value: newLeadsToday, icon: Users, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary" },
    { label: "Qualified This Week", value: qualifiedThisWeek, icon: UserCheck, gradient: "from-success/10 to-success/5", iconColor: "text-success" },
    { label: "Follow-Ups Sent Today", value: followUpsSentToday, icon: Mail, gradient: "from-accent/10 to-accent/5", iconColor: "text-accent" },
    { label: "Needs Attention", value: needsAttention, icon: AlertTriangle, gradient: needsAttention > 0 ? "from-destructive/10 to-destructive/5" : "from-muted to-muted", iconColor: needsAttention > 0 ? "text-destructive" : "text-muted-foreground", badge: needsAttention > 0 },
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
          <div key={s.label} className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${s.gradient} hover:shadow-md transition-shadow duration-300`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <div className={`h-9 w-9 rounded-xl bg-card flex items-center justify-center shadow-sm ${s.iconColor} relative`}>
                <s.icon className="h-4 w-4" />
                {s.badge && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {s.value}
                  </span>
                )}
              </div>
            </div>
            <p className="font-heading text-3xl font-bold mt-3 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Action Items */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Today's Action Items</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="divide-y divide-border min-w-[600px]">
            {actionItems.slice(0, 10).map((item, i) => {
              const p = priorityConfig[item.priority];
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${p.bg} ${p.color}`}>
                    {p.label}
                  </span>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.action}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">{item.time}</span>
                  <Link to={`/pipeline/lead/${item.leadId}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      <ArrowRight className="h-3.5 w-3.5" /> View
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-muted-foreground">✅ You're all caught up. The system is handling the rest.</p>
          </div>
        )}
      </div>

      {/* Pipeline at a Glance */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Pipeline at a Glance</h2>
        <div className="flex items-center gap-1">
          {pipelineStages.map((stage, i) => {
            const count = funnelCounts[i];
            const maxCount = Math.max(...funnelCounts, 1);
            const width = Math.max(60, (count / maxCount) * 100);
            return (
              <div key={stage.key} className="flex-1 text-center">
                <div
                  className="mx-auto rounded-lg bg-primary/10 flex items-center justify-center transition-all"
                  style={{ height: `${Math.max(40, width)}px` }}
                >
                  <span className="font-heading text-lg font-bold text-primary">{count}</span>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider">{stage.label}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {emailsSentThisWeek} follow-up emails sent this week (automated)
        </p>
      </div>
    </div>
  );
}
