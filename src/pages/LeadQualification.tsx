import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Target, MapPin, DollarSign, Clock, UserCheck, ShieldCheck, AlertTriangle, CheckCircle, ArrowRight, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fitLevelConfig = {
  high_fit: { label: "HIGH FIT", color: "text-success", bg: "bg-success/10", icon: "●" },
  medium_fit: { label: "MEDIUM FIT", color: "text-warning", bg: "bg-warning/10", icon: "●" },
  low_fit: { label: "LOW FIT", color: "text-destructive", bg: "bg-destructive/10", icon: "●" },
};

const routingActionConfig: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  fast_track: { label: "Fast Track → Sales", color: "text-success", icon: Zap },
  sales_review: { label: "Sales Review", color: "text-primary", icon: UserCheck },
  nurture_conversation: { label: "Conversation Agent", color: "text-warning", icon: RotateCw },
  drip_nurture: { label: "Drip Nurture", color: "text-muted-foreground", icon: Clock },
  disqualify: { label: "Disqualified", color: "text-destructive", icon: AlertTriangle },
};

export default function LeadQualification() {
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
      toast.success("Lead qualified and routed!");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Qualification failed");
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!lead) return <div className="p-8 text-center text-muted-foreground">Lead not found.</div>;

  const qData = lead.qualification_data as any;
  const hasQualification = !!qData;
  const fitConfig = hasQualification ? fitLevelConfig[lead.fit_level as keyof typeof fitLevelConfig] : null;
  const routeConfig = lead.routing_action ? routingActionConfig[lead.routing_action] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/leads/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold">Qualification & Routing</h1>
          <p className="text-muted-foreground mt-1">{lead.full_name} — Agent 4 & 5 Pipeline</p>
        </div>
        <Button
          onClick={() => qualifyMutation.mutate()}
          disabled={qualifyMutation.isPending}
          className="gap-2"
        >
          <Target className="h-4 w-4" />
          {hasQualification ? "Re-qualify" : "Run Qualification"}
        </Button>
      </div>

      {!hasQualification ? (
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <Target className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="font-heading text-xl font-semibold">Not Yet Qualified</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Click "Run Qualification" to score this lead against Okeanos's ideal customer criteria and automatically route them to the right next step.
          </p>
        </div>
      ) : (
        <>
          {/* Score Summary Card */}
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lead Qualification Report</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Lead ID: {lead.id}
                  {lead.qualified_at && ` • Qualified: ${format(new Date(lead.qualified_at), "MMM d, yyyy 'at' h:mm a")}`}
                </p>
              </div>
              {fitConfig && (
                <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${fitConfig.bg} ${fitConfig.color}`}>
                  {fitConfig.icon} {fitConfig.label}
                </span>
              )}
            </div>

            <hr className="border-border" />

            {/* Score Breakdown */}
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-semibold">Score Breakdown</h3>
              {[
                { label: "Location", icon: MapPin, score: qData.scores.location.score, max: 25, detail: qData.scores.location.detail },
                { label: "Budget", icon: DollarSign, score: qData.scores.budget.score, max: 25, detail: qData.scores.budget.detail },
                { label: "Timeline", icon: Clock, score: qData.scores.timeline.score, max: 20, detail: qData.scores.timeline.detail },
                { label: "Project Fit", icon: ShieldCheck, score: qData.scores.project_fit.score, max: 20 },
                { label: "Lead Quality", icon: UserCheck, score: qData.scores.lead_quality.score, max: 10 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm w-28">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(item.score / item.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono font-medium w-16 text-right">
                    {item.score} / {item.max}
                  </span>
                </div>
              ))}
              <hr className="border-border" />
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold w-28">TOTAL</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      qData.total_score >= 70 ? "bg-success" : qData.total_score >= 50 ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${qData.total_score}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold w-16 text-right">
                  {qData.total_score} / 100
                </span>
              </div>
            </div>
          </div>

          {/* Strengths & Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="font-heading text-sm font-semibold text-success flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Key Strengths
              </h3>
              <ul className="space-y-2">
                {qData.key_strengths?.map((s: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-success mt-1">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="font-heading text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Key Risks
              </h3>
              <ul className="space-y-2">
                {qData.key_risks?.map((r: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendation */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommendation</h3>
            <p className="text-sm leading-relaxed">{qData.recommendation}</p>
          </div>

          {/* Routing Decision (Agent 5) */}
          {routeConfig && (
            <div className="glass-card rounded-xl border-t-4 border-t-primary p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Routing Decision — Agent 5
                </h3>
                <span className={`inline-flex items-center gap-2 text-sm font-semibold ${routeConfig.color}`}>
                  <routeConfig.icon className="h-4 w-4" />
                  {routeConfig.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{lead.routing_reason}</p>
              {lead.routed_at && (
                <p className="text-xs text-muted-foreground">
                  Routed: {format(new Date(lead.routed_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Back to Lead */}
      <div className="flex justify-between">
        <Link to={`/leads/${id}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Lead Profile
          </Button>
        </Link>
        <Link to="/leads/pipeline">
          <Button variant="outline" className="gap-2">
            Pipeline View <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
