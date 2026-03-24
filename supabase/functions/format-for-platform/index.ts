import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Platform-specific formatting rules
const PLATFORM_RULES: Record<string, {
  maxCaptionLength: number;
  maxHashtags: number;
  hashtagStyle: "end" | "inline" | "first_comment";
  preferredAspectRatio: string;
  toneGuidance: string;
}> = {
  instagram: {
    maxCaptionLength: 2200,
    maxHashtags: 30,
    hashtagStyle: "end",
    preferredAspectRatio: "4:5",
    toneGuidance: "Warm, visual-first. Strong hook in first line (this shows before 'more'). Use line breaks for readability. Emojis are welcome but not excessive. End with a clear CTA.",
  },
  tiktok: {
    maxCaptionLength: 4000,
    maxHashtags: 8,
    hashtagStyle: "inline",
    preferredAspectRatio: "9:16",
    toneGuidance: "Casual, punchy, trend-aware. Lead with a hook that stops the scroll. Keep it short and snappy. Hashtags woven naturally into the caption. Reference the video content directly.",
  },
  facebook: {
    maxCaptionLength: 63206,
    maxHashtags: 5,
    hashtagStyle: "end",
    preferredAspectRatio: "16:9",
    toneGuidance: "Conversational and community-oriented. Longer storytelling is fine. Ask questions to drive comments. Minimal hashtags (Facebook penalizes hashtag spam). Include a link or CTA naturally.",
  },
  linkedin: {
    maxCaptionLength: 3000,
    maxHashtags: 5,
    hashtagStyle: "end",
    preferredAspectRatio: "1.91:1",
    toneGuidance: "Professional but approachable. Lead with an insight or industry observation. Use short paragraphs. Position Okeanos as a thought leader. Hashtags at the very end, industry-relevant only.",
  },
  x: {
    maxCaptionLength: 280,
    maxHashtags: 3,
    hashtagStyle: "inline",
    preferredAspectRatio: "16:9",
    toneGuidance: "Extremely concise. One strong statement or question. Hashtags woven into the tweet naturally (not tacked on). No emojis unless they replace words. Link in reply, not in tweet.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      requestId,
      contentId,
      platforms,
      caption,
      hashtags,
      imageUrl,
      videoUrl,
      mediaType,
      videoHook,
      scheduledFor,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check which platforms have active connections
    const { data: connections } = await supabase
      .from("social_connections")
      .select("platform, id, is_active");

    const connectionMap = new Map(
      (connections || []).map((c: any) => [c.platform, c])
    );

    const queueEntries: any[] = [];

    for (const platform of platforms) {
      const rules = PLATFORM_RULES[platform];
      if (!rules) continue;

      // Use AI to reformat the caption for this specific platform
      const formatPrompt = `You are formatting a social media post for ${platform.toUpperCase()}.

ORIGINAL CAPTION:
${caption}

ORIGINAL HASHTAGS:
${(hashtags || []).map((h: string) => `#${h}`).join(" ")}

PLATFORM RULES:
- Max caption length: ${rules.maxCaptionLength} characters
- Max hashtags: ${rules.maxHashtags}
- Hashtag placement: ${rules.hashtagStyle === "end" ? "at the end of caption" : rules.hashtagStyle === "inline" ? "woven into the text" : "separate (will go in first comment)"}
- Tone: ${rules.toneGuidance}

${mediaType === "video" && videoHook ? `VIDEO HOOK (first on-screen text): "${videoHook}"` : ""}

Rewrite the caption specifically for ${platform}. Keep the core message but adapt tone, length, and structure to what performs best on this platform. Return a JSON object with:
- formatted_caption: the rewritten caption (WITHOUT hashtags if hashtagStyle is "end" or "first_comment")
- formatted_hashtags: array of hashtag strings (without # prefix), max ${rules.maxHashtags}`;

      const formatResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a social media formatting expert for Okeanos Fiberglass Pools. Return only valid JSON with formatted_caption and formatted_hashtags fields.",
              },
              { role: "user", content: formatPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "return_formatted",
                  description: "Return the platform-formatted content",
                  parameters: {
                    type: "object",
                    properties: {
                      formatted_caption: { type: "string" },
                      formatted_hashtags: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["formatted_caption", "formatted_hashtags"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "return_formatted" },
            },
          }),
        }
      );

      let formattedCaption = caption;
      let formattedHashtags = hashtags || [];

      if (formatResponse.ok) {
        const formatData = await formatResponse.json();
        try {
          const toolCall =
            formatData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            formattedCaption = parsed.formatted_caption || caption;
            formattedHashtags = (
              parsed.formatted_hashtags || hashtags || []
            ).slice(0, rules.maxHashtags);
          }
        } catch (e) {
          console.error(`Failed to parse formatted content for ${platform}:`, e);
        }
      }

      // Determine media URL and aspect ratio
      const mediaUrl = videoUrl || imageUrl || null;
      const aspectRatio = rules.preferredAspectRatio;
      const connection = connectionMap.get(platform);

      const entry = {
        request_id: requestId,
        content_id: contentId || null,
        platform,
        formatted_caption: formattedCaption,
        formatted_hashtags: formattedHashtags,
        media_url: mediaUrl,
        media_type: mediaType || "image",
        aspect_ratio: aspectRatio,
        video_hook_text: videoHook || null,
        scheduled_for: scheduledFor || null,
        posting_status: scheduledFor ? "scheduled" : "queued",
        connection_id: connection?.id || null,
      };

      queueEntries.push(entry);
    }

    // Insert all queue entries
    const { data: inserted, error: insertError } = await supabase
      .from("content_queue")
      .insert(queueEntries)
      .select();

    if (insertError) throw insertError;

    // Update content request status
    await supabase
      .from("content_requests")
      .update({ status: scheduledFor ? "scheduled" : "queued" })
      .eq("id", requestId);

    // Audit log
    await supabase.from("audit_log").insert({
      request_id: requestId,
      action: "content_queued",
      details: {
        platforms,
        queue_count: inserted?.length || 0,
        scheduled_for: scheduledFor || null,
        media_type: mediaType || "image",
      },
    });

    return new Response(
      JSON.stringify({ success: true, queued: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("format-for-platform error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
