import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ContentType = Database["public"]["Enums"]["content_type"];

const contentTypes: { value: ContentType; label: string }[] = [
  { value: "social_post", label: "Social Media Post" },
  { value: "blog_article", label: "Blog Article" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "caption", label: "Caption" },
  { value: "image", label: "Image Only" },
];

const audiences = [
  "Homeowners",
  "Landscapers",
  "Home Builders",
  "Young Families",
  "General",
];

export default function CreateContent() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<ContentType>("social_post");
  const [targetAudience, setTargetAudience] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generateImage, setGenerateImage] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // 1. Create the request
      const { data: request, error: reqError } = await supabase
        .from("content_requests")
        .insert({
          prompt,
          content_type: contentType,
          target_audience: targetAudience || null,
          additional_context: additionalContext || null,
          status: "draft",
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Call the edge function
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt,
          contentType,
          targetAudience,
          additionalContext,
          requestId: request.id,
          generateImage,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return request.id;
    },
    onSuccess: (requestId) => {
      toast.success("Content generated! Review it now.");
      navigate(`/review/${requestId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to generate content");
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Create Content</h1>
        <p className="text-muted-foreground mt-1">
          Describe what you want to market and the AI agent will create on-brand content for Okeanos Ontario.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-sm font-medium">What should this content be about?</Label>
          <Textarea
            id="prompt"
            placeholder="e.g., Promote our 2-day pool installation speed for the summer season. Highlight how families can enjoy their pool this summer instead of waiting months."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Content Type</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Audience</Label>
            <Select value={targetAudience} onValueChange={setTargetAudience}>
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                {audiences.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="context" className="text-sm font-medium">Additional Context (optional)</Label>
          <Input
            id="context"
            placeholder="e.g., We have a spring promotion running, mention 10% off..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted p-4">
          <div>
            <p className="font-medium text-sm">Generate Image</p>
            <p className="text-xs text-muted-foreground">AI will create a matching marketing image</p>
          </div>
          <Switch checked={generateImage} onCheckedChange={setGenerateImage} />
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={!prompt.trim() || generateMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Content...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
