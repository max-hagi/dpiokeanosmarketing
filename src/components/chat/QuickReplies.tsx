import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickRepliesProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

/**
 * Step-based quick replies aligned to the 13-step conversation flow.
 * Uses userMessageCount as the primary selector since the conversation is sequential.
 */
export function getQuickReplies(userMessageCount: number, _lastAssistantMessage: string): string[] {
  // No replies before the first assistant message
  if (!_lastAssistantMessage) return [];

  switch (userMessageCount) {
    // Step 1 — Opening: "Ready to get started?"
    case 0:
      return ["Let's do it! 🏊", "Sounds good!", "Ready when you are"];

    // Step 2 — "Are you a homeowner or contractor?"
    case 1:
      return ["I'm a homeowner 🏠", "I'm a contractor / landscaper"];

    // Step 3 — "What city/area of Ontario are you in?"
    case 2:
      return ["Toronto / GTA", "Brampton / Mississauga", "Hamilton / Burlington", "Somewhere else in Ontario"];

    // Step 4 — "How's backyard access? Can a truck fit through?"
    case 3:
      return ["Yes, plenty of room 👍", "It's a tight squeeze", "I'm not sure"];

    // Step 5 — "When are you hoping to have the pool ready?"
    case 4:
      return ["As soon as possible! ☀️", "This summer", "Planning for next year", "Just exploring options"];

    // Step 6 — "What's your rough budget?" (anchored to $45k–$75k)
    case 5:
      return ["Under $30K — keeping it lean", "$30–50K range", "$50–80K — full package", "Still figuring that out"];

    // Step 7 — "What's your vision? Size, shape, features?"
    case 6:
      return ["Something classic & simple", "Family fun pool with a slide 🎉", "Lap pool for exercise", "I'd love some ideas!"];

    // Step 8 — "What pushed this from 'someday' to now?"
    case 7:
      return ["The kids are growing up fast", "We finally saved enough 💰", "Neighbour got one and we're jealous 😄", "It's just been a long-time dream"];

    // Step 9 — "Any concerns about the process?"
    case 8:
      return ["Hidden costs worry me 😬", "Delays & timeline issues", "Quality of the work", "Honestly, nothing specific!"];

    // Step 10 — "Will you be the one making the final call?"
    case 9:
      return ["Just me — I'm the boss 😎", "My partner and I decide together", "Need to check with my spouse first"];

    // Step 11 — "How did you hear about us?"
    case 10:
      return ["Found you on Google 🔍", "Saw you on Instagram / Facebook", "A friend recommended you", "Something else"];

    // Step 12 — "What's the best phone number to reach you?"
    case 11:
      return ["I'll type my number now 📱", "Email is best for me"];

    // Step 13+ — Closing, no suggestions
    default:
      return [];
  }
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
