import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ContentStatus = Database["public"]["Enums"]["content_status"];

const statusConfig: Record<ContentStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  generating: { label: "Generating", className: "bg-primary/10 text-primary animate-pulse-subtle" },
  review: { label: "In Review", className: "bg-warning/10 text-warning" },
  approved: { label: "Approved", className: "bg-success/10 text-success" },
  posted: { label: "Posted", className: "bg-accent/10 text-accent" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
};

export default function StatusBadge({ status }: { status: ContentStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}
