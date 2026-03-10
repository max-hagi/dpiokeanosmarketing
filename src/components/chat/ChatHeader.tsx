import { Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  isDone: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  onEndChat?: () => void;
  isStreaming: boolean;
}

export default function ChatHeader({ isDone, currentStep, totalSteps, progress, onEndChat, isStreaming }: ChatHeaderProps) {
  return (
    <>
      <div className="bg-primary px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
          <Waves className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-foreground">Kai — Okeanos AI Assistant</p>
          <p className="text-xs text-primary-foreground/70">
            {isDone ? "Conversation complete ✅" : `Step ${Math.min(currentStep, totalSteps)} of ${totalSteps}`}
          </p>
        </div>
        {!isDone && onEndChat && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEndChat}
            disabled={isStreaming}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
            title="End conversation early"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* Progress Bar */}
      <div className="h-1.5 bg-muted shrink-0 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${isDone ? 100 : progress}%` }}
        />
      </div>
    </>
  );
}
