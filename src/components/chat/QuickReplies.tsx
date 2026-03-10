import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

// Map conversation step (by user message count) to suggested replies
export function getQuickReplies(userMessageCount: number, lastAssistantMessage: string): string[] {
  const lower = lastAssistantMessage.toLowerCase();

  // Step 1: Ready to start?
  if (userMessageCount === 0 || lower.includes("ready") || lower.includes("get started")) {
    return ["Yes, let's go! 🏊", "Sure thing!", "Absolutely"];
  }

  // Step 2: Homeowner or contractor?
  if (lower.includes("homeowner") || lower.includes("contractor") || lower.includes("landscaper")) {
    return ["Homeowner", "Contractor / Landscaper"];
  }

  // Step 3: Location
  if (lower.includes("city") || lower.includes("area of ontario") || lower.includes("where")) {
    return ["Toronto", "Brampton", "Mississauga", "Hamilton"];
  }

  // Step 4: Backyard access
  if (lower.includes("backyard") || lower.includes("truck") || lower.includes("access")) {
    return ["Yes, plenty of room", "It's a bit tight", "Not sure"];
  }

  // Step 5: Timeline
  if (lower.includes("timeline") || lower.includes("hoping to have") || lower.includes("when")) {
    return ["ASAP!", "This summer", "Next year", "Just exploring"];
  }

  // Step 6: Budget
  if (lower.includes("budget") || lower.includes("$45,000") || lower.includes("invest")) {
    return ["Under $30k", "$30k – $50k", "$50k – $80k", "Not sure yet"];
  }

  // Step 7: Vision
  if (lower.includes("vision") || lower.includes("dream") || lower.includes("shape") || lower.includes("size")) {
    return ["Medium rectangle with a ledge", "Something fun for the kids", "Lap pool for exercise"];
  }

  // Step 8: Trigger
  if (lower.includes("someday") || lower.includes("pushed") || lower.includes("what made")) {
    return ["The kids are growing up fast", "We finally have the budget", "Saw a neighbour's pool"];
  }

  // Step 9: Concerns
  if (lower.includes("worried") || lower.includes("concern") || lower.includes("stories")) {
    return ["Hidden costs", "Timeline delays", "Quality of work", "No concerns!"];
  }

  // Step 10: Decision maker
  if (lower.includes("decision") || lower.includes("final call") || lower.includes("partner") || lower.includes("spouse")) {
    return ["Yes, just me", "My partner and I together", "Need to check with my spouse"];
  }

  // Step 11: Source
  if (lower.includes("hear about") || lower.includes("find us") || lower.includes("how did you")) {
    return ["Google search", "Social media", "Friend / neighbour", "Other"];
  }

  // Step 12 / phone
  if (lower.includes("phone") || lower.includes("best number") || lower.includes("reach you")) {
    return ["I'll share my number", "Prefer email instead"];
  }

  return [];
}

export default function QuickReplies({ suggestions, onSelect, disabled }: QuickRepliesProps) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2 animate-fade-in">
      {suggestions.map((text) => (
        <Button
          key={text}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className={cn(
            "rounded-full text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200",
            "hover:scale-105 active:scale-95"
          )}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
