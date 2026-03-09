import { cn } from "@/lib/utils";

type LeadStage = "inquiry" | "qualified" | "quoted" | "sold" | "installed" | "retention";

const stageConfig: Record<LeadStage, { label: string; className: string }> = {
  inquiry: { label: "Inquiry", className: "bg-primary/10 text-primary" },
  qualified: { label: "Qualified", className: "bg-warning/10 text-warning" },
  quoted: { label: "Quoted", className: "bg-accent/10 text-accent" },
  sold: { label: "Sold", className: "bg-success/10 text-success" },
  installed: { label: "Installed", className: "bg-muted text-muted-foreground" },
  retention: { label: "Retention", className: "bg-primary/10 text-primary" },
};

export default function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const config = stageConfig[stage] || stageConfig.inquiry;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}
