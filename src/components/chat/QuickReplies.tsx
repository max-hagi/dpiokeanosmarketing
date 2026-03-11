import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

// Determine quick replies based on step number (derived from user message count)
export function getQuickReplies(userMessageCount: number, lastAssistantMessage: string): string[] {
  const lower = lastAssistantMessage.toLowerCase();

  if (!lastAssistantMessage) return [];

  // Step 1: Opening — "Ready to get started?"
  if (userMessageCount === 0) {
    return ["Let's do it! 🏊", "Sounds good!", "Ready when you are"];
  }

  // Step 2: Homeowner or contractor?
  if (userMessageCount === 1 && (lower.includes("homeowner") || lower.includes("contractor") || lower.includes("landscaper") || lower.includes("project"))) {
    return ["I'm a homeowner 🏠", "I'm a contractor / landscaper"];
  }

  // Step 3: Location
  if (userMessageCount === 2 && (lower.includes("city") || lower.includes("area") || lower.includes("ontario") || lower.includes("located") || lower.includes("where"))) {
    return ["Toronto / GTA", "Brampton / Mississauga", "Hamilton / Burlington", "Somewhere else in Ontario"];
  }

  // Step 4: Backyard access
  if (lower.includes("backyard") || lower.includes("truck") || lower.includes("access") || lower.includes("side of the house")) {
    return ["Yes, plenty of room 👍", "It's a tight squeeze", "I'm not sure — can you check?"];
  }

  // Step 5: Timeline
  if (lower.includes("hoping to have") || lower.includes("when are you") || lower.includes("timeline") || lower.includes("pool ready") || lower.includes("looking to get")) {
    return ["As soon as possible! ☀️", "This summer", "Planning for next year", "Just exploring options"];
  }

  // Step 6: Budget — anchored to Okeanos pricing
  if (lower.includes("budget") || lower.includes("$45,000") || lower.includes("invest") || lower.includes("spend") || lower.includes("price")) {
    return ["Under $30K — keeping it lean", "$30–50K range", "$50–80K — full package", "Still figuring that out"];
  }

  // Step 7: Vision / pool dreams
  if (lower.includes("vision") || lower.includes("dream") || lower.includes("shape") || lower.includes("size") || lower.includes("features") || lower.includes("picture")) {
    return ["Something classic & simple", "Family fun pool with a slide 🎉", "Lap pool for exercise", "I'd love some ideas!"];
  }

  // Step 8: What pushed you — trigger question
  if (lower.includes("someday") || lower.includes("pushed") || lower.includes("what made you") || lower.includes("looking at now") || lower.includes("why now")) {
    return ["The kids are growing up fast", "We finally saved enough 💰", "Neighbour got one and we're jealous 😄", "It's just been a long-time dream"];
  }

  // Step 9: Concerns — not-so-great stories
  if (lower.includes("worried") || lower.includes("concern") || lower.includes("stories") || lower.includes("not-so-great") || lower.includes("afraid")) {
    return ["Hidden costs worry me 😬", "Delays & timeline issues", "Quality of the work", "Honestly, nothing specific!"];
  }

  // Step 10: Decision maker
  if (lower.includes("decision") || lower.includes("final call") || lower.includes("partner") || lower.includes("spouse") || lower.includes("making the call")) {
    return ["Just me — I'm the boss 😎", "My partner and I decide together", "Need to check with my spouse first"];
  }

  // Step 11: How did you hear about us
  if (lower.includes("hear about") || lower.includes("find us") || lower.includes("how did you") || lower.includes("last one")) {
    return ["Found you on Google 🔍", "Saw you on Instagram / Facebook", "A friend recommended you", "Something else"];
  }

  // Step 12: Phone number
  if (lower.includes("phone") || lower.includes("best number") || lower.includes("reach you") || lower.includes("call you") || lower.includes("follow up")) {
    return ["I'll type my number now 📱", "Email is best for me"];
  }

  // Step 13: Closing — no suggestions needed
  if (lower.includes("keep an eye") || lower.includes("inbox") || lower.includes("all set") || lower.includes("✅")) {
    return [];
  }

  // Fallback — don't show stale suggestions
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
