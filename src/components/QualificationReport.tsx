import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Target, MapPin, DollarSign, Clock, UserCheck, ShieldCheck,
  CheckCircle, AlertTriangle, Zap, RotateCw, Mail, Phone,
  MessageSquare, XCircle, Send, Users
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fitLevelConfig = {
  high_fit: { label: "HIGH FIT", color: "text-success", bg: "bg-success/10", icon: "●" },
  medium_fit: { label: "MEDIUM FIT", color: "text-warning", bg: "bg-warning/10", icon: "●" },
  low_fit: { label: "LOW FIT", color: "text-destructive", bg: "bg-destructive/10", icon: "●" },
};

interface RoutingOption {
  key: string;
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  border: string;
  action: () => void;
  isPending?: boolean;
  isActive?: boolean;
  improvesScore?: boolean;
}

export default function QualificationReport({ lead }: { lead: any }) {
  const queryClient = useQueryClient();
  const qData = lead.qualification_data as any;
  const fitConfig = qData ? fitLevelConfig[lead.fit_level as keyof typeof fitLevelConfig] : null;

  const updateRoutingMutation = useMutation({
    mutationFn: async ({ action, reason, stage }: { action: string; reason: string; stage?: string }) => {
      const updates: any = {
        routing_action: action,
        routing_reason: reason,
        routed_at: new Date().toISOString(),
      };
      if (stage) updates.lead_stage = stage;
      const { error } = await supabase.from("leads").update(updates).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        action: "lead_routed_manual",
        details: { lead_id: lead.id, routing_action: action, routing_reason: reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Routing updated!");
    },
    onError: () => toast.error("Failed to update routing"),
  });

  const sendFollowUpMutation = useMutation({
    mutationFn: async (method: string) => {
      const { error } = await supabase.from("leads").update({
        sent_to_conversation_agent: true,
        routing_action: "nurture_conversation",
        routing_reason: `Automated follow-up initiated via ${method} to gather missing information and improve qualification.`,
        routed_at: new Date().toISOString(),
      }).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        action: "lead_followup_sent",
        details: { lead_id: lead.id, method, preferred_contact: lead.preferred_contact },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      toast.success("Follow-up initiated!");
    },
    onError: () => toast.error("Failed to send follow-up"),
  });

  if (!qData) return null;

  const missingFields = (lead.missing_fields as string[]) || [];
  const canImprove = lead.fit_level !== "high_fit";
  const contactMethod = lead.preferred_contact || "email";
  const contactIcon = contactMethod === "phone" ? Phone : contactMethod === "sms" ? MessageSquare : Mail;
  const contactLabel = contactMethod === "phone" ? "Phone Call" : contactMethod === "sms" ? "SMS" : "Email";

  const routingOptions: RoutingOption[] = [
    {
      key: "fast_track",
      label: "Fast Track to Sales",
      description: "Priority handoff — schedule discovery call within 4 hours",
      icon: Zap,
      color: "text-success",
      bg: "bg-success/10 hover:bg-success/20",
      border: "border-success/30",
      isActive: lead.routing_action === "fast_track",
      action: () => updateRoutingMutation.mutate({
        action: "fast_track",
        reason: "Manually fast-tracked to sales team for immediate follow-up.",
        stage: "qualified",
      }),
    },
    {
      key: "sales_review",
      label: "Sales Team Review",
      description: "Route to sales for manual review and assessment",
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10 hover:bg-primary/20",
      border: "border-primary/30",
      isActive: lead.routing_action === "sales_review",
      action: () => updateRoutingMutation.mutate({
        action: "sales_review",
        reason: "Routed to sales team for manual review and potential discovery call.",
      }),
    },
    {
      key: "nurture_conversation",
      label: `Follow Up via ${contactLabel}`,
      description: `Auto-contact via their preferred method to gather missing info`,
      icon: contactIcon,
      color: "text-warning",
      bg: "bg-warning/10 hover:bg-warning/20",
      border: "border-warning/30",
      improvesScore: true,
      isActive: lead.routing_action === "nurture_conversation",
      action: () => sendFollowUpMutation.mutate(contactMethod),
    },
    {
      key: "drip_nurture",
      label: "Add to Drip Campaign",
      description: "Long-term nurture — automated email sequence for future conversion",
      icon: Send,
      color: "text-muted-foreground",
      bg: "bg-muted/50 hover:bg-muted",
      border: "border-border",
      isActive: lead.routing_action === "drip_nurture",
      action: () => updateRoutingMutation.mutate({
        action: "drip_nurture",
        reason: "Added to drip campaign for long-term nurturing.",
      }),
    },
    {
      key: "disqualify",
      label: "Disqualify Lead",
      description: "Not a fit — send polite decline with referral suggestions",
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10 hover:bg-destructive/20",
      border: "border-destructive/30",
      isActive: lead.routing_action === "disqualify",
      action: () => updateRoutingMutation.mutate({
        action: "disqualify",
        reason: "Lead disqualified — outside service scope or not a fit.",
      }),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      <div className="glass-card rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Qualification Report
            </h2>
            {lead.qualified_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Scored {format(new Date(lead.qualified_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          {fitConfig && (
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${fitConfig.bg} ${fitConfig.color}`}>
              {fitConfig.icon} {fitConfig.label}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {[
            { label: "Location", icon: MapPin, score: qData.scores.location.score, max: 25 },
            { label: "Budget", icon: DollarSign, score: qData.scores.budget.score, max: 25 },
            { label: "Timeline", icon: Clock, score: qData.scores.timeline.score, max: 20 },
            { label: "Project Fit", icon: ShieldCheck, score: qData.scores.project_fit.score, max: 20 },
            { label: "Lead Quality", icon: UserCheck, score: qData.scores.lead_quality.score, max: 10 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm w-24">{item.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(item.score / item.max) * 100}%` }}
                />
              </div>
              <span className="text-sm font-mono font-medium w-14 text-right">
                {item.score}/{item.max}
              </span>
            </div>
          ))}
          <hr className="border-border" />
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold w-24">TOTAL</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  qData.total_score >= 70 ? "bg-success" : qData.total_score >= 50 ? "bg-warning" : "bg-destructive"
                }`}
                style={{ width: `${qData.total_score}%` }}
              />
            </div>
            <span className="text-sm font-mono font-bold w-14 text-right">
              {qData.total_score}/100
            </span>
          </div>
        </div>
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Key Strengths
          </h3>
          <ul className="space-y-1.5">
            {qData.key_strengths?.map((s: string, i: number) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-success mt-0.5">•</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-card rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Key Risks
          </h3>
          <ul className="space-y-1.5">
            {qData.key_risks?.map((r: string, i: number) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendation */}
      <div className="glass-card rounded-xl p-4">
        <p className="text-sm leading-relaxed">
          <span className="font-semibold text-muted-foreground">Recommendation: </span>
          {qData.recommendation}
        </p>
      </div>

      {/* Routing Actions */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Route This Lead
          </h2>
          {lead.routing_action && lead.routed_at && (
            <span className="text-xs text-muted-foreground">
              Last routed {format(new Date(lead.routed_at), "MMM d 'at' h:mm a")}
            </span>
          )}
        </div>

        {canImprove && missingFields.length > 0 && (
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
            <p className="text-sm text-warning font-medium mb-1">Score can be improved</p>
            <p className="text-xs text-muted-foreground">
              Missing info: {missingFields.join(", ")}. Following up will help gather this data and increase the qualification score.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {routingOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={opt.action}
              disabled={updateRoutingMutation.isPending || sendFollowUpMutation.isPending}
              className={`w-full text-left rounded-lg border p-4 transition-all ${opt.border} ${opt.bg} ${
                opt.isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-3">
                <opt.icon className={`h-5 w-5 ${opt.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${opt.color}`}>{opt.label}</span>
                    {opt.isActive && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase">
                        Current
                      </span>
                    )}
                    {opt.improvesScore && canImprove && (
                      <span className="inline-flex items-center rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-bold uppercase">
                        Improves Score
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {lead.routing_reason && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Current routing note:</span> {lead.routing_reason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
