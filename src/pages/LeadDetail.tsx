import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, User, Mail, Phone, MapPin, DollarSign, Clock,
  Megaphone, AlertTriangle, Home, MessageSquare, Tag, Search,
  BarChart3, Target, Loader2, RotateCw, Sparkles, Eye, Brain,
  ShieldCheck, UserCheck, Trophy, XCircle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEffect } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LeadStageBadge from "@/components/LeadStageBadge";
import QualificationReport from "@/components/QualificationReport";

const budgetLabels: Record<string, string> = {
  under_30k: "Under $30,000",
  "30k_50k": "$30,000 – $50,000",
  "50k_80k": "$50,000 – $80,000",
  "80k_plus": "$80,000+",
};

const timelineLabels: Record<string, string> = {
  asap: "ASAP",
  within_3_months: "Within 3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  "12_plus_months": "12+ months",
};

const sourceLabels: Record<string, string> = {
  google: "Google",
  social_media: "Social Media",
  word_of_mouth: "Word of Mouth",
  other: "Other",
};

const contactLabels: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  any: "Any",
};

const segmentLabels: Record<string, string> = {
  new_lead: "New Lead",
  high_value: "High Value",
  warm: "Warm",
  dormant: "Dormant",
};

const personaLabels: Record<string, string> = {
  john_homeowner: "John Homeowner",
  sarah_james_patel: "Sarah & James Patel",
  mike_turner: "Mike Turner (DIY)",
  amanda_mark_johnson: "Amanda & Mark Johnson",
  jessica_daniel_wong: "Jessica & Daniel Wong",
  chris_miller: "Chris Miller (Landscaper)",
  ryan_thompson: "Ryan Thompson (Builder)",
};

const leadStages = [
  { value: "inquiry", label: "Inquiry" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "sold", label: "Sold" },
  { value: "installed", label: "Installed" },
  { value: "retention", label: "Retention" },
];

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
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: conversationMessages } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_messages").select("*").eq("lead_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: crmRecord } = useQuery({
    queryKey: ["crm-record", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").eq("lead_id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const qualifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("qualify-lead", { body: { leadId: id } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Qualification failed"),
  });

  const runCrmAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("crm-action-agent", { body: { leadId: id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", id] });
      toast.success("CRM record created and actions assigned!");
      if (data.sequence_type && data.crm_record) {
        triggerFollowUpMutation.mutate({ sequenceType: data.sequence_type, crmRecordId: data.crm_record.id });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "CRM agent failed"),
  });

  const triggerFollowUpMutation = useMutation({
    mutationFn: async ({ sequenceType, crmRecordId }: { sequenceType: string; crmRecordId: string }) => {
      const { data, error } = await supabase.functions.invoke("follow-up-agent", {
        body: { leadId: id, sequenceType, crmRecordId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", id] });
      toast.success("Follow-up sequence generated!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Follow-up agent failed"),
  });

  const updateCrmMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("crm_records").update(updates).eq("lead_id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", id] });
      toast.success("Updated!");
    },
  });

  const closeLeadMutation = useMutation({
    mutationFn: async (won: boolean) => {
      const { error } = await supabase.from("crm_records").update({
        is_won: won, closed_at: new Date().toISOString(),
      }).eq("lead_id", id!);
      if (error) throw error;
      await supabase.from("leads").update({ lead_stage: won ? "sold" : "inquiry" }).eq("id", id!);
    },
    onSuccess: (_, won) => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", id] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success(won ? "Lead marked as WON!" : "Lead marked as lost.");
    },
  });

  // Auto-qualify on first view
  useEffect(() => {
    if (lead && !lead.qualification_data && !qualifyMutation.isPending && !qualifyMutation.isSuccess) {
      qualifyMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.qualification_data]);

  // Auto-run CRM agent after qualification completes (if no CRM record yet)
  useEffect(() => {
    if (lead?.qualification_data && crmRecord === null && !runCrmAgentMutation.isPending && !runCrmAgentMutation.isSuccess) {
      runCrmAgentMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.qualification_data, crmRecord]);

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase.from("leads").update({ lead_stage: newStage as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead stage updated!");
    },
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async (newSegment: string) => {
      const { error } = await supabase.from("leads").update({ customer_segment: newSegment as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success("Customer segment updated!");
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading lead...</div>;
  if (!lead) return <div className="p-8 text-center text-muted-foreground">Lead not found.</div>;

  const missingFields = (lead.missing_fields as string[]) || [];
  const convData = lead.conversation_data as any;
  const convStatus = (lead as any).conversation_status as string;
  const personaMatch = (lead as any).persona_match as string;
  const qData = lead.qualification_data as any;
  const weakCategories = (crmRecord?.weak_categories as any[]) || [];
  const assignedActions = (crmRecord?.assigned_actions as any[]) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/leads"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold">{lead.full_name}</h1>
          <p className="text-muted-foreground mt-1">{lead.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <LeadStageBadge stage={lead.lead_stage} />
          <LeadStatusBadge status={lead.lead_status} />
        </div>
      </div>

      {/* Admin Controls */}
      <div className="glass-card rounded-xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Pipeline Stage</label>
          <Select value={lead.lead_stage} onValueChange={(v) => updateStageMutation.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {leadStages.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Customer Segment</label>
          <Select value={lead.customer_segment || "new_lead"} onValueChange={(v) => updateSegmentMutation.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(segmentLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Engagement</label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-background text-sm font-medium">
            <BarChart3 className="h-3.5 w-3.5 mr-2 text-primary" />{lead.engagement_score ?? 0}/100
          </div>
        </div>
        {personaMatch && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Persona</label>
            <div className="h-10 flex items-center px-3 rounded-md border border-input bg-background text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5 mr-2 text-accent" />{personaLabels[personaMatch] || personaMatch}
            </div>
          </div>
        )}
        {lead.qualification_data && (
          <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => qualifyMutation.mutate()} disabled={qualifyMutation.isPending}>
            <RotateCw className={`h-3.5 w-3.5 ${qualifyMutation.isPending ? "animate-spin" : ""}`} />Re-score
          </Button>
        )}
      </div>

      {/* Contact & Project Info */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: User, label: "Name", value: lead.full_name },
              { icon: Mail, label: "Email", value: lead.email },
              { icon: Phone, label: "Phone", value: lead.phone || "Not provided" },
              { icon: MessageSquare, label: "Preferred Contact", value: lead.preferred_contact ? contactLabels[lead.preferred_contact] : "Any" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-primary shrink-0" />
                <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-sm font-medium">{item.value}</p></div>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">City</p><p className="text-sm font-medium">{lead.location || "Not provided"}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">Mailing Address</p><p className="text-sm font-medium">{lead.mailing_address || "Not provided"}</p></div>
            </div>
            {convData?.in_service_area && (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Service Area</p>
                  <p className={`text-sm font-medium capitalize ${convData.in_service_area === "yes" ? "text-success" : convData.in_service_area === "no" ? "text-destructive" : ""}`}>
                    {convData.in_service_area}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Project Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Budget Range</p>
                <p className="text-sm font-medium">{lead.budget ? budgetLabels[lead.budget] : convData?.budget_range || "Not provided"}</p>
                {convData?.budget_aligned && (
                  <p className={`text-xs ${convData.budget_aligned === "yes" ? "text-success" : convData.budget_aligned === "no" ? "text-destructive" : "text-warning"}`}>
                    {convData.budget_aligned === "yes" ? "Aligned with standard range" : convData.budget_aligned === "no" ? "Below standard range" : "Alignment unclear"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">Timeline</p><p className="text-sm font-medium">{lead.timeline ? timelineLabels[lead.timeline] : "Not provided"}</p></div>
            </div>
            {convData?.backyard_access && (
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <div><p className="text-xs text-muted-foreground">Backyard Access</p><p className="text-sm font-medium capitalize">{convData.backyard_access.replace(/_/g, " ")}</p></div>
              </div>
            )}
            {convData?.decision_maker && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div><p className="text-xs text-muted-foreground">Decision Maker</p><p className="text-sm font-medium capitalize">{convData.decision_maker}</p></div>
              </div>
            )}
          </div>
        </section>

        {convData && (convData.pool_vision || convData.trigger || convData.main_fear) && (
          <>
            <hr className="border-border" />
            <section>
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4" /> Discovery Insights
              </h2>
              <div className="space-y-3">
                {convData.pool_vision && <div><p className="text-xs text-muted-foreground font-medium">Pool Vision</p><p className="text-sm leading-relaxed">{convData.pool_vision}</p></div>}
                {convData.must_haves && <div><p className="text-xs text-muted-foreground font-medium">Must-Haves</p><p className="text-sm leading-relaxed">{convData.must_haves}</p></div>}
                {convData.trigger && <div><p className="text-xs text-muted-foreground font-medium">What Triggered This Project</p><p className="text-sm leading-relaxed">{convData.trigger}</p></div>}
                {convData.main_fear && <div><p className="text-xs text-muted-foreground font-medium">Main Concern</p><p className="text-sm leading-relaxed">{convData.main_fear}</p></div>}
              </div>
            </section>
          </>
        )}

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Inquiry Summary</h2>
          <p className="text-sm leading-relaxed">{lead.inquiry_summary || lead.message}</p>
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Source & Attribution</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Megaphone, label: "Source", value: lead.source ? sourceLabels[lead.source] : "Not provided" },
              { icon: User, label: "Referred By", value: lead.referral_source || "—" },
              { icon: Tag, label: "Campaign", value: lead.campaign_id || "—" },
              { icon: Search, label: "Keyword", value: lead.keyword_source || "—" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-primary shrink-0" />
                <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-sm font-medium">{item.value}</p></div>
              </div>
            ))}
          </div>
        </section>

        {missingFields.length > 0 && (
          <>
            <hr className="border-border" />
            <section>
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Missing Info Flags</h2>
              <div className="flex flex-wrap gap-2">
                {missingFields.map((field) => (
                  <span key={field} className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-3 py-1 text-xs font-medium capitalize">
                    <AlertTriangle className="h-3 w-3" />{field}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}

        <hr className="border-border" />
        <section className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Lead ID: {lead.id}</span>
          <span>Submitted: {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
        </section>
      </div>

      {/* Conversation Transcript */}
      {conversationMessages && conversationMessages.length > 0 && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Eye className="h-4 w-4" /> Conversation Transcript
            <span className="ml-auto text-xs font-normal">
              {convStatus === "complete" ? "✅ Complete" : convStatus === "in_progress" ? "🔄 In Progress" : ""}
            </span>
          </h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {conversationMessages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === "user" ? "bg-primary/10 text-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                }`}>
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">
                    {msg.role === "assistant" ? "Kai" : lead.full_name}
                  </p>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!conversationMessages || conversationMessages.length === 0) && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Original Message</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.message}</p>
        </div>
      )}

      {/* Qualification Report */}
      {qualifyMutation.isPending && !lead.qualification_data && (
        <div className="glass-card rounded-xl p-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Scoring this lead automatically...</p>
        </div>
      )}
      <QualificationReport lead={lead} />

      {/* CRM Agent Loading */}
      {runCrmAgentMutation.isPending && (
        <div className="glass-card rounded-xl p-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Creating CRM record & assigning recovery actions...</p>
        </div>
      )}

      {/* Inline CRM Record & Sales Briefing */}
      {crmRecord && (
        <>
          {/* Score Breakdown */}
          {qData && (
            <div className="glass-card rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h2>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => runCrmAgentMutation.mutate()} disabled={runCrmAgentMutation.isPending}>
                  <RotateCw className={`h-3.5 w-3.5 ${runCrmAgentMutation.isPending ? "animate-spin" : ""}`} /> Re-run CRM Agent
                </Button>
              </div>
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
                    <div className={`h-full rounded-full transition-all ${qData.total_score >= 70 ? "bg-success" : qData.total_score >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${qData.total_score}%` }} />
                  </div>
                  <span className="text-sm font-mono font-bold w-14 text-right">{qData.total_score}/100</span>
                </div>
              </div>
            </div>
          )}

          {/* CRM Record + Sales Briefing side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-6 space-y-5">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">CRM Record</h2>
              <div className="space-y-3">
                {[
                  { label: "Customer ID", value: crmRecord.customer_id },
                  { label: "Segment", value: crmRecord.customer_segment },
                  { label: "Routing", value: crmRecord.routing_decision },
                  { label: "Engagement Score", value: `${crmRecord.engagement_score}/100` },
                  { label: "Persona", value: crmRecord.persona_match || "—" },
                  { label: "Follow-Up Sequence", value: crmRecord.follow_up_sequence ? `Sequence ${crmRecord.follow_up_sequence}` : "—" },
                  { label: "Initial Contact", value: crmRecord.initial_contact_date ? format(new Date(crmRecord.initial_contact_date), "MMM d, yyyy h:mm a") : "—" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{item.value}</span>
                  </div>
                ))}
              </div>

              <hr className="border-border" />

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
                  <Input placeholder="Assign sales rep..." defaultValue={crmRecord.sales_rep || ""}
                    onBlur={e => { if (e.target.value !== (crmRecord.sales_rep || "")) updateCrmMutation.mutate({ sales_rep: e.target.value }); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Internal Notes</label>
                  <Textarea placeholder="Add notes..." defaultValue={crmRecord.notes || ""} rows={3}
                    onBlur={e => { if (e.target.value !== (crmRecord.notes || "")) updateCrmMutation.mutate({ notes: e.target.value }); }} />
                </div>
              </div>

              <hr className="border-border" />

              <div className="space-y-2">
                <Select value={crmRecord.routing_decision || "NURTURE"} onValueChange={v => updateCrmMutation.mutate({ routing_decision: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUALIFIED">Qualified</SelectItem>
                    <SelectItem value="NURTURE">Nurture</SelectItem>
                    <SelectItem value="DIRECT BOOKING">Direct Booking</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-success border-success/30 hover:bg-success/10"
                    onClick={() => closeLeadMutation.mutate(true)} disabled={closeLeadMutation.isPending}>
                    <Trophy className="h-3.5 w-3.5" /> Mark as Won
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => closeLeadMutation.mutate(false)} disabled={closeLeadMutation.isPending}>
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

            <div className="glass-card rounded-xl p-6 space-y-5">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sales Briefing</h2>
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{crmRecord.sales_briefing || "No briefing generated yet."}</pre>
            </div>
          </div>

          {/* Weak Category Actions */}
          {assignedActions.length > 0 && (
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recovery Actions</h2>
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
