import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Send, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Calendar, RefreshCw, Eye, Trash2, RotateCcw, ImageIcon,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  queued: { label: "Queued", icon: Clock, className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", icon: Calendar, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  posting: { label: "Posting...", icon: Loader2, className: "bg-primary/10 text-primary animate-pulse" },
  posted: { label: "Posted", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  failed: { label: "Failed", icon: AlertTriangle, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const platformColors: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  tiktok: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  x: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

const tabs = [
  { key: "pending", label: "Pending" },
  { key: "posted", label: "Posted" },
  { key: "failed", label: "Failed" },
];

export default function PublishingQueue() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ["content-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_queue")
        .select("*, content_requests(prompt, content_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Poll every 10s for status updates
  });

  const { data: connections } = useQuery({
    queryKey: ["social-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_connections")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const connectionMap = new Map(
    (connections || []).map((c: any) => [c.platform, c])
  );

  const publishMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { data, error } = await supabase.functions.invoke("publish-content", {
        body: { queueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Content posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to post content");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (queueId: string) => {
      // Reset to queued, then try publishing
      await supabase
        .from("content_queue")
        .update({ posting_status: "queued", error_message: null })
        .eq("id", queueId);
      const { data, error } = await supabase.functions.invoke("publish-content", {
        body: { queueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Retry successful!");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Retry failed");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from("content_queue")
        .delete()
        .eq("id", queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from queue");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
    onError: () => toast.error("Failed to remove from queue"),
  });

  const [generatingMedia, setGeneratingMedia] = useState<Set<string>>(new Set());

  const generateMediaMutation = useMutation({
    mutationFn: async (queueId: string) => {
      setGeneratingMedia((prev) => new Set(prev).add(queueId));
      const { data, error } = await supabase.functions.invoke("generate-queue-media", {
        body: { queueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, queueId) => {
      setGeneratingMedia((prev) => { const next = new Set(prev); next.delete(queueId); return next; });
      toast.success("Media generated!");
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
    onError: (error, queueId) => {
      setGeneratingMedia((prev) => { const next = new Set(prev); next.delete(queueId); return next; });
      toast.error(error instanceof Error ? error.message : "Failed to generate media");
    },
  });
  const filteredByTab = (queueItems || []).filter((item: any) => {
    if (activeTab === "pending") return ["queued", "scheduled", "posting"].includes(item.posting_status);
    if (activeTab === "posted") return item.posting_status === "posted";
    if (activeTab === "failed") return item.posting_status === "failed";
    return true;
  });

  // Search filter
  const filtered = filteredByTab.filter((item: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.formatted_caption?.toLowerCase().includes(s) ||
      item.platform?.toLowerCase().includes(s) ||
      item.content_requests?.prompt?.toLowerCase().includes(s)
    );
  });

  const pendingCount = (queueItems || []).filter((i: any) => ["queued", "scheduled", "posting"].includes(i.posting_status)).length;
  const failedCount = (queueItems || []).filter((i: any) => i.posting_status === "failed").length;

  const isConnected = (platform: string) => {
    const conn = connectionMap.get(platform);
    return conn?.is_active === true;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search queue by caption or platform..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "pending" && pendingCount > 0 && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
              {t.key === "failed" && failedCount > 0 && (
                <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">{failedCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Queue list */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading queue...</div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {activeTab === "pending" ? "No content in the queue. Generate content from the Weekly Planner and approve it to start queuing." :
             activeTab === "posted" ? "No posted content yet." :
             "No failed posts."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => {
            const status = statusConfig[item.posting_status] || statusConfig.queued;
            const StatusIcon = status.icon;
            const connected = isConnected(item.platform);
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="glass-card rounded-xl overflow-hidden shadow-sm"
              >
                <div
                  className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Platform + status badges */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Badge variant="outline" className={platformColors[item.platform] || ""}>
                      {item.platform}
                    </Badge>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                      <StatusIcon className={`h-3 w-3 ${item.posting_status === "posting" ? "animate-spin" : ""}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Caption preview */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{item.formatted_caption}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {item.media_type} · {item.aspect_ratio}
                      </span>
                      {item.scheduled_for && (
                        <span className="text-xs text-muted-foreground">
                          · {isPast(new Date(item.scheduled_for))
                              ? `Was scheduled ${formatDistanceToNow(new Date(item.scheduled_for), { addSuffix: true })}`
                              : `Scheduled ${format(new Date(item.scheduled_for), "MMM d 'at' h:mm a")}`}
                        </span>
                      )}
                      {item.posted_at && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          · Posted {formatDistanceToNow(new Date(item.posted_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    {item.error_message && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.error_message}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.posting_status === "queued" && (
                      <>
                        {connected ? (
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={(e) => { e.stopPropagation(); publishMutation.mutate(item.id); }}
                            disabled={publishMutation.isPending}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Post Now
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                            Connect {item.platform} in Settings
                          </span>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove from queue?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove this post from the publishing queue. The original content will remain in Content History.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {item.posting_status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={(e) => { e.stopPropagation(); retryMutation.mutate(item.id); }}
                        disabled={retryMutation.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    )}
                    {item.posting_status === "posted" && item.external_post_id && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Full caption</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{item.formatted_caption}</p>
                    </div>
                    {item.formatted_hashtags && item.formatted_hashtags.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Hashtags</p>
                        <p className="text-xs text-muted-foreground">
                          {item.formatted_hashtags.map((h: string) => `#${h}`).join(" ")}
                        </p>
                      </div>
                    )}
                    {item.media_url && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Media</p>
                        {item.media_type === "video" ? (
                          <video src={item.media_url} controls className="rounded-lg max-h-48 w-full object-cover" />
                        ) : (
                          <img src={item.media_url} alt="Post media" className="rounded-lg max-h-48 object-cover" />
                        )}
                      </div>
                    )}
                    {item.video_hook_text && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Video hook text</p>
                        <p className="text-sm italic">"{item.video_hook_text}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
