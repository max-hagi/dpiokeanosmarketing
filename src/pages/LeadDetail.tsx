import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Mail, Phone, MapPin, DollarSign, Clock, Megaphone, AlertTriangle, Home, MessageSquare, Tag, Search, BarChart3, Target, Loader2, RotateCw } from "lucide-react";
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

const leadStages = [
  { value: "inquiry", label: "Inquiry" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "sold", label: "Sold" },
  { value: "installed", label: "Installed" },
  { value: "retention", label: "Retention" },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const qualifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("qualify-lead", {
        body: { leadId: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Qualification failed");
    },
  });

  // Auto-qualify on first view if not yet qualified
  useEffect(() => {
    if (lead && !lead.qualification_data && !qualifyMutation.isPending && !qualifyMutation.isSuccess) {
      qualifyMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.qualification_data]);

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ lead_stage: newStage as any })
        .eq("id", id!);
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
      const { error } = await supabase
        .from("leads")
        .update({ customer_segment: newSegment as any })
        .eq("id", id!);
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/leads"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold">Lead Profile</h1>
          <p className="text-muted-foreground mt-1">Structured lead ready for agent handoff</p>
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
              {leadStages.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Customer Segment</label>
          <Select value={lead.customer_segment || "new_lead"} onValueChange={(v) => updateSegmentMutation.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(segmentLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Engagement Score</label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-background text-sm font-medium">
            <BarChart3 className="h-3.5 w-3.5 mr-2 text-primary" />
            {lead.engagement_score ?? 0}/100
          </div>
        </div>
        {lead.qualification_data && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 ml-auto"
            onClick={() => qualifyMutation.mutate()}
            disabled={qualifyMutation.isPending}
          >
            <RotateCw className={`h-3.5 w-3.5 ${qualifyMutation.isPending ? "animate-spin" : ""}`} />
            Re-score
          </Button>
        )}
      </div>

      {/* Structured Lead Profile */}
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
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">City</p><p className="text-sm font-medium">{lead.location || "Not provided"}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">Mailing Address</p><p className="text-sm font-medium">{lead.mailing_address || "Not provided"}</p></div>
            </div>
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Project Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">Budget Range</p><p className="text-sm font-medium">{lead.budget ? budgetLabels[lead.budget] : "Not provided"}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div><p className="text-xs text-muted-foreground">Timeline</p><p className="text-sm font-medium">{lead.timeline ? timelineLabels[lead.timeline] : "Not provided"}</p></div>
            </div>
          </div>
        </section>

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
                    <AlertTriangle className="h-3 w-3" />{field} — ask in follow-up
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

      {/* Original Message */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Original Message</h2>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.message}</p>
      </div>

      {/* Qualification Report — auto-loaded inline */}
      {qualifyMutation.isPending && !lead.qualification_data && (
        <div className="glass-card rounded-xl p-8 text-center space-y-3">
          <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Scoring this lead automatically...</p>
        </div>
      )}

      <QualificationReport lead={lead} />
    </div>
  );
}
