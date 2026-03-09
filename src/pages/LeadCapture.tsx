import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

const budgetOptions = [
  { value: "under_30k", label: "Under $30,000" },
  { value: "30k_50k", label: "$30,000 – $50,000" },
  { value: "50k_80k", label: "$50,000 – $80,000" },
  { value: "80k_plus", label: "$80,000+" },
];

const timelineOptions = [
  { value: "asap", label: "ASAP" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "6_12_months", label: "6–12 months" },
  { value: "12_plus_months", label: "12+ months" },
];

const sourceOptions = [
  { value: "google", label: "Google" },
  { value: "social_media", label: "Social Media" },
  { value: "word_of_mouth", label: "Word of Mouth" },
  { value: "other", label: "Other" },
];

export default function LeadCapture() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Validate required fields
      if (!fullName.trim() || !email.trim() || !message.trim()) {
        throw new Error("Name, Email, and Message are required.");
      }

      // Detect missing high-value fields
      const missingFields: string[] = [];
      if (!budget) missingFields.push("budget");
      if (!timeline) missingFields.push("timeline");
      if (!location.trim()) missingFields.push("location");

      const leadStatus = missingFields.length === 0 ? "complete" : "incomplete";

      // Call edge function to process lead
      const { data, error } = await supabase.functions.invoke("process-lead", {
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          location: location.trim() || null,
          budget: budget || null,
          timeline: timeline || null,
          source: source || null,
          message: message.trim(),
          missingFields,
          leadStatus,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      setSubmittedName(fullName);
      setSubmitted(true);
      toast.success("Lead submitted successfully!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to submit inquiry");
    },
  });

  const resetForm = () => {
    setSubmitted(false);
    setFullName("");
    setEmail("");
    setPhone("");
    setLocation("");
    setBudget("");
    setTimeline("");
    setSource("");
    setMessage("");
    setSubmittedName("");
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold">Lead Capture</h1>
          <p className="text-muted-foreground mt-1">Collect and structure customer inquiries for Okeanos Ontario.</p>
        </div>
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <h2 className="font-heading text-2xl font-bold">Thank you, {submittedName}!</h2>
          <p className="text-muted-foreground">Our team will be in touch within 24 hours.</p>
          <Button variant="outline" onClick={resetForm} className="mt-4">
            Submit Another Inquiry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Lead Capture</h1>
        <p className="text-muted-foreground mt-1">
          Collect and structure customer inquiries for Okeanos Ontario.
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(416) 555-0123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium">City / Location in Ontario</Label>
            <Input
              id="location"
              placeholder="e.g., Toronto, Mississauga, Ottawa"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Approximate Budget</Label>
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger>
                <SelectValue placeholder="Select budget range" />
              </SelectTrigger>
              <SelectContent>
                {budgetOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estimated Timeline</Label>
            <Select value={timeline} onValueChange={setTimeline}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                {timelineOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">How did you hear about Okeanos?</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm font-medium">
            Message / Inquiry <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="message"
            placeholder="Tell us about your project — what kind of pool are you looking for, any questions about installation, timeline, pricing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!fullName.trim() || !email.trim() || !message.trim() || submitMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing Inquiry...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Inquiry
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
