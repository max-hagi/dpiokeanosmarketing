import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Download, Users, User, Mail, Phone, MapPin, DollarSign, Clock,
  Sparkles, Target, AlertTriangle, Loader2, RotateCw, Eye, ArrowRight,
  ShieldCheck, UserCheck, Brain, MessageSquare, Archive, ArchiveRestore
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LeadStageBadge from "@/components/LeadStageBadge";

const budgetLabels: Record<string, string> = {
  under_30k: "<$30K", "30k_50k": "$30-50K", "50k_80k": "$50-80K", "80k_plus": "$80K+",
};
const timelineLabels: Record<string, string> = {
  asap: "ASAP", within_3_months: "Within 3mo", "3_6_months": "3–6mo", "6_12_months": "6–12mo", "12_plus_months": "12+mo",
};
const personaLabels: Record<string, string> = {
  john_homeowner: "John Homeowner", sarah_james_patel: "Sarah & James Patel", mike_turner: "Mike Turner (DIY)",
  amanda_mark_johnson: "Amanda & Mark Johnson", jessica_daniel_wong: "Jessica & Daniel Wong",
  chris_miller: "Chris Miller (Landscaper)", ryan_thompson: "Ryan Thompson (Builder)",
};

const categoryConfig: Record<string, { icon: typeof MapPin; label: string; max: number; threshold: number }> = {
  location: { icon: MapPin, label: "Location", max: 25, threshold: 15 },
  budget: { icon: DollarSign, label: "Budget", max: 25, threshold: 15 },
  timeline: { icon: Clock, label: "Timeline", max: 20, threshold: 10 },
  project_fit: { icon: ShieldCheck, label: "Project Fit", max: 20, threshold: 12 },
  lead_quality: { icon: UserCheck, label: "Lead Quality", max: 10, threshold: 5 },
};

function ScoreBar({ score, max, threshold }: { score: number; max: number; threshold: number }) {
  const pct = (score / max) * 100;
  const color = score >= threshold ? "bg-success" : score >= threshold * 0.6 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const tabs = [
  { key: "conversations", label: "Conversations" },
  { key: "scoring", label: "Scoring" },
  { key: "nurture", label: "Nurture" },
  { key: "archived", label: "Archived" },
];

export default function Pipeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "conversations";
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  const setTab = (tab: string) => setSearchParams({ tab });

  const { data: leads, isLoading } = useQuery({
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
      const { data, error } = await supabase.from("crm_records").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: sequences } = useQuery({
    queryKey: ["follow-up-sequences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_sequences").select("*, leads(full_name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: followUpMessages } = useQuery({
    queryKey: ["follow-up-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_messages").select("*").order("message_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: conversationMessages } = useQuery({
    queryKey: ["conversation-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversation_messages").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const selectedLead = leads?.find(l => l.id === selectedLeadId);
  const selectedCrm = crmRecords?.find(r => r.lead_id === selectedLeadId);
  const selectedMessages = conversationMessages?.filter(m => m.lead_id === selectedLeadId);

  const qualifyMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke("qualify-lead", { body: { leadId } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead scored!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Scoring failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ leadId, archive }: { leadId: string; archive: boolean }) => {
      const { error } = await supabase.from("leads").update({ is_archived: archive } as any).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(vars.archive ? "Lead archived" : "Lead restored");
      setSelectedLeadId(null);
    },
    onError: () => toast.error("Failed to update lead"),
  });

  const activeLeads = leads?.filter(l => !(l as any).is_archived) || [];
  const archivedLeads = leads?.filter(l => (l as any).is_archived) || [];

  const filter = (list: any[]) => list.filter(l =>
    l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getConversationStatus = (lead: any) => {
    if (lead.conversation_status === "complete") return { label: "Complete", color: "bg-success/10 text-success" };
    if (lead.conversation_status === "in_progress") return { label: "In Progress", color: "bg-warning/10 text-warning" };
    if (lead.qualification_data) return { label: "Sent to Scoring", color: "bg-primary/10 text-primary" };
    return { label: "Incomplete", color: "bg-muted text-muted-foreground" };
  };

  const exportCSV = () => {
    if (!leads) return;
    const headers = ["Date", "Name", "Email", "Location", "Score", "Stage", "Status"];
    const rows = leads.map(l => [format(new Date(l.created_at), "yyyy-MM-dd"), `"${l.full_name}"`, l.email, l.location || "", l.qualification_score ?? "", l.lead_stage, l.lead_status]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pipeline-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Nurture leads: score < 50 with active sequences
  const nurtureLeads = leads?.filter(l => (l.qualification_score ?? 0) < 50 && l.qualification_data) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1">From conversation to qualification</p>
        </div>
        <div className="flex gap-2">
          <Link to="/chat"><Button className="gap-2 shadow-md"><MessageSquare className="h-4 w-4" /> New Conversation</Button></Link>
          <Button variant="outline" onClick={exportCSV} size="sm" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      {/* Tabs — underline style */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>

      {/* TAB: Conversations */}
      {activeTab === "conversations" && (
        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filter(activeLeads).length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Date", "Location", "Persona Match", "Prelim Score", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filter(activeLeads).map(lead => {
                  const status = getConversationStatus(lead);
                  return (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedLeadId(lead.id)}>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium">{lead.full_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{format(new Date(lead.created_at), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{lead.location || "—"}</td>
                      <td className="px-5 py-3 text-sm">{lead.persona_match ? (personaLabels[lead.persona_match] || lead.persona_match) : "—"}</td>
                      <td className="px-5 py-3">
                        {lead.qualification_score != null ? (
                          <span className={`text-sm font-bold ${lead.qualification_score >= 70 ? "text-success" : lead.qualification_score >= 50 ? "text-warning" : "text-destructive"}`}>
                            {lead.qualification_score}/100
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-5 py-3"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">No leads yet.</p>
              <Link to="/chat"><Button variant="outline" size="sm">Start First Conversation</Button></Link>
            </div>
          )}
        </div>
      )}

      {/* TAB: Archived */}
      {activeTab === "archived" && (
        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {filter(archivedLeads).length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Archived", "Score", "Stage", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filter(archivedLeads).map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{format(new Date(lead.updated_at), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3">
                      {lead.qualification_score != null ? (
                        <span className="text-sm font-bold text-muted-foreground">{lead.qualification_score}/100</span>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3"><LeadStageBadge stage={lead.lead_stage} /></td>
                    <td className="px-5 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => archiveMutation.mutate({ leadId: lead.id, archive: false })}
                        disabled={archiveMutation.isPending}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center">
              <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No archived leads</p>
            </div>
          )}
        </div>
      )}

      {/* TAB: Scoring */}
      {activeTab === "scoring" && (
        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (() => {
            const scored = filter(activeLeads.filter(l => l.qualification_data));
            return scored.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Name", "Date", "Total", "Location", "Budget", "Timeline", "Fit", "Quality", "Routing"].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scored.map(lead => {
                    const qData = lead.qualification_data as any;
                    const score = lead.qualification_score ?? 0;
                    const rowBg = score >= 70 ? "bg-success/5" : score < 50 ? "bg-muted/30" : "";
                    return (
                      <tr key={lead.id} className={`${rowBg} hover:bg-muted/50 transition-colors cursor-pointer`} onClick={() => setSelectedLeadId(lead.id)}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{lead.full_name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{format(new Date(lead.created_at), "MMM d")}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive"}`}>{score}/100</span>
                        </td>
                        {["location", "budget", "timeline", "project_fit", "lead_quality"].map(cat => {
                          const s = qData?.scores?.[cat]?.score ?? 0;
                          const cfg = categoryConfig[cat];
                          return (
                            <td key={cat} className="px-4 py-3">
                              <span className={`text-xs font-mono ${s >= cfg.threshold ? "text-success" : "text-destructive"}`}>{s}/{cfg.max}</span>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          {lead.routing_action ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              lead.routing_action === "QUALIFIED" ? "bg-success/10 text-success" :
                              lead.routing_action === "DIRECT BOOKING" ? "bg-accent/10 text-accent" :
                              "bg-warning/10 text-warning"
                            }`}>{lead.routing_action}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-16 text-center">
                <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No scored leads yet — check the Conversations tab</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: Nurture */}
      {activeTab === "nurture" && (
        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {(() => {
            const nLeads = filter(nurtureLeads);
            return nLeads.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Name", "Score", "Sequence", "Last Email", "Next Email", "Status"].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {nLeads.map(lead => {
                    const seq = sequences?.find((s: any) => s.lead_id === lead.id);
                    const msgs = followUpMessages?.filter(m => m.lead_id === lead.id) || [];
                    const lastSent = msgs.filter(m => m.sent_at).sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())[0];
                    const nextPending = msgs.filter(m => m.status === "pending" && m.scheduled_at).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0];
                    const hasResponded = msgs.some(m => m.responded_at);
                    const seqStatus = hasResponded ? "paused" : (seq?.status || "active");

                    return (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedLeadId(lead.id)}>
                        <td className="px-5 py-3 text-sm font-medium">{lead.full_name}</td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-bold text-destructive">{lead.qualification_score}/100</span>
                        </td>
                        <td className="px-5 py-3 text-sm font-mono">{seq ? `Seq ${(seq as any).sequence_type}` : "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{lastSent?.sent_at ? format(new Date(lastSent.sent_at), "MMM d") : "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{nextPending?.scheduled_at ? format(new Date(nextPending.scheduled_at), "MMM d") : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            seqStatus === "active" ? "bg-primary/10 text-primary" :
                            seqStatus === "paused" ? "bg-warning/10 text-warning" :
                            seqStatus === "completed" ? "bg-success/10 text-success" :
                            "bg-muted text-muted-foreground"
                          }`}>{seqStatus === "active" ? "🔄 Active" : seqStatus === "paused" ? "⏸️ Paused" : seqStatus === "completed" ? "✅ Re-qualified" : "🚫 Opted Out"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-16 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No nurture leads — leads scoring below 50 will appear here</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Slide-out Panel */}
      <Sheet open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setShowTranscript(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <SheetHeader className="pb-4">
              <SheetTitle className="font-heading text-xl">{selectedLead.full_name}</SheetTitle>
            </SheetHeader>
          )}
          {selectedLead && (
            <div className="space-y-5">
              {/* Contact info */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-primary" /> {selectedLead.email}</div>
                  {selectedLead.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-primary" /> {selectedLead.phone}</div>}
                  {selectedLead.location && <div className="flex items-center gap-2 text-sm"><MapPin className="h-3.5 w-3.5 text-primary" /> {selectedLead.location}</div>}
                </div>
              </section>

              {/* Conversation Summary */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversation Summary</h3>
                <p className="text-sm leading-relaxed">{selectedLead.inquiry_summary || selectedLead.message}</p>
              </section>

              {/* Score Breakdown */}
              {selectedLead.qualification_data && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries(categoryConfig).map(([key, cfg]) => {
                      const qData = selectedLead.qualification_data as any;
                      const s = qData?.scores?.[key];
                      if (!s) return null;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <cfg.icon className={`h-3.5 w-3.5 ${s.score >= cfg.threshold ? "text-success" : "text-destructive"}`} />
                          <span className="text-xs w-20">{cfg.label}</span>
                          <ScoreBar score={s.score} max={cfg.max} threshold={cfg.threshold} />
                          <span className="text-xs font-mono w-10 text-right">{s.score}/{cfg.max}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Persona */}
              {selectedLead.persona_match && (
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span className="text-muted-foreground">Persona:</span>
                  <span className="font-medium">{personaLabels[selectedLead.persona_match] || selectedLead.persona_match}</span>
                </div>
              )}

              {/* Sales Briefing (from CRM) */}
              {selectedCrm?.sales_briefing && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Briefing</h3>
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-3">{selectedCrm.sales_briefing}</pre>
                </section>
              )}

              {/* Nurture tab: email timeline */}
              {activeTab === "nurture" && (() => {
                const msgs = followUpMessages?.filter(m => m.lead_id === selectedLeadId) || [];
                const seq = sequences?.find((s: any) => s.lead_id === selectedLeadId);
                const hasResponded = msgs.some(m => m.responded_at);
                return (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Email Timeline {seq ? `— Sequence ${(seq as any).sequence_type}` : ""}
                    </h3>
                    <div className="space-y-1.5">
                      {msgs.map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-xs">
                          {m.sent_at ? <span className="text-success">✓ Sent</span> : <span className="text-muted-foreground">Pending</span>}
                          {m.responded_at && <span className="text-primary font-bold">💬 Replied</span>}
                          <span className="text-muted-foreground flex-1 truncate">Msg {m.message_number}: {m.subject}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      {hasResponded && <Button size="sm" variant="outline" className="text-xs">Respond to Reply</Button>}
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { /* TODO */ }}>Move to Qualified</Button>
                    </div>
                  </section>
                );
              })()}

              {/* Transcript */}
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs w-full" onClick={() => setShowTranscript(!showTranscript)}>
                  <Eye className="h-3.5 w-3.5" /> {showTranscript ? "Hide" : "View"} Full Transcript
                </Button>
                {showTranscript && selectedMessages && selectedMessages.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto rounded-lg border border-border p-3">
                    {selectedMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${msg.role === "user" ? "bg-primary/10" : "bg-muted"}`}>
                          <p className="text-[9px] text-muted-foreground font-medium mb-0.5">{msg.role === "assistant" ? "Kai" : selectedLead.full_name}</p>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {!selectedLead.qualification_data && (
                  <Button size="sm" className="gap-1" onClick={() => qualifyMutation.mutate(selectedLead.id)} disabled={qualifyMutation.isPending}>
                    {qualifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                    Send to Qualification
                  </Button>
                )}
                {selectedLead.qualification_data && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => qualifyMutation.mutate(selectedLead.id)} disabled={qualifyMutation.isPending}>
                      <RotateCw className={`h-3.5 w-3.5 ${qualifyMutation.isPending ? "animate-spin" : ""}`} /> Re-run Scoring
                    </Button>
                    {(selectedLead.qualification_score ?? 0) >= 50 && (
                      <Link to={`/crm?lead=${selectedLead.id}`}>
                        <Button size="sm" className="gap-1"><ArrowRight className="h-3.5 w-3.5" /> Move to CRM</Button>
                      </Link>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => archiveMutation.mutate({ leadId: selectedLead.id, archive: !(selectedLead as any).is_archived })}
                  disabled={archiveMutation.isPending}
                >
                  {(selectedLead as any).is_archived ? (
                    <><ArchiveRestore className="h-3.5 w-3.5" /> Restore</>
                  ) : (
                    <><Archive className="h-3.5 w-3.5" /> Archive</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
