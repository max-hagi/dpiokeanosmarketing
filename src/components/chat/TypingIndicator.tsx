import { Waves } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center h-6 w-6">
          <Waves className="h-4 w-4 text-primary animate-pulse" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Kai is thinking</span>
          <span className="flex gap-0.5 ml-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.8s' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '0.8s' }} />
          </span>
        </div>
      </div>
    </div>
  );
}
