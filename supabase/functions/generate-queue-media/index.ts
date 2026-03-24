import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { queueId } = await req.json();
    if (!queueId) throw new Error("queueId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get queue item with its content request context
    const { data: queueItem, error: fetchErr } = await supabase
      .from("content_queue")
      .select("*, content_requests(prompt, additional_context)")
      .eq("id", queueId)
      .single();

    if (fetchErr || !queueItem) throw new Error("Queue item not found");
    if (queueItem.media_url) {
      return new Response(JSON.stringify({ media_url: queueItem.media_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract image prompt from additional_context if available
    let imagePrompt = queueItem.formatted_caption;
    try {
      const ctx = JSON.parse(queueItem.content_requests?.additional_context || "{}");
      if (ctx.image_prompt) imagePrompt = ctx.image_prompt;
    } catch {}

    // Generate image using Nano Banana Pro
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a high-quality social media image for a fiberglass pool company (Okeanos Fiberglass Pools). ${imagePrompt}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Image generation failed:", aiResponse.status, errText);
      throw new Error(`Image generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const base64Image = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) throw new Error("No image returned from AI");

    // Upload to storage
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const fileName = `queue-media/${queueId}-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("generated-content")
      .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: publicUrl } = supabase.storage
      .from("generated-content")
      .getPublicUrl(fileName);

    // Update queue item with media URL
    const { error: updateErr } = await supabase
      .from("content_queue")
      .update({ media_url: publicUrl.publicUrl })
      .eq("id", queueId);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({ media_url: publicUrl.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-queue-media error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
