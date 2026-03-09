import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Waves, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  step_number?: number;
}

const TOTAL_STEPS = 12;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversation-agent`;

interface ChatWidgetProps {
  leadId: string;
  leadName: string;
  onComplete?: () => void;
}

export default function ChatWidget({ leadId, leadName, onComplete }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const currentStep = messages.filter(m => m.role === "user").length + 1;
  const progress = Math.min((currentStep / TOTAL_STEPS) * 100, 100);

  // Load existing messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role as "assistant" | "user",
          content: m.content,
          step_number: m.step_number ?? undefined,
        })));
        // Check if done
        const lastMsg = data[data.length - 1];
        if (lastMsg.content.includes("✅") || lastMsg.content.includes("all set")) {
          setIsDone(true);
        }
      } else {
        // Trigger opening message
        sendToAgent(null);
      }
    };
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendToAgent = useCallback(async (userMessage: string | null) => {
    setIsStreaming(true);
    setIsTyping(true);

    // Show typing for 1-2s
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    setIsTyping(false);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          leadId,
          message: userMessage,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast.error("Too many requests — please wait a moment.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted.");
        } else {
          toast.error(errData.error || "Failed to get response");
        }

        // Check if done
        if (errData.done) {
          setIsDone(true);
          extractProfile();
          return;
        }
        setIsStreaming(false);
        return;
      }

      // Check if JSON (done signal) or stream
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.done) {
          setIsDone(true);
          extractProfile();
        }
        setIsStreaming(false);
        return;
      }

      // Stream SSE
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      const tempId = crypto.randomUUID();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === tempId) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { id: tempId, role: "assistant", content: assistantContent }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }

      // Check if the response indicates conversation is done
      if (assistantContent.includes("✅") || assistantContent.includes("all set")) {
        setIsDone(true);
        // Wait a moment then extract
        setTimeout(() => extractProfile(), 2000);
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Connection error — please try again.");
    } finally {
      setIsStreaming(false);
    }
  }, [leadId]);

  const extractProfile = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-agent", {
        body: { leadId, action: "extract" },
      });
      if (error) throw error;
      onComplete?.();
    } catch (e) {
      console.error("Extract error:", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Save user message via edge function which handles DB save
    await sendToAgent(text);
    inputRef.current?.focus();
  };

  return (
    <div className={cn(
      "flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-lg",
      isMobile ? "fixed inset-0 z-50 rounded-none" : "h-[600px]"
    )}>
      {/* Header */}
      <div className="bg-primary px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
          <Waves className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-foreground">Kai — Okeanos AI Assistant</p>
          <p className="text-xs text-primary-foreground/70">
            {isDone ? "Conversation complete ✅" : `Step ${Math.min(currentStep, TOTAL_STEPS)} of ${TOTAL_STEPS}`}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted shrink-0">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${isDone ? 100 : progress}%` }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-1 [&>p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Kai is typing</span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            </div>
          )}

          {isDone && (
            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-full px-4 py-2">
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Building your lead profile...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Conversation complete — profile sent to qualification
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {!isDone && (
        <div className="border-t border-border p-3 shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="flex-1 border-0 bg-muted/50 focus-visible:ring-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="shrink-0 rounded-full h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
