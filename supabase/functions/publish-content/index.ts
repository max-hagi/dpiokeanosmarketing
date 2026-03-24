import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =============================================================
// Platform posting functions
// Each returns { success, externalPostId?, error? }
// These are STUBS ready for real API integration
// =============================================================

async function postToInstagram(
  connection: any,
  caption: string,
  hashtags: string[],
  mediaUrl: string | null,
  mediaType: string
): Promise<{ success: boolean; externalPostId?: string; error?: string }> {
  if (!connection?.access_token || !connection?.page_id) {
    return { success: false, error: "Instagram not connected. Add your Meta API credentials in Settings." };
  }

  // Meta Graph API flow:
  // 1. Upload media container: POST /{ig-user-id}/media with image_url + caption
  // 2. Publish: POST /{ig-user-id}/media_publish with creation_id
  //
  // For Reels (video):
  // 1. POST /{ig-user-id}/media with video_url, media_type=REELS, caption
  // 2. Poll GET /{container-id}?fields=status_code until FINISHED
  // 3. POST /{ig-user-id}/media_publish

  const fullCaption = hashtags.length > 0
    ? `${caption}\n\n${hashtags.map(h => `#${h}`).join(" ")}`
    : caption;

  try {
    const pageId = connection.page_id;
    const token = connection.access_token;

    // Step 1: Create media container
    const containerBody: Record<string, string> = {
      caption: fullCaption,
      access_token: token,
    };

    if (mediaType === "video") {
      containerBody.media_type = "REELS";
      containerBody.video_url = mediaUrl || "";
    } else {
      containerBody.image_url = mediaUrl || "";
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );

    const containerData = await containerRes.json();
    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    const creationId = containerData.id;

    // Step 2: For video, poll until ready
    if (mediaType === "video") {
      let status = "IN_PROGRESS";
      let attempts = 0;
      while (status === "IN_PROGRESS" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(
          `https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token}`
        );
        const statusData = await statusRes.json();
        status = statusData.status_code;
        attempts++;
      }
      if (status !== "FINISHED") {
        return { success: false, error: `Video processing failed: ${status}` };
      }
    }

    // Step 3: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: token,
        }),
      }
    );

    const publishData = await publishRes.json();
    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    return { success: true, externalPostId: publishData.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Instagram API error" };
  }
}

async function postToFacebook(
  connection: any,
  caption: string,
  hashtags: string[],
  mediaUrl: string | null,
  mediaType: string
): Promise<{ success: boolean; externalPostId?: string; error?: string }> {
  if (!connection?.access_token || !connection?.page_id) {
    return { success: false, error: "Facebook not connected. Add your Meta API credentials in Settings." };
  }

  const fullCaption = hashtags.length > 0
    ? `${caption}\n\n${hashtags.map(h => `#${h}`).join(" ")}`
    : caption;

  try {
    const pageId = connection.page_id;
    const token = connection.access_token;

    let endpoint: string;
    let body: Record<string, string>;

    if (mediaType === "video") {
      // POST /{page-id}/videos
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      body = {
        file_url: mediaUrl || "",
        description: fullCaption,
        access_token: token,
      };
    } else if (mediaUrl) {
      // POST /{page-id}/photos
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      body = {
        url: mediaUrl,
        message: fullCaption,
        access_token: token,
      };
    } else {
      // Text-only post
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      body = {
        message: fullCaption,
        access_token: token,
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, externalPostId: data.id || data.post_id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Facebook API error" };
  }
}

async function postToTikTok(
  connection: any,
  caption: string,
  hashtags: string[],
  mediaUrl: string | null,
  _mediaType: string
): Promise<{ success: boolean; externalPostId?: string; error?: string }> {
  if (!connection?.access_token) {
    return { success: false, error: "TikTok not connected. Add your TikTok API credentials in Settings." };
  }

  // TikTok Content Posting API:
  // 1. POST /v2/post/publish/inbox/video/init (for direct post)
  //    or POST /v2/post/publish/video/init (for public post, requires approval)
  // 2. Upload video to the URL returned
  // 3. TikTok processes and publishes

  const fullCaption = hashtags.length > 0
    ? `${caption} ${hashtags.map(h => `#${h}`).join(" ")}`
    : caption;

  try {
    // TikTok requires video content
    if (!mediaUrl) {
      return { success: false, error: "TikTok requires video content" };
    }

    const token = connection.access_token;

    const initRes = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_info: {
            title: fullCaption.slice(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: mediaUrl,
          },
        }),
      }
    );

    const initData = await initRes.json();
    if (initData.error?.code) {
      return { success: false, error: initData.error.message || "TikTok API error" };
    }

    return { success: true, externalPostId: initData.data?.publish_id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "TikTok API error" };
  }
}

async function postToLinkedIn(
  connection: any,
  caption: string,
  hashtags: string[],
  mediaUrl: string | null,
  mediaType: string
): Promise<{ success: boolean; externalPostId?: string; error?: string }> {
  if (!connection?.access_token) {
    return { success: false, error: "LinkedIn not connected. Add your LinkedIn API credentials in Settings." };
  }

  const fullCaption = hashtags.length > 0
    ? `${caption}\n\n${hashtags.map(h => `#${h}`).join(" ")}`
    : caption;

  try {
    const token = connection.access_token;
    const personId = connection.page_id; // LinkedIn person URN or org URN

    // LinkedIn Share API v2
    const shareBody: any = {
      author: personId,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: fullCaption },
          shareMediaCategory: mediaUrl ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    if (mediaUrl && mediaType !== "video") {
      shareBody.specificContent["com.linkedin.ugc.ShareContent"].media = [
        {
          status: "READY",
          originalUrl: mediaUrl,
        },
      ];
    }

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(shareBody),
    });

    const data = await res.json();
    if (data.status && data.status >= 400) {
      return { success: false, error: data.message || "LinkedIn API error" };
    }

    return { success: true, externalPostId: data.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "LinkedIn API error" };
  }
}

async function postToX(
  connection: any,
  caption: string,
  hashtags: string[],
  mediaUrl: string | null,
  _mediaType: string
): Promise<{ success: boolean; externalPostId?: string; error?: string }> {
  if (!connection?.access_token) {
    return { success: false, error: "X/Twitter not connected. Add your X API credentials in Settings." };
  }

  // X API v2 tweet creation
  // Hashtags should already be woven into the caption by the formatter

  try {
    const token = connection.access_token;

    const tweetBody: any = { text: caption.slice(0, 280) };

    // If there's media, it needs to be uploaded first via v1.1 media/upload
    // then referenced by media_id in the tweet
    // This is a placeholder for the full media upload flow

    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    const data = await res.json();
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message || "X API error" };
    }

    return { success: true, externalPostId: data.data?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "X API error" };
  }
}

// Platform router
const PLATFORM_POSTERS: Record<string, Function> = {
  instagram: postToInstagram,
  facebook: postToFacebook,
  tiktok: postToTikTok,
  linkedin: postToLinkedIn,
  x: postToX,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { queueId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the queue item
    const { data: queueItem, error: queueError } = await supabase
      .from("content_queue")
      .select("*")
      .eq("id", queueId)
      .single();

    if (queueError || !queueItem) {
      throw new Error("Queue item not found");
    }

    // Fetch the connection for this platform
    const { data: connection } = await supabase
      .from("social_connections")
      .select("*")
      .eq("platform", queueItem.platform)
      .eq("is_active", true)
      .single();

    // Mark as posting
    await supabase
      .from("content_queue")
      .update({ posting_status: "posting" })
      .eq("id", queueId);

    // Check if connection exists and is active
    if (!connection || !connection.is_active) {
      await supabase
        .from("content_queue")
        .update({
          posting_status: "failed",
          error_message: `${queueItem.platform} is not connected. Go to Settings > Configuration to connect it.`,
        })
        .eq("id", queueId);

      return new Response(
        JSON.stringify({
          success: false,
          error: `${queueItem.platform} is not connected`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the appropriate platform poster
    const poster = PLATFORM_POSTERS[queueItem.platform];
    if (!poster) {
      throw new Error(`Unsupported platform: ${queueItem.platform}`);
    }

    const result = await poster(
      connection,
      queueItem.formatted_caption,
      queueItem.formatted_hashtags,
      queueItem.media_url,
      queueItem.media_type
    );

    if (result.success) {
      // Update queue item as posted
      await supabase
        .from("content_queue")
        .update({
          posting_status: "posted",
          posted_at: new Date().toISOString(),
          external_post_id: result.externalPostId || null,
          error_message: null,
        })
        .eq("id", queueId);

      // Update the content request status if all platforms are posted
      const { data: remainingQueued } = await supabase
        .from("content_queue")
        .select("id")
        .eq("request_id", queueItem.request_id)
        .neq("posting_status", "posted");

      if (!remainingQueued || remainingQueued.length === 0) {
        await supabase
          .from("content_requests")
          .update({ status: "posted" })
          .eq("id", queueItem.request_id);
      }

      // Audit log
      await supabase.from("audit_log").insert({
        request_id: queueItem.request_id,
        content_id: queueItem.content_id,
        action: "content_posted",
        details: {
          platform: queueItem.platform,
          external_post_id: result.externalPostId,
        },
      });
    } else {
      // Mark as failed
      await supabase
        .from("content_queue")
        .update({
          posting_status: "failed",
          error_message: result.error,
          retry_count: (queueItem.retry_count || 0) + 1,
        })
        .eq("id", queueId);

      // Audit log
      await supabase.from("audit_log").insert({
        request_id: queueItem.request_id,
        content_id: queueItem.content_id,
        action: "content_post_failed",
        details: {
          platform: queueItem.platform,
          error: result.error,
          retry_count: (queueItem.retry_count || 0) + 1,
        },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-content error:", e);
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
