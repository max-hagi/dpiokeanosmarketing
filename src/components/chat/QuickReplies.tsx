import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

// Determine quick replies based on the last assistant message content
export function getQuickReplies(userMessageCount: number, lastAssistantMessage: string): string[] {
  const lower = lastAssistantMessage.toLowerCase();
  
  // Don't show suggestions if there's no assistant message yet
  if (!lastAssistantMessage) return [];

  // Step 1: Ready to start?
  if (lower.includes("ready") || lower.includes("get started") || lower.includes("shall we")) {
    return ["Let's do it! 🏊", "Sounds good!", "Ready when you are"];
  }

  // Step 2: Homeowner or contractor?
  if ((lower.includes("homeowner") && lower.includes("contractor")) || lower.includes("landscaper")) {
    return ["I'm a homeowner", "I'm a contractor"];
  }

  // Step 3: Location — what city/area
  if (lower.includes("city") || lower.includes("area") || lower.includes("where in ontario") || lower.includes("located")) {
    return ["Toronto area", "Brampton", "Mississauga", "Somewhere else"];
  }

  // Step 4: Backyard access
  if (lower.includes("backyard") || lower.includes("truck") || lower.includes("access")) {
    return ["Yes, plenty of room", "It's a tight squeeze", "I'm not sure"];
  }

  // Step 5: Timeline
  if (lower.includes("hoping to have") || lower.includes("when are you") || lower.includes("timeline") || lower.includes("pool ready")) {
    return ["As soon as possible!", "This summer ☀️", "Sometime next year", "Just exploring"];
  }

  // Step 6: Budget
  if (lower.includes("budget") || lower.includes("$45,000") || lower.includes("invest") || lower.includes("spend")) {
    return ["Under $30K", "Around $30–50K", "$50–80K", "Still figuring it out"];
  }

  // Step 7: Vision / pool dreams
  if (lower.includes("vision") || lower.includes("dream") || lower.includes("shape") || lower.includes("size") || lower.includes("features")) {
    return ["Something classic & simple", "Fun for the whole family", "Lap pool for fitness"];
  }

  // Step 8: Trigger — what pushed you
  if (lower.includes("someday") || lower.includes("pushed") || lower.includes("what made you") || lower.includes("looking at now")) {
    return ["The kids are growing up", "We finally saved enough", "Neighbour got one 😄"];
  }

  // Step 9: Concerns
  if (lower.includes("worried") || lower.includes("concern") || lower.includes("stories") || lower.includes("not-so-great")) {
    return ["Hidden costs 😬", "Delays / timeline", "Quality of work", "Nothing specific!"];
  }

  // Step 10: Decision maker
  if (lower.includes("decision") || lower.includes("final call") || lower.includes("partner") || lower.includes("spouse")) {
    return ["Just me!", "My partner and I decide together", "Need to chat with my spouse"];
  }

  // Step 11: Source — how did you hear about us
  if (lower.includes("hear about") || lower.includes("find us") || lower.includes("how did you")) {
    return ["Google", "Instagram / Facebook", "A friend told me", "Other"];
  }

  // Step 12: Phone number
  if (lower.includes("phone") || lower.includes("best number") || lower.includes("reach you") || lower.includes("call you")) {
    return ["I'll type my number", "Email works best for me"];
  }

  // Generic fallback — don't show stale suggestions
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
            "rounded-full text-xs font-medium border-primary/20 bg-primary/5 text-primary",
            "hover:bg-primary hover:text-primary-foreground hover:border-primary",
            "transition-all duration-200 hover:scale-[1.03] active:scale-95 shadow-sm"
          )}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
