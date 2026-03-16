import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Download, Users, MapPin, DollarSign, Clock, ShieldCheck, UserCheck,
  Trophy, XCircle, Mail, Loader2,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import EmailSequenceTimeline from "@/components/crm/EmailSequenceTimeline";
import LeadStagePill from "@/components/crm/LeadStagePill";
import { getNextEmailInfo, getQualificationCutoff } from "@/components/crm/emailUtils";

const budgetLabels: Record<string, string> = {
  under_30k: "<$30K", "30k_50k": "$30-50K", "50k_80k": "$50-80K", "80k_plus": "$80K+",
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

const stageOptions = [
  { value: "inquiry", label: "Inquiry" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "sold", label: "Sold" },
  { value: "installed", label: "Installed" },
  { value: "retention", label: "Retention" },
];

function getAutoStage(score: number | null): string {
  if (score === null || score === undefined) return "inquiry";
  const cutoff = getQualificationCutoff();
  return score >= cutoff ? "qualified" : "inquiry";
}

export default function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "active";
  const [search, setSearch] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const setTab = (tab: string) => setSearchParams({ tab });

  const { data: crmRecords, isLoading } = useQuery({
    queryKey: ["crm-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
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

  const { data: followUpSequences } = useQuery({
    queryKey: ["follow-up-sequences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("follow_up_sequences").select("*");
      if (error) throw error;
      return data;
    },
  });

  const selectedRecord = crmRecords?.find(r => r.id === selectedRecordId);
  const selectedLead = leads?.find(l => l.id === selectedRecord?.lead_id);

  const updateCrmMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("crm_records").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records-all"] });
      toast.success("Updated!");
    },
  });

  const closeLeadMutation = useMutation({
    mutationFn: async ({ id, leadId, won }: { id: string; leadId: string; won: boolean }) => {
      await supabase.from("crm_records").update({ is_won: won, closed_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("leads").update({ lead_stage: won ? "sold" : "inquiry" } as any).eq("id", leadId);
    },
    onSuccess: (_, { won }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-records-all"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(won ? "Marked as Won!" : "Marked as Lost.");
      setSelectedRecordId(null);
    },
  });

  const triggerFollowUpMutation = useMutation({
    mutationFn: async ({ leadId, crmRecordId }: { leadId: string; crmRecordId: string }) => {
      const { data, error } = await supabase.functions.invoke("follow-up-agent", {
        body: { leadId, sequenceType: "A", crmRecordId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-messages"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-sequences"] });
      toast.success("Follow-up email generated!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const activeRecords = crmRecords?.filter(r => r.is_won === null) || [];
  const closedRecords = crmRecords?.filter(r => r.is_won !== null) || [];

  const filterRecords = (list: typeof activeRecords) => list.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.email_address.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const records = activeTab === "active" ? activeRecords : closedRecords;
    if (!records.length) return;
    const headers = ["Name", "Email", "Score", "Segment", "Routing", "Stage", "Sales Rep"];
    const rows = records.map(r => [`"${r.full_name}"`, r.email_address, r.qualification_score ?? "", r.customer_segment || "", r.routing_decision || "", r.lead_stage, r.sales_rep || ""]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `crm-${activeTab}-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Get next email info for a lead
  function getLeadNextEmail(leadId: string) {
    const seq = followUpSequences?.find(s => s.lead_id === leadId);
    const msgs = followUpMessages?.filter(m => m.lead_id === leadId) || [];
    return getNextEmailInfo(msgs, seq?.status);
  }

  // Get effective stage (auto from score or manual override)
  function getEffectiveStage(record: typeof activeRecords[0]) {
    // If user manually set to a non-auto stage, respect it
    const autoStage = getAutoStage(record.qualification_score);
    const current = record.lead_stage?.toLowerCase();
    if (current && current !== "inquiry" && current !== "qualified") return current;
    return autoStage;
  }

  const tabs = [
    { key: "active", label: "Active Leads" },
    { key: "closed", label: "Won / Closed" },
  ];

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">CRM</h1>
            <p className="text-muted-foreground mt-1">Qualified leads — your sales workspace</p>
          </div>
          <Button variant="outline" onClick={exportCSV} size="sm" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>

        {/* Tabs */}
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
                <span className="ml-2 text-xs text-muted-foreground">
                  ({t.key === "active" ? activeRecords.length : closedRecords.length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>

        {/* Active Leads — Card Grid */}
        {activeTab === "active" && (
          <div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filterRecords(activeRecords).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterRecords(activeRecords).map(r => {
                  const lead = leads?.find(l => l.id === r.lead_id);
                  const score = r.qualification_score ?? 0;
                  const noContact = r.last_interaction_date && (new Date().getTime() - new Date(r.last_interaction_date).getTime()) > 24 * 60 * 60 * 1000;
                  const nextEmail = getLeadNextEmail(r.lead_id);
                  const effectiveStage = getEffectiveStage(r);

                  return (
                    <div
                      key={r.id}
                      className="glass-card rounded-2xl p-5 space-y-3 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => setSelectedRecordId(r.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{r.full_name}</p>
                          <p className="text-xs text-muted-foreground">{r.mailing_address || lead?.location || "—"}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          score >= 70 ? "bg-success/10 text-success" : score >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        }`}>{score}/100</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {lead?.budget && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{budgetLabels[lead.budget] || lead.budget}</span>}
                        {lead?.timeline && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{lead.timeline.replace(/_/g, " ")}</span>}
                        <span>Last: {r.last_interaction_date ? format(new Date(r.last_interaction_date), "MMM d") : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <LeadStagePill stage={effectiveStage} />
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Next Email column */}
                          <span className={`text-[10px] font-medium ${
                            nextEmail === "Paused" ? "text-warning" :
                            nextEmail === "Sequence complete" ? "text-muted-foreground" :
                            "text-primary"
                          }`}>
                            <Mail className="h-3 w-3 inline mr-0.5" />
                            {nextEmail}
                          </span>
                          {r.sales_rep && <span className="text-[10px] text-muted-foreground">{r.sales_rep}</span>}
                          {noContact && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[9px] font-bold">
                              <AlertTriangle className="h-2.5 w-2.5" /> CALL TODAY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-16 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No qualified leads yet — check the Scoring tab in Pipeline</p>
              </div>
            )}
          </div>
        )}

        {/* Won / Closed */}
        {activeTab === "closed" && (
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
            {filterRecords(closedRecords).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Name", "Outcome", "Score", "Revenue", "Close Date", "Sales Rep", "Notes"].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-5 py-3 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filterRecords(closedRecords).map(r => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3 text-sm font-medium">{r.full_name}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold ${r.is_won ? "text-success" : "text-destructive"}`}>{r.is_won ? "WON" : "LOST"}</span>
                        </td>
                        <td className="px-5 py-3 text-sm font-mono">{r.qualification_score}/100</td>
                        <td className="px-5 py-3 text-sm">{r.quote_value ? `$${r.quote_value.toLocaleString()}` : "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{r.closed_at ? format(new Date(r.closed_at), "MMM d, yyyy") : "—"}</td>
                        <td className="px-5 py-3 text-sm">{r.sales_rep || "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground truncate max-w-[200px]">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center">
                <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No closed deals yet</p>
              </div>
            )}
          </div>
        )}

        {/* CRM Slide-out Detail Panel */}
        <Sheet open={!!selectedRecordId} onOpenChange={open => { if (!open) setSelectedRecordId(null); }}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedRecord && (
              <>
                <SheetHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="font-heading text-xl">{selectedRecord.full_name}</SheetTitle>
                    <LeadStagePill stage={getEffectiveStage(selectedRecord)} />
                  </div>
                </SheetHeader>
                <div className="space-y-5">
                  {/* Full CRM record */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CRM Record</h3>
                    <div className="space-y-1.5 text-sm">
                      {[
                        { label: "Customer ID", value: selectedRecord.customer_id },
                        { label: "Email", value: selectedRecord.email_address },
                        { label: "Phone", value: selectedRecord.phone_number || "—" },
                        { label: "Address", value: selectedRecord.mailing_address || "—" },
                        { label: "Lead Source", value: selectedRecord.lead_source || "—" },
                        { label: "Segment", value: selectedRecord.customer_segment },
                        { label: "Engagement", value: `${selectedRecord.engagement_score}/100` },
                        { label: "Persona", value: selectedRecord.persona_match || "—" },
                        { label: "Routing", value: selectedRecord.routing_decision || "—" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium text-right max-w-[55%] truncate">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Conversation summary */}
                  {selectedLead && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversation Summary</h3>
                      <p className="text-sm leading-relaxed">{selectedLead.inquiry_summary || selectedLead.message}</p>
                    </section>
                  )}

                  {/* Score breakdown (compact) */}
                  {selectedLead?.qualification_data && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h3>
                      <div className="space-y-1.5">
                        {Object.entries(categoryConfig).map(([key, cfg]) => {
                          const qData = selectedLead.qualification_data as any;
                          const s = qData?.scores?.[key];
                          if (!s) return null;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-xs w-16">{cfg.label}</span>
                              <ScoreBar score={s.score} max={cfg.max} threshold={cfg.threshold} />
                              <span className="text-xs font-mono w-10 text-right">{s.score}/{cfg.max}</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Sales Briefing */}
                  {selectedRecord.sales_briefing && (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Briefing</h3>
                      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-3">{selectedRecord.sales_briefing}</pre>
                    </section>
                  )}

                  {/* Email Sequence Timeline */}
                  {(() => {
                    const msgs = followUpMessages?.filter(m => m.lead_id === selectedRecord.lead_id) || [];
                    const seq = followUpSequences?.find(s => s.lead_id === selectedRecord.lead_id) || null;
                    if (msgs.length === 0 && !seq) return null;
                    return (
                      <section className="space-y-2 border-t border-border pt-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Sequence</h3>
                        <EmailSequenceTimeline
                          messages={msgs}
                          sequence={seq}
                          leadName={selectedRecord.full_name}
                          leadStage={getEffectiveStage(selectedRecord)}
                        />
                      </section>
                    );
                  })()}

                  {/* Editable fields */}
                  <section className="space-y-3 border-t border-border pt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Stage</label>
                      <Select
                        value={selectedRecord.lead_stage}
                        onValueChange={v => updateCrmMutation.mutate({ id: selectedRecord.id, updates: { lead_stage: v } })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stageOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
                      <Input
                        placeholder="Assign..."
                        defaultValue={selectedRecord.sales_rep || ""}
                        onBlur={e => { if (e.target.value !== (selectedRecord.sales_rep || "")) updateCrmMutation.mutate({ id: selectedRecord.id, updates: { sales_rep: e.target.value } }); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Quote Value</label>
                        <Input
                          type="number"
                          placeholder="$"
                          defaultValue={selectedRecord.quote_value ?? ""}
                          onBlur={e => updateCrmMutation.mutate({ id: selectedRecord.id, updates: { quote_value: parseFloat(e.target.value) || null } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Quote Date</label>
                        <Input
                          type="date"
                          defaultValue={selectedRecord.quote_issued_date ? format(new Date(selectedRecord.quote_issued_date), "yyyy-MM-dd") : ""}
                          onBlur={e => updateCrmMutation.mutate({ id: selectedRecord.id, updates: { quote_issued_date: e.target.value || null } })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Notes</label>
                      <Textarea
                        placeholder="Add notes..."
                        defaultValue={selectedRecord.notes || ""}
                        rows={3}
                        onBlur={e => { if (e.target.value !== (selectedRecord.notes || "")) updateCrmMutation.mutate({ id: selectedRecord.id, updates: { notes: e.target.value } }); }}
                      />
                    </div>
                  </section>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => triggerFollowUpMutation.mutate({ leadId: selectedRecord.lead_id, crmRecordId: selectedRecord.id })}
                      disabled={triggerFollowUpMutation.isPending}
                    >
                      {triggerFollowUpMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Generate Follow-Up Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs text-success border-success/30 hover:bg-success/10"
                      onClick={() => closeLeadMutation.mutate({ id: selectedRecord.id, leadId: selectedRecord.lead_id, won: true })}
                      disabled={closeLeadMutation.isPending}
                    >
                      <Trophy className="h-3.5 w-3.5" /> Mark as Won
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => closeLeadMutation.mutate({ id: selectedRecord.id, leadId: selectedRecord.lead_id, won: false })}
                      disabled={closeLeadMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Mark as Lost
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
