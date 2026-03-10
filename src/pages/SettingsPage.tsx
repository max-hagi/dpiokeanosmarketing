import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Search, Download, Activity, Mail, Brain, Target,
  Users, AlertTriangle, CheckCircle, Settings, Sliders
} from "lucide-react";
import { format, isThisWeek } from "date-fns";
import { useSearchParams } from "react-router-dom";

const tabs = [
  { key: "log", label: "Automation Log" },
  { key: "sequences", label: "Sequence Status" },
  { key: "config", label: "Configuration" },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "log";
  const [search, setSearch] = useState("");
  const setTab = (tab: string) => setSearchParams({ tab });

  // Automation log: combination of audit_log, follow-up messages, CRM records
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

  // Build unified activity feed
  const activityFeed: Array<{ time: string; action: string; detail: string; icon: typeof Mail }> = [];

  followUpMessages?.forEach(m => {
    if (m.sent_at) {
      activityFeed.push({
        time: m.sent_at,
        action: "Email Sent",
        detail: `Msg ${m.message_number} to ${(m as any).leads?.full_name || "Unknown"}: ${m.subject}`,
        icon: Mail,
      });
    }
  });

  crmRecords?.forEach(r => {
    activityFeed.push({
      time: r.created_at,
      action: "CRM Record Created",
      detail: `${r.full_name} — ${r.routing_decision} (Score: ${r.qualification_score}/100)`,
      icon: Brain,
    });
  });

  auditLogs?.forEach(log => {
    activityFeed.push({
      time: log.created_at,
      action: log.action,
      detail: typeof log.details === "string" ? log.details : JSON.stringify(log.details || {}),
      icon: Activity,
    });
  });

  activityFeed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const filteredFeed = search
    ? activityFeed.filter(a => a.action.toLowerCase().includes(search.toLowerCase()) || a.detail.toLowerCase().includes(search.toLowerCase()))
    : activityFeed;

  // Sequence health
  const sequenceHealth = ["A", "B", "C", "D"].map(type => {
    const seqs = sequences?.filter((s: any) => s.sequence_type === type) || [];
    const activeSeqs = seqs.filter((s: any) => s.status === "active");
    const msgs = followUpMessages?.filter(m => seqs.some((s: any) => s.lead_id === m.lead_id)) || [];
    const sentThisWeek = msgs.filter(m => m.sent_at && isThisWeek(new Date(m.sent_at))).length;
    const replied = msgs.filter(m => m.responded_at).length;
    const requalified = seqs.filter((s: any) => s.status === "completed").length;
    return {
      type,
      label: type === "A" ? "Qualified" : type === "B" ? "Nurture" : type === "C" ? "Budget Recovery" : "Location Recovery",
      activeLeads: activeSeqs.length,
      sentThisWeek,
      openRate: "—",
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
            <Input placeholder="Filter by action or detail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
            {filteredFeed.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredFeed.slice(0, 100).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(item.time), "MMM d, h:mm a")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No activity recorded yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sequence Status */}
      {activeTab === "sequences" && (
        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Sequence", "Active Leads", "Emails This Week", "Open Rate", "Reply Rate", "Re-qualified", ""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sequenceHealth.map(s => (
                <tr key={s.type} className="hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">Sequence {s.type}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono">{s.activeLeads}</td>
                  <td className="px-5 py-3 text-sm font-mono">{s.sentThisWeek}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.openRate}</td>
                  <td className="px-5 py-3 text-sm">{s.replyRate}</td>
                  <td className="px-5 py-3 text-sm font-mono">{s.requalified}</td>
                  <td className="px-5 py-3">
                    {s.warning && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[9px] font-bold">
                        <AlertTriangle className="h-2.5 w-2.5" /> No emails
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Configuration */}
      {activeTab === "config" && (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Connection Status</h2>
            <div className="space-y-3">
              {[
                { label: "Email API (Outlook/Gmail)", status: "Not Connected", connected: false },
                { label: "CRM Integration (Twenty CRM)", status: "Not Connected", connected: false },
                { label: "Microsoft Bookings", status: "Not Connected", connected: false },
              ].map(c => (
                <div key={c.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className={`text-xs font-bold ${c.connected ? "text-success" : "text-muted-foreground"}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Threshold */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scoring Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Qualification Cutoff Score</p>
                <p className="text-xs text-muted-foreground">Leads scoring at or above this threshold are marked as Qualified</p>
              </div>
              <Input type="number" defaultValue={50} className="w-20 text-center" />
            </div>
          </div>

          {/* Notification Preferences */}
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

          {/* Agent Toggles */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agent Controls</h2>
            <div className="space-y-3">
              {[
                { label: "Conversation Agent (Kai)", default: true },
                { label: "Qualification Agent", default: true },
                { label: "CRM Action Agent", default: true },
                { label: "Follow-Up Agent", default: true },
                { label: "Marketing Content Agent", default: true },
              ].map(a => (
                <div key={a.label} className="flex items-center justify-between">
                  <span className="text-sm">{a.label}</span>
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
