import { stageColors } from "./emailUtils";

interface LeadStagePillProps {
  stage: string;
  className?: string;
}

export default function LeadStagePill({ stage, className = "" }: LeadStagePillProps) {
  const colors = stageColors[stage.toLowerCase()] || stageColors.inquiry;
  const label = stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${colors.bg} ${colors.text} ${className}`}>
      {label}
    </span>
  );
}
