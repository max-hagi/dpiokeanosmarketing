import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, XCircle, RefreshCw, Copy, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type PlatformType = Database["public"]["Enums"]["platform_type"];

const platforms: { value: PlatformType; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "website", label: "Website / Blog" },
  { value: "other", label: "Other" },
];

export default function ReviewContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tweakNotes, setTweakNotes] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | "">("");

  const { data: request, isLoading: reqLoading } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_requests")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contentVersions, isLoading: contentLoading } = useQuery({
    queryKey: ["content-versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_content")
        .select("*")
        .eq("request_id", id!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const latestContent = contentVersions?.[0];

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!latestContent || !selectedPlatform) return;

      await supabase
        .from("generated_content")
        .update({ is_approved: true, target_platform: selectedPlatform })
        .eq("id", latestContent.id);

      await supabase
        .from("content_requests")
        .update({ status: "approved" })
        .eq("id", id!);

      await supabase.from("audit_log").insert({
        request_id: id,
        content_id: latestContent.id,
        action: "content_approved",
        details: { platform: selectedPlatform, version: latestContent.version },
      });
    },
    onSuccess: () => {
      toast.success("Content approved!");
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["content-versions", id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("content_requests")
        .update({ status: "rejected" })
        .eq("id", id!);

      await supabase.from("audit_log").insert({
        request_id: id,
        content_id: latestContent?.id,
        action: "content_rejected",
        details: { reason: tweakNotes },
      });
    },
    onSuccess: () => {
      toast.info("Content rejected.");
      queryClient.invalidateQueries({ queryKey: ["request", id] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!request) return;

      const combinedPrompt = tweakNotes
        ? `${request.prompt}\n\nRevision notes: ${tweakNotes}`
        : request.prompt;

      await supabase
        .from("content_requests")
        .update({ status: "draft" })
        .eq("id", id!);

      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt: combinedPrompt,
          contentType: request.content_type,
          targetAudience: request.target_audience,
          additionalContext: request.additional_context,
          requestId: id,
          generateImage: !!latestContent?.image_url,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("New version generated!");
      setTweakNotes("");
      queryClient.invalidateQueries({ queryKey: ["content-versions", id] });
      queryClient.invalidateQueries({ queryKey: ["request", id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate");
    },
  });

  const copyToClipboard = () => {
    if (latestContent?.text_content) {
      navigator.clipboard.writeText(latestContent.text_content);
      toast.success("Copied to clipboard!");
    }
  };

  if (reqLoading || contentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return <div className="text-center py-12 text-muted-foreground">Request not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Review Content</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {request.content_type.replace("_", " ")} · Created {format(new Date(request.created_at), "MMM d, yyyy h:mm a")}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Original prompt */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Original Brief</h3>
        <p className="text-sm">{request.prompt}</p>
        {request.target_audience && (
          <p className="text-xs text-muted-foreground mt-2">Audience: {request.target_audience}</p>
        )}
      </div>

      {/* Generated content */}
      {latestContent ? (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold">
              Generated Content <span className="text-muted-foreground text-sm font-normal">v{latestContent.version}</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>

          {latestContent.text_content && (
            <div className="prose prose-sm max-w-none bg-muted/50 rounded-lg p-4">
              <ReactMarkdown>{latestContent.text_content}</ReactMarkdown>
            </div>
          )}

          {latestContent.image_url && (
            <div className="mt-4">
              <img
                src={latestContent.image_url}
                alt="Generated marketing content"
                className="rounded-lg max-h-96 object-cover w-full"
              />
            </div>
          )}

          {/* Version history */}
          {contentVersions && contentVersions.length > 1 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                {contentVersions.length} versions generated
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {request.status === "generating" ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating content...
            </div>
          ) : (
            "No content generated yet."
          )}
        </div>
      )}

      {/* Actions */}
      {latestContent && request.status !== "posted" && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="font-heading font-semibold">Actions</h3>

          <div className="space-y-2">
            <Label className="text-sm">Request Tweaks (optional)</Label>
            <Textarea
              placeholder="e.g., Make the tone more casual, add a pool maintenance tip..."
              value={tweakNotes}
              onChange={(e) => setTweakNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Target Platform</Label>
            <Select value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as PlatformType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform for posting" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={!selectedPlatform || approveMutation.isPending}
              className="gap-2 flex-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="gap-2 flex-1"
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
            <Button
              variant="ghost"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
