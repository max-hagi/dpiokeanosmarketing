import { cn } from "@/lib/utils";

type LeadStatus = "complete" | "incomplete";

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  complete: { label: "Complete", className: "bg-success/10 text-success" },
  incomplete: { label: "Incomplete", className: "bg-warning/10 text-warning" },
};

export default function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}
