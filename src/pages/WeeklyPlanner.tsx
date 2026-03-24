import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Loader2, Search, ChevronDown, Copy, RefreshCw, Clipboard,
  Image as ImageIcon, Pencil, Archive, Send, Video, CheckCircle2,
  Calendar,
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

type Post = {
  platform: string;
  content_type: string;
  trend_tag: string;
  caption: string;
  hashtags: string[];
  visual_direction: string;
  image_prompt: string;
  video_hook: string | null;
};

type Trend = {
  summary: string;
  source: string;
};

const platformOptions = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X/Twitter" },
];

const contentMixOptions = [
  { key: "educational", label: "Educational" },
  { key: "behind_the_scenes", label: "Behind the scenes" },
  { key: "trend_driven", label: "Trend-driven" },
  { key: "promotional", label: "Promotional" },
  { key: "social_proof", label: "Social proof" },
];

const toneOptions = [
  { value: "informative", label: "Informative" },
  { value: "exciting", label: "Exciting" },
  { value: "trust_building", label: "Trust-building" },
  { value: "seasonal", label: "Seasonal" },
  { value: "default", label: "Default (AI chooses)" },
];

const platformColors: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  tiktok: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  x: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

const contentTypeColors: Record<string, string> = {
  reel: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  carousel: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  static: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  story: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  short_video: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [focusTheme, setFocusTheme] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "tiktok", "facebook"]);
  const [selectedMix, setSelectedMix] = useState<string[]>(["educational", "behind_the_scenes", "trend_driven", "promotional", "social_proof"]);
  const [tone, setTone] = useState("default");

  const [step, setStep] = useState<"idle" | "researching" | "generating" | "done">("idle");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendsOpen, setTrendsOpen] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [queuedPosts, setQueuedPosts] = useState<Set<number>>(new Set());

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  // Check which platforms are connected
  const { data: connections } = useQuery({
    queryKey: ["social-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_connections")
        .select("platform, is_active");
      if (error) throw error;
      return data;
    },
  });

  const connectionMap = new Map(
    (connections || []).map((c: any) => [c.platform, c.is_active])
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      setStep("researching");
      setTrends([]);
      setPosts([]);
      setTrendsOpen(true);
      setQueuedPosts(new Set());

      const { data, error } = await supabase.functions.invoke("weekly-planner", {
        body: {
          focusTheme: focusTheme || null,
          platforms: selectedPlatforms,
          contentMix: selectedMix,
          tone,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { trends: Trend[]; posts: Post[] };
    },
    onSuccess: (data) => {
      setTrends(data.trends);
      setStep("generating");
      setTimeout(() => {
        setPosts(data.posts);
        setStep("done");
        setTrendsOpen(false);
      }, 800);
    },
    onError: (error) => {
      setStep("idle");
      toast.error(error instanceof Error ? error.message : "Failed to generate plan");
    },
  });

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleMix = (key: string) => {
    setSelectedMix((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const copyCaption = (post: Post) => {
    const text = `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;
    navigator.clipboard.writeText(text);
    toast.success("Caption copied!");
  };

  const copyAllCaptions = () => {
    const text = posts
      .map((p, i) => `--- Post ${i + 1} (${p.platform}) ---\n${p.caption}\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("All captions copied!");
  };

  const openGenerateImage = (imagePrompt: string) => {
    setSearchParams({ tab: "generate", prefill: imagePrompt });
  };

  const saveToHistory = async (post: Post, index: number) => {
    try {
      const { error } = await supabase.from("content_requests").insert({
        prompt: post.caption,
        content_type: "social_post" as any,
        target_audience: "Homeowners",
        additional_context: JSON.stringify({
          source: "weekly_planner",
          week: weekLabel,
          platform: post.platform,
          content_type: post.content_type,
          trend_tag: post.trend_tag,
          visual_direction: post.visual_direction,
          image_prompt: post.image_prompt,
          video_hook: post.video_hook,
          hashtags: post.hashtags,
        }),
        status: "draft" as any,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
      toast.success(`Post ${index + 1} saved to Content History`);
    } catch (e) {
      toast.error("Failed to save post");
    }
  };

  // Queue a single post for publishing (save + format + queue)
  const queueForPublishing = async (post: Post, index: number) => {
    try {
      // 1. Save to content_requests
      const { data: request, error: reqError } = await supabase
        .from("content_requests")
        .insert({
          prompt: post.caption,
          content_type: "social_post" as any,
          target_audience: "Homeowners",
          additional_context: JSON.stringify({
            source: "weekly_planner",
            week: weekLabel,
            platform: post.platform,
            content_type: post.content_type,
            trend_tag: post.trend_tag,
            visual_direction: post.visual_direction,
            image_prompt: post.image_prompt,
            video_hook: post.video_hook,
            hashtags: post.hashtags,
          }),
          status: "queued" as any,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Call format-for-platform to create platform-specific queue entry
      const { data, error } = await supabase.functions.invoke("format-for-platform", {
        body: {
          requestId: request.id,
          platforms: [post.platform],
          caption: post.caption,
          hashtags: post.hashtags,
          imageUrl: null, // No image yet, can be added later
          mediaType: post.content_type === "reel" || post.content_type === "short_video" ? "video" : "image",
          videoHook: post.video_hook,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setQueuedPosts((prev) => new Set(prev).add(index));
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
      toast.success(`Post ${index + 1} queued for ${post.platform}!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue post");
    }
  };

  // Queue ALL posts at once
  const queueAllPosts = async () => {
    let successCount = 0;
    for (let i = 0; i < posts.length; i++) {
      if (queuedPosts.has(i)) continue; // Skip already queued
      try {
        await queueForPublishing(posts[i], i);
        successCount++;
      } catch {
        // Individual errors already toasted
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} posts queued for publishing!`);
    }
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditCaption(posts[idx].caption);
  };

  const saveEdit = (idx: number) => {
    setPosts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, caption: editCaption } : p))
    );
    setEditingIdx(null);
  };

  const isVideoContent = (contentType: string) =>
    ["reel", "short_video", "story"].includes(contentType);

  return (
    <div className="space-y-6">
      {/* FORM */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="font-heading text-xl font-bold">Generate This Week's Content Plan</h2>
          </div>

          {/* Theme */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Weekly theme or campaign focus (optional)</Label>
            <Input
              placeholder="e.g. Spring pool season, fiberglass vs concrete, Ontario backy..."
              value={focusTheme}
              onChange={(e) => setFocusTheme(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave blank and the AI will choose based on current trends</p>
          </div>

          {/* Platforms */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Platforms</Label>
            <div className="flex flex-wrap gap-3">
              {platformOptions.map((p) => (
                <label key={p.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedPlatforms.includes(p.key)}
                    onCheckedChange={() => togglePlatform(p.key)}
                  />
                  {p.label}
                  {connectionMap.get(p.key) && (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Content Mix */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Content Mix</Label>
            <div className="flex flex-wrap gap-3">
              {contentMixOptions.map((m) => (
                <label key={m.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedMix.includes(m.key)}
                    onCheckedChange={() => toggleMix(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tone for this week</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toneOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || selectedPlatforms.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {step === "researching" ? "Searching for trends..." : "Building your plan..."}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Research Trends & Generate Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* STATUS CARDS */}
      {step === "researching" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Searching for current trends...</span>
          </CardContent>
        </Card>
      )}

      {step === "generating" && trends.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Building your content plan...</span>
          </CardContent>
        </Card>
      )}

      {/* TRENDS FOUND */}
      {trends.length > 0 && step !== "researching" && (
        <Collapsible open={trendsOpen} onOpenChange={setTrendsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-t-lg">
                <span className="text-sm font-medium">Trends Found ({trends.length})</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${trendsOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {trends.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    <span>{t.summary}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">({t.source})</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">Plan generated using these trends</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* PLAN OUTPUT */}
      {step === "done" && posts.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              Week of {weekLabel} · {posts.length} posts · Platforms: {[...new Set(posts.map((p) => p.platform))].join(", ")} · Based on {trends.length} trends
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateMutation.mutate()}>
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyAllCaptions}>
                <Clipboard className="h-3.5 w-3.5" /> Copy All
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={queueAllPosts}
                disabled={queuedPosts.size === posts.length}
              >
                <Send className="h-3.5 w-3.5" />
                {queuedPosts.size === posts.length ? "All Queued" : "Queue All for Publishing"}
              </Button>
            </div>
          </div>

          {/* Post cards */}
          <div className="space-y-4">
            {posts.map((post, idx) => {
              const isQueued = queuedPosts.has(idx);
              const connected = connectionMap.get(post.platform);

              return (
                <Card key={idx} className={`overflow-hidden ${isQueued ? "border-green-300 dark:border-green-700" : ""}`}>
                  <CardContent className="p-5 space-y-4">
                    {/* Header badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={platformColors[post.platform] || ""}>{post.platform}</Badge>
                      <Badge variant="outline" className={contentTypeColors[post.content_type] || ""}>{post.content_type.replace("_", " ")}</Badge>
                      <Badge variant="secondary">{post.trend_tag}</Badge>
                      {isQueued && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Queued
                        </Badge>
                      )}
                      {connected && (
                        <span className="text-xs text-green-600 dark:text-green-400 ml-auto flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      )}
                      {!connected && (
                        <span className="text-xs text-muted-foreground ml-auto">Not connected</span>
                      )}
                    </div>

                    {/* Caption */}
                    <div className="space-y-2">
                      {editingIdx === idx ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={editCaption}
                            onChange={(e) => setEditCaption(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(idx)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {post.hashtags.map((h) => `#${h}`).join(" ")}
                      </p>
                    </div>

                    {/* Visual Direction */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Visual:</p>
                      <p className="text-sm">{post.visual_direction}</p>
                    </div>

                    {/* Image Prompt */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Image prompt</p>
                      <div
                        className="text-sm bg-muted/50 rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => { navigator.clipboard.writeText(post.image_prompt); toast.success("Image prompt copied!"); }}
                        title="Click to copy"
                      >
                        {post.image_prompt}
                      </div>
                    </div>

                    {/* Video Hook */}
                    {post.video_hook && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Video hook:</p>
                        <p className="text-sm italic">"{post.video_hook}"</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyCaption(post)}>
                        <Copy className="h-3.5 w-3.5" /> Copy Caption
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openGenerateImage(post.image_prompt)}>
                        <ImageIcon className="h-3.5 w-3.5" /> Generate Image
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startEdit(idx)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => saveToHistory(post, idx)}>
                        <Archive className="h-3.5 w-3.5" /> Save to History
                      </Button>
                      {!isQueued && (
                        <Button
                          size="sm"
                          className="gap-1.5 ml-auto"
                          onClick={() => queueForPublishing(post, idx)}
                        >
                          <Send className="h-3.5 w-3.5" /> Queue for Publishing
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
