import { formatDistanceToNow, format, isPast, differenceInHours, differenceInMinutes } from "date-fns";

// Status label mapping
export type EmailDisplayStatus = "scheduled" | "held_for_review" | "sent" | "paused" | "skipped" | "failed" | "edited_scheduled" | "responded";

export function mapEmailStatus(
  msgStatus: string,
  sequenceStatus: string | undefined,
  isEdited?: boolean
): EmailDisplayStatus {
  if (msgStatus === "sent") return "sent";
  if (msgStatus === "responded") return "responded";
  if (msgStatus === "skipped") return "skipped";
  if (msgStatus === "failed") return "failed";
  if (sequenceStatus === "paused" && (msgStatus === "pending" || msgStatus === "queued")) return "paused";
  if (isEdited && (msgStatus === "pending" || msgStatus === "queued")) return "edited_scheduled";
  if (msgStatus === "queued") return "scheduled";
  if (msgStatus === "pending") return "held_for_review";
  return "scheduled";
}

export const statusDisplay: Record<EmailDisplayStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Scheduled", color: "text-primary", bg: "bg-primary/10" },
  held_for_review: { label: "Held for Review", color: "text-warning", bg: "bg-warning/10" },
  sent: { label: "Sent", color: "text-success", bg: "bg-success/10" },
  paused: { label: "Paused", color: "text-warning", bg: "bg-warning/10" },
  skipped: { label: "Skipped", color: "text-muted-foreground", bg: "bg-muted/50" },
  failed: { label: "Failed", color: "text-destructive", bg: "bg-destructive/10" },
  edited_scheduled: { label: "Edited — Scheduled", color: "text-accent", bg: "bg-accent/10" },
  responded: { label: "Responded", color: "text-primary", bg: "bg-primary/10" },
};

// Relative time for scheduled emails
export function getRelativeSendTime(scheduledAt: string | null, sentAt: string | null): string {
  if (sentAt) {
    return `Sent ${formatDistanceToNow(new Date(sentAt), { addSuffix: false })} ago`;
  }
  if (!scheduledAt) return "Not scheduled";
  const date = new Date(scheduledAt);
  if (isPast(date)) return "Overdue — not sent";
  const mins = differenceInMinutes(date, new Date());
  const hrs = differenceInHours(date, new Date());
  if (mins < 60) return `Sends in ${mins} minutes`;
  if (hrs < 24) return `Sends in ${hrs} hours`;
  if (hrs < 48) return "Sends tomorrow";
  return `Sends in ${Math.ceil(hrs / 24)} days`;
}

export function getExactTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return format(new Date(dateStr), "EEEE MMMM d 'at' h:mm a");
}

// Sequence type labels — human-readable names
export const sequenceTypeLabels: Record<string, string> = {
  A: "Qualified Outreach",
  B: "Nurture — General",
  C: "Nurture — Budget",
  D: "Nurture — Location",
};

// Routing action display labels — maps internal values to user-friendly labels
export const routingActionLabels: Record<string, string> = {
  fast_track: "QUALIFIED",
  qualified: "QUALIFIED",
  QUALIFIED: "QUALIFIED",
  nurture_conversation: "NURTURE",
  sales_review: "NURTURE",
  drip_nurture: "NURTURE",
  disqualify: "NURTURE",
  NURTURE: "NURTURE",
  "DIRECT BOOKING": "DIRECT BOOKING",
  direct_booking: "DIRECT BOOKING",
};

export function getRoutingLabel(routingAction: string | null): string {
  if (!routingAction) return "—";
  return routingActionLabels[routingAction] || routingAction;
}

export function getRoutingBadgeClasses(label: string): string {
  switch (label) {
    case "QUALIFIED":
      return "bg-success/10 text-success";
    case "DIRECT BOOKING":
      return "bg-primary/10 text-primary";
    case "NURTURE":
      return "bg-warning/10 text-warning";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Check if a routing decision means the lead belongs in CRM
export function isQualifiedForCrm(routingDecision: string | null): boolean {
  const label = getRoutingLabel(routingDecision);
  return label === "QUALIFIED" || label === "DIRECT BOOKING";
}

// Stage color config
export const stageColors: Record<string, { bg: string; text: string }> = {
  qualified: { bg: "bg-success/10", text: "text-success" },
  inquiry: { bg: "bg-primary/10", text: "text-primary" },
  quoted: { bg: "bg-warning/10", text: "text-warning" },
  proposal_sent: { bg: "bg-warning/10", text: "text-warning" },
  sold: { bg: "bg-success/15", text: "text-success" },
  installed: { bg: "bg-success/15", text: "text-success" },
  retention: { bg: "bg-muted", text: "text-muted-foreground" },
  won: { bg: "bg-success/15", text: "text-success" },
  lost: { bg: "bg-muted", text: "text-muted-foreground" },
};

// Get next email info for lead cards
export function getNextEmailInfo(
  messages: Array<{ status: string; scheduled_at: string | null; sent_at: string | null }>,
  sequenceStatus?: string
): string {
  if (sequenceStatus === "paused") return "Paused";
  if (sequenceStatus === "completed") return "Sequence complete";
  const unsent = messages
    .filter(m => !m.sent_at && m.status !== "skipped" && m.status !== "sent" && m.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  if (unsent.length === 0) return "Sequence complete";
  return getRelativeSendTime(unsent[0].scheduled_at, null);
}

// Qualification cutoff from localStorage
const CUTOFF_KEY = "qualification_cutoff_score";
export function getQualificationCutoff(): number {
  const stored = localStorage.getItem(CUTOFF_KEY);
  return stored ? parseInt(stored, 10) : 50;
}
export function setQualificationCutoff(score: number): void {
  localStorage.setItem(CUTOFF_KEY, String(score));
}

// Segment label mapping — replaces "Dormant" for recent leads
export function getSegmentLabel(segment: string | null, createdAt?: string): string {
  if (!segment) return "New Lead";
  // If "Dormant" but created < 60 days ago, show "Low Priority" instead
  if (segment === "Dormant" && createdAt) {
    const daysSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 60) return "Low Priority";
  }
  return segment;
}
