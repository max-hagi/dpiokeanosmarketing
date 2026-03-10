import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, DollarSign, Clock, ShieldCheck, UserCheck, Target,
  Loader2, Mail, AlertTriangle, CheckCircle, Users, Brain,
  ArrowLeft, RotateCw, Trophy, XCircle, Search, Download
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

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
    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CrmActions() {
  const { id: leadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchAll, setSearchAll] = useState("");

  // --- Single-lead CRM view ---
  const { data: lead } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  const { data: crmRecord, isLoading: crmLoading } = useQuery({
    queryKey: ["crm-record", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").eq("lead_id", leadId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // All CRM records for table view
  const { data: allCrmRecords, isLoading: allLoading } = useQuery({
    queryKey: ["crm-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !leadId,
  });

  const runCrmAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("crm-action-agent", {
        body: { leadId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", leadId] });
      toast.success("CRM record created and actions assigned!");
      // Auto-trigger follow-up agent
      if (data.sequence_type && data.crm_record) {
        triggerFollowUpMutation.mutate({
          sequenceType: data.sequence_type,
          crmRecordId: data.crm_record.id,
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "CRM agent failed"),
  });

  const triggerFollowUpMutation = useMutation({
    mutationFn: async ({ sequenceType, crmRecordId }: { sequenceType: string; crmRecordId: string }) => {
      const { data, error } = await supabase.functions.invoke("follow-up-agent", {
        body: { leadId, sequenceType, crmRecordId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", leadId] });
      toast.success("Follow-up sequence generated!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Follow-up agent failed"),
  });

  const updateCrmMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("crm_records").update(updates).eq("lead_id", leadId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", leadId] });
      toast.success("CRM record updated!");
    },
  });

  const closeLeadMutation = useMutation({
    mutationFn: async (won: boolean) => {
      const { error } = await supabase.from("crm_records").update({
        is_won: won,
        closed_at: new Date().toISOString(),
      }).eq("lead_id", leadId!);
      if (error) throw error;
      // Update lead stage
      await supabase.from("leads").update({
        lead_stage: won ? "sold" : "inquiry",
      }).eq("id", leadId!);
    },
    onSuccess: (_, won) => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success(won ? "Lead marked as WON!" : "Lead marked as lost.");
    },
  });

  // --- All records table view ---
  if (!leadId) {
    const filtered = allCrmRecords?.filter(r =>
      r.full_name.toLowerCase().includes(searchAll.toLowerCase()) ||
      r.email_address.toLowerCase().includes(searchAll.toLowerCase())
    );

    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">CRM & Actions</h1>
          <p className="text-muted-foreground mt-1">Agent 6 — CRM records and recovery actions</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={searchAll} onChange={e => setSearchAll(e.target.value)} className="pl-9 h-11 rounded-xl" />
        </div>

        <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
          {allLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered && filtered.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Customer</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Score</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Segment</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Routing</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Sequence</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/crm/${r.lead_id}`)}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.customer_id}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-bold ${(r.qualification_score || 0) >= 70 ? "text-success" : (r.qualification_score || 0) >= 50 ? "text-warning" : "text-destructive"}`}>
                        {r.qualification_score}/100
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm">{r.customer_segment}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.routing_decision === "QUALIFIED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>{r.routing_decision}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono">{r.follow_up_sequence ? `Seq ${r.follow_up_sequence}` : "—"}</td>
                    <td className="px-5 py-3.5">
                      {r.is_won === true && <span className="text-xs font-semibold text-success">WON</span>}
                      {r.is_won === false && <span className="text-xs font-semibold text-destructive">LOST</span>}
                      {r.is_won === null && <span className="text-xs text-muted-foreground">Open</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Brain className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <p className="text-muted-foreground mb-2">No CRM records yet.</p>
              <p className="text-xs text-muted-foreground">CRM records are created when you run the CRM Action Agent on a qualified lead.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Single-lead CRM detail view ---
  const qData = lead?.qualification_data as any;
  const weakCategories = (crmRecord?.weak_categories as any[]) || [];
  const assignedActions = (crmRecord?.assigned_actions as any[]) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/crm"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">CRM & Actions</h1>
          <p className="text-muted-foreground mt-1">{lead?.full_name || "Loading..."}</p>
        </div>
        {!crmRecord && lead?.qualification_data && (
          <Button
            onClick={() => runCrmAgentMutation.mutate()}
            disabled={runCrmAgentMutation.isPending}
            className="gap-2 shadow-md"
          >
            {runCrmAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Run CRM Action Agent
          </Button>
        )}
        {crmRecord && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => runCrmAgentMutation.mutate()} disabled={runCrmAgentMutation.isPending}>
            <RotateCw className={`h-3.5 w-3.5 ${runCrmAgentMutation.isPending ? "animate-spin" : ""}`} /> Re-run
          </Button>
        )}
      </div>

      {!lead?.qualification_data && (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">This lead hasn't been qualified yet. <Link to={`/leads/${leadId}`} className="text-primary hover:underline">View lead</Link> to trigger qualification first.</p>
        </div>
      )}

      {crmLoading && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" />
        </div>
      )}

      {crmRecord && (
        <>
          {/* Two-panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: CRM Record */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">CRM Record</h2>

              <div className="space-y-3">
                {[
                  { label: "Customer ID", value: crmRecord.customer_id },
                  { label: "Full Name", value: crmRecord.full_name },
                  { label: "Email", value: crmRecord.email_address },
                  { label: "Phone", value: crmRecord.phone_number || "—" },
                  { label: "Address", value: crmRecord.mailing_address || "—" },
                  { label: "Lead Source", value: crmRecord.lead_source },
                  { label: "Segment", value: crmRecord.customer_segment },
                  { label: "Engagement Score", value: `${crmRecord.engagement_score}/100` },
                  { label: "Referral", value: crmRecord.referral_source || "—" },
                  { label: "Persona", value: crmRecord.persona_match || "—" },
                  { label: "Initial Contact", value: crmRecord.initial_contact_date ? format(new Date(crmRecord.initial_contact_date), "MMM d, yyyy h:mm a") : "—" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{item.value}</span>
                  </div>
                ))}
              </div>

              <hr className="border-border" />

              {/* Editable fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
                  <Input
                    placeholder="Assign sales rep..."
                    defaultValue={crmRecord.sales_rep || ""}
                    onBlur={e => {
                      if (e.target.value !== (crmRecord.sales_rep || "")) {
                        updateCrmMutation.mutate({ sales_rep: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Preferred Contact</label>
                  <Select
                    value={crmRecord.preferred_contact_method || "Email"}
                    onValueChange={v => updateCrmMutation.mutate({ preferred_contact_method: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Internal Notes</label>
                  <Textarea
                    placeholder="Add notes..."
                    defaultValue={crmRecord.notes || ""}
                    rows={3}
                    onBlur={e => {
                      if (e.target.value !== (crmRecord.notes || "")) {
                        updateCrmMutation.mutate({ notes: e.target.value });
                      }
                    }}
                  />
                </div>
              </div>

              <hr className="border-border" />

              {/* Override & close buttons */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={crmRecord.routing_decision || "NURTURE"}
                    onValueChange={v => updateCrmMutation.mutate({ routing_decision: v })}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUALIFIED">Qualified</SelectItem>
                      <SelectItem value="NURTURE">Nurture</SelectItem>
                      <SelectItem value="DIRECT BOOKING">Direct Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1 text-success border-success/30 hover:bg-success/10"
                    onClick={() => closeLeadMutation.mutate(true)}
                    disabled={closeLeadMutation.isPending}
                  >
                    <Trophy className="h-3.5 w-3.5" /> Mark as Won
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => closeLeadMutation.mutate(false)}
                    disabled={closeLeadMutation.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Mark as Lost
                  </Button>
                </div>
                {crmRecord.is_won !== null && (
                  <p className="text-xs text-center text-muted-foreground">
                    {crmRecord.is_won ? "✅ Won" : "❌ Lost"} — {crmRecord.closed_at ? format(new Date(crmRecord.closed_at), "MMM d, yyyy") : ""}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT: Sales Briefing */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sales Briefing</h2>
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{crmRecord.sales_briefing || "No briefing generated yet."}</pre>
            </div>
          </div>

          {/* Score Breakdown — 5 horizontal bars */}
          {qData && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const scoreData = qData.scores?.[key];
                  if (!scoreData) return null;
                  const isWeak = scoreData.score < config.threshold;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <config.icon className={`h-4 w-4 shrink-0 ${isWeak ? "text-destructive" : "text-success"}`} />
                      <span className="text-sm w-28">{config.label}</span>
                      <ScoreBar score={scoreData.score} max={config.max} threshold={config.threshold} />
                      <span className="text-sm font-mono font-medium w-14 text-right">{scoreData.score}/{config.max}</span>
                      {isWeak && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                    </div>
                  );
                })}
                <hr className="border-border" />
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold w-28">TOTAL</span>
                  <div className="flex-1 h-3.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        qData.total_score >= 70 ? "bg-success" : qData.total_score >= 50 ? "bg-warning" : "bg-destructive"
                      }`}
                      style={{ width: `${qData.total_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono font-bold w-14 text-right">{qData.total_score}/100</span>
                </div>
              </div>
            </div>
          )}

          {/* Weak Category Actions */}
          {assignedActions.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Weak Category Actions</h2>
              <div className="space-y-3">
                {assignedActions.map((action: any, i: number) => {
                  const config = categoryConfig[action.category];
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-4 bg-muted/20">
                      <div className="flex items-center gap-2 shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{config?.label || action.category}</span>
                      </div>
                      <p className="text-sm flex-1">{action.action}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        action.status === "sent" ? "bg-success/10 text-success" :
                        action.status === "responded" ? "bg-primary/10 text-primary" :
                        action.status === "converted" ? "bg-accent/10 text-accent" :
                        "bg-warning/10 text-warning"
                      }`}>{action.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
