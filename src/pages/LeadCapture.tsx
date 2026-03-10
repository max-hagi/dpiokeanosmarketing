import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight, Waves, ShieldCheck, Clock, MessageSquare } from "lucide-react";
import ChatWidget, { getSavedChatSession } from "@/components/ChatWidget";

export default function LeadCapture() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);

  // Restore previous session
  useEffect(() => {
    const saved = getSavedChatSession();
    if (saved) {
      setLeadId(saved.leadId);
      setFullName(saved.leadName);
      setChatStarted(true);
    }
  }, []);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim() || !email.trim()) {
        throw new Error("Name and Email are required.");
      }

      const { data, error } = await supabase.functions.invoke("process-lead", {
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: null,
          location: null,
          mailingAddress: null,
          budget: null,
          timeline: null,
          source: null,
          preferredContact: null,
          referralSource: null,
          campaignId: null,
          keywordSource: null,
          message: "Started conversation with Kai (AI assistant)",
          missingFields: ["phone", "location", "budget", "timeline"],
          leadStatus: "incomplete",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setLeadId(data.lead.id);
      setChatStarted(true);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    },
  });

  if (chatStarted && leadId) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <ChatWidget
          leadId={leadId}
          leadName={fullName}
          onComplete={() => {
            toast.success("Thanks! We'll be in touch with your personalized quote.");
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success border-2 border-card flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-success-foreground" />
            </div>
          </div>
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Get Your Free Pool Quote</h1>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 leading-relaxed">
            Chat with Kai, our friendly AI assistant, for a quick 5-minute conversation about your dream pool.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            placeholder="John Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>

        <Button
          onClick={() => startMutation.mutate()}
          disabled={!fullName.trim() || !email.trim() || startMutation.isPending}
          className="w-full gap-2 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-shadow"
          size="lg"
        >
          {startMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
          ) : (
            <>Start Conversation <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        {/* Trust signals */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { icon: Clock, label: "5 min chat" },
            { icon: ShieldCheck, label: "No obligation" },
            { icon: MessageSquare, label: "Instant reply" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
