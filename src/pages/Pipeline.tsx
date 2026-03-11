import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search, Download, Users, Mail, Phone, MapPin, DollarSign, Clock,
  Sparkles, Target, Loader2, RotateCw, Eye, ArrowRight,
  ShieldCheck, UserCheck, MessageSquare, Archive, ArchiveRestore, Trash2, X
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import LeadStageBadge from "@/components/LeadStageBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const budgetLabels: Record<string, string> = {
  under_30k: "<$30K", "30k_50k": "$30-50K", "50k_80k": "$50-80K", "80k_plus": "$80K+",
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

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return <span className={`text-sm font-bold ${color}`}>{score}/100</span>;
}

function ConversationStatusPill({ lead, hasCrm }: { lead: any; hasCrm?: boolean }) {
  if (hasCrm) return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-success/10 text-success">In CRM</span>;
  if (lead.qualification_data && lead.routing_action) return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-primary/10 text-primary">Routed</span>;
  if (lead.qualification_data) return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-accent/10 text-accent">Scored</span>;
  if (lead.conversation_status === "extracting") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning"><Loader2 className="h-3 w-3 animate-spin" />Extracting...</span>;
  if (lead.conversation_status === "complete") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning"><Loader2 className="h-3 w-3 animate-spin" />Processing...</span>;
  if (lead.conversation_status === "in_progress") return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning">Chatting</span>;
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-muted text-muted-foreground">New</span>;
}

const tabs = [
  { key: "leads", label: "Leads" },
  { key: "archived", label: "Archived" },
];

export default function Pipeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "leads";
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const queryClient = useQueryClient();

  const setTab = (tab: string) => setSearchParams({ tab });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000, // Auto-refresh to catch pipeline updates
  });

  const { data: crmRecords } = useQuery({
    queryKey: ["crm-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*");
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
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

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      // Delete related records first
      await supabase.from("follow_up_messages").delete().eq("lead_id", leadId);
      await supabase.from("follow_up_sequences").delete().eq("lead_id", leadId);
      await supabase.from("conversation_messages").delete().eq("lead_id", leadId);
      await supabase.from("crm_records").delete().eq("lead_id", leadId);
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["crm-records-all"] });
      toast.success("Lead permanently deleted");
      setSelectedLeadId(null);
    },
    onError: () => toast.error("Failed to delete lead"),
  });

  const activeLeads = leads?.filter(l => !(l as any).is_archived) || [];
  const archivedLeads = leads?.filter(l => (l as any).is_archived) || [];

  const filter = (list: any[]) => list.filter(l =>
    l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

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

  // Helper to get nurture info for a lead
  const getNurtureInfo = (leadId: string) => {
    const seq = sequences?.find((s: any) => s.lead_id === leadId);
    const msgs = followUpMessages?.filter(m => m.lead_id === leadId) || [];
    const lastSent = msgs.filter(m => m.sent_at).sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())[0];
    const hasResponded = msgs.some(m => m.responded_at);
    return { seq, msgs, lastSent, hasResponded };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1">Unified lead profiles</p>
        </div>
        <div className="flex gap-2">
          <Link to="/chat"><Button className="gap-2 shadow-md text-sm"><MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">New Conversation</span><span className="sm:hidden">New</span></Button></Link>
          <Button variant="outline" onClick={exportCSV} size="sm" className="gap-2"><Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span></Button>
        </div>
      </div>

      {/* Tabs */}
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
              {t.key === "leads" && activeLeads.length > 0 && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{activeLeads.length}</span>
              )}
              {t.key === "archived" && archivedLeads.length > 0 && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedLeads.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>

      {/* TAB: Leads (unified) */}
      {activeTab === "leads" && (
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filter(activeLeads).length > 0 ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Date", "Score", "Routing", "Nurture", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filter(activeLeads).map(lead => {
                  const nurture = getNurtureInfo(lead.id);
                  const nurtureLabel = nurture.seq
                    ? nurture.hasResponded ? "Replied" : `Seq ${(nurture.seq as any).sequence_type}`
                    : (lead.qualification_score != null && lead.qualification_score < 50) ? "Pending" : "—";
                  const nurtureColor = nurture.hasResponded
                    ? "text-primary"
                    : nurture.seq ? "text-warning" : "text-muted-foreground";

                  return (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setSelectedLeadId(lead.id); setShowTranscript(false); }}>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium">{lead.full_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{format(new Date(lead.created_at), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3"><ScorePill score={lead.qualification_score} /></td>
                      <td className="px-5 py-3">
                        {lead.routing_action ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            lead.routing_action === "QUALIFIED" ? "bg-success/10 text-success" :
                            lead.routing_action === "DIRECT BOOKING" ? "bg-accent/10 text-accent" :
                            "bg-warning/10 text-warning"
                          }`}>{lead.routing_action}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${nurtureColor}`}>{nurtureLabel}</span>
                      </td>
                      <td className="px-5 py-3"><ConversationStatusPill lead={lead} hasCrm={!!crmRecords?.find(r => r.lead_id === lead.id)} /></td>
                      <td className="px-5 py-3"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
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
            <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
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
                    <td className="px-5 py-3"><ScorePill score={lead.qualification_score} /></td>
                    <td className="px-5 py-3"><LeadStageBadge stage={lead.lead_stage} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => archiveMutation.mutate({ leadId: lead.id, archive: false })} disabled={archiveMutation.isPending}>
                          <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently delete this lead?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {lead.full_name} and all associated data (conversations, scores, CRM records, follow-ups). This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteLeadMutation.mutate(lead.id)}>
                                Delete Forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="p-16 text-center">
              <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No archived leads</p>
            </div>
          )}
        </div>
      )}

      {/* Unified Lead Profile Panel */}
      <Sheet open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setShowTranscript(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="font-heading text-xl">{selectedLead.full_name}</SheetTitle>
                <div className="flex items-center gap-2 pt-1">
                  <ConversationStatusPill lead={selectedLead} hasCrm={!!selectedCrm} />
                  <LeadStageBadge stage={selectedLead.lead_stage} />
                </div>
              </SheetHeader>

              <div className="space-y-5">
                {/* Contact */}
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

                {/* Conversation Transcript (always accessible) */}
                <section className="space-y-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs w-full" onClick={() => setShowTranscript(!showTranscript)}>
                    <Eye className="h-3.5 w-3.5" /> {showTranscript ? "Hide" : "View"} Conversation ({selectedMessages?.length || 0} messages)
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
                  {showTranscript && (!selectedMessages || selectedMessages.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-3">No conversation messages found for this lead.</p>
                  )}
                </section>

                {/* Score Breakdown */}
                {selectedLead.qualification_data && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h3>
                      <ScorePill score={selectedLead.qualification_score} />
                    </div>
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
                    {/* Weak areas — nurture recommendations */}
                    {(() => {
                      const qData = selectedLead.qualification_data as any;
                      const weakAreas = Object.entries(categoryConfig)
                        .filter(([key, cfg]) => (qData?.scores?.[key]?.score ?? 0) < cfg.threshold)
                        .map(([key, cfg]) => ({ key, ...cfg, score: qData?.scores?.[key]?.score ?? 0, reason: qData?.scores?.[key]?.reason || "" }));
                      if (weakAreas.length === 0) return null;
                      return (
                        <div className="mt-3 bg-warning/5 border border-warning/20 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-warning">Areas to Improve</p>
                          {weakAreas.map(area => (
                            <div key={area.key} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{area.label}</span> ({area.score}/{area.max}): {area.reason || `Score below threshold of ${area.threshold}`}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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

                {/* Sales Briefing */}
                {selectedCrm?.sales_briefing && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Briefing</h3>
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-3">{selectedCrm.sales_briefing}</pre>
                  </section>
                )}

                {/* Nurture / Follow-up Section */}
                {(() => {
                  const { seq, msgs, hasResponded } = getNurtureInfo(selectedLead.id);
                  if (!seq && msgs.length === 0) return null;
                  return (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Follow-up Sequence {seq ? `— Type ${(seq as any).sequence_type}` : ""}
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
                      {hasResponded && (
                        <Button size="sm" variant="outline" className="text-xs mt-1">Respond to Reply</Button>
                      )}
                    </section>
                  );
                })()}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {!selectedLead.qualification_data && (
                    <Button size="sm" className="gap-1" onClick={() => qualifyMutation.mutate(selectedLead.id)} disabled={qualifyMutation.isPending}>
                      {qualifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                      Score Lead
                    </Button>
                  )}
                  {selectedLead.qualification_data && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => qualifyMutation.mutate(selectedLead.id)} disabled={qualifyMutation.isPending}>
                        <RotateCw className={`h-3.5 w-3.5 ${qualifyMutation.isPending ? "animate-spin" : ""}`} /> Re-score
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
                    {(selectedLead as any).is_archived
                      ? <><ArchiveRestore className="h-3.5 w-3.5" /> Restore</>
                      : <><Archive className="h-3.5 w-3.5" /> Archive</>
                    }
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
