import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight, Waves } from "lucide-react";
import ChatWidget from "@/components/ChatWidget";

export default function LeadCapture() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim() || !email.trim()) {
        throw new Error("Name and Email are required.");
      }

      // Create minimal lead record
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
      toast.error(error instanceof Error ? error.message : "Failed to start conversation");
    },
  });

  if (chatStarted && leadId) {
    return (
      <div className="max-w-2xl mx-auto">
        <ChatWidget
          leadId={leadId}
          leadName={fullName}
          onComplete={() => {
            toast.success("Lead profile built and sent to qualification!");
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-8">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Waves className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="font-heading text-3xl font-bold">Get Your Free Pool Quote</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Tell us your name and email to get started — our AI assistant will guide you through a quick 5-minute conversation to understand your project.
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
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
          />
        </div>

        <Button
          onClick={() => startMutation.mutate()}
          disabled={!fullName.trim() || !email.trim() || startMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {startMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
          ) : (
            <>Start Conversation <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You'll chat with Kai, our AI assistant. No obligation — just a friendly conversation about your pool project.
        </p>
      </div>
    </div>
  );
}
