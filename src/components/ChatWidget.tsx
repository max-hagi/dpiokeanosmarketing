import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import ChatHeader from "@/components/chat/ChatHeader";
import TypingIndicator from "@/components/chat/TypingIndicator";
import QuickReplies, { getQuickReplies } from "@/components/chat/QuickReplies";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  step_number?: number;
}

const TOTAL_STEPS = 13;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversation-agent`;
const STORAGE_KEY = "okeanos_chat_session";

interface ChatWidgetProps {
  leadId: string;
  leadName: string;
  onComplete?: () => void;
}

function saveChatSession(leadId: string, leadName: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leadId, leadName, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function getSavedChatSession(): { leadId: string; leadName: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { leadId: data.leadId, leadName: data.leadName };
  } catch {
    return null;
  }
}

export function clearChatSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function ChatWidget({ leadId, leadName, onComplete }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const userMsgCount = messages.filter(m => m.role === "user").length;
  const currentStep = userMsgCount + 1;
  const progress = Math.min((currentStep / TOTAL_STEPS) * 100, 100);

  useEffect(() => {
    saveChatSession(leadId, leadName);
  }, [leadId, leadName]);

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant")?.content || "";
  const quickReplies = isDone || isStreaming || isTyping ? [] : getQuickReplies(userMsgCount, lastAssistantMsg);

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
        const lastMsg = data[data.length - 1];
        if (lastMsg.content.includes("✅") || lastMsg.content.includes("all set")) {
          setIsDone(true);
        }
      } else {
        sendToAgent(null);
      }
    };
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const sendToAgent = useCallback(async (userMessage: string | null) => {
    if (isStreaming) return;
    setIsStreaming(true);
    setIsTyping(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
    setIsTyping(false);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ leadId, message: userMessage }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Too many requests — please wait a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error(errData.error || "Failed to get response");
        if (errData.done) { setIsDone(true); extractProfile(); return; }
        setIsStreaming(false);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.done) { setIsDone(true); extractProfile(); }
        setIsStreaming(false);
        return;
      }

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

      // Check for closing signals - server now handles extraction automatically
      // Only detect closing on final message — NOT "personalized quote" which appears in step 12 phone request
      const isClosing = assistantContent.includes("✅") || assistantContent.includes("all set") || 
        assistantContent.includes("keep an eye on your inbox") || assistantContent.includes("We'll be in touch soon");
      if (isClosing) {
        setIsDone(true);
        // Server-side auto-extraction handles the pipeline now, but call as backup
        setTimeout(() => extractProfile(), 3000);
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Connection error — please try again.");
    } finally {
      setIsStreaming(false);
    }
  }, [leadId, isStreaming]);

  const extractProfile = async () => {
    setIsExtracting(true);
    try {
      const { error } = await supabase.functions.invoke("conversation-agent", {
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

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setShowEndConfirm(false);

    await sendToAgent(msg);
    inputRef.current?.focus();
  };

  const handleEndChat = () => {
    if (showEndConfirm) {
      setIsDone(true);
      extractProfile();
      setShowEndConfirm(false);
    } else {
      setShowEndConfirm(true);
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-xl",
      isMobile ? "fixed inset-0 z-50 rounded-none" : "h-[620px]"
    )}>
      <ChatHeader
        isDone={isDone}
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        progress={progress}
        onEndChat={handleEndChat}
        isStreaming={isStreaming}
      />

      {showEndConfirm && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <span className="text-xs text-foreground">End the conversation? We'll save your progress.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowEndConfirm(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleEndChat}>End Chat</Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={cn(
                "flex animate-fade-in",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
              style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm shadow-md"
                  : "bg-muted text-foreground rounded-bl-sm"
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

          {isTyping && <TypingIndicator />}

          {isDone && (
            <div className="flex justify-center pt-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-full px-5 py-2.5 shadow-sm">
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Wrapping things up...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    All done! We'll be in touch soon 🎉
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Replies */}
      {quickReplies.length > 0 && (
        <QuickReplies
          suggestions={quickReplies}
          onSelect={(text) => handleSend(text)}
          disabled={isStreaming}
        />
      )}

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
