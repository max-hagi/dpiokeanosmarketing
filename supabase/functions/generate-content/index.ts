import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OKEANOS_SYSTEM_PROMPT = `You are the marketing content agent for Okeanos Ontario, a fiberglass pool installation company.

COMPANY POSITIONING:
Among prospective pool installation clients, Okeanos is the brand of affordable pools that delivers exceptional quality and speed of installation at a historically low price by promoting simplicity in design, leveraging strategic suppliers and industry connections, while keeping overhead and operating costs low by perfecting one aspect of the construction process.

CORE VALUES: Trust, Professionalism, Affordability, Transparency, Speed
DIFFERENTIATORS:
- 2-day installation (vs weeks/months from competitors)
- Save 20K+ off the average pool price
- 25+ years of industry experience
- Industry-leading warranties
- Lowest lifetime operating cost (fiberglass = longest durability, lowest maintenance)

TARGET AUDIENCES:
1. Middle-high income homeowners with undeveloped lots looking to invest in their property
2. Landscapers who avoid/outsource pools or recently entered the pool market
3. Subdivision home builders focused on speed and price

NOT FOR: Ultra-luxury, concrete/freeform pools, commercial clients, no-budget clients

POSITIONING STATEMENT:
We focus on bringing back trust, professionalism, and affordability to the pool market by creating an enjoyable user experience, providing the best warranty, as well as installing the best product with the best techniques.

VALUE PROPOSITION:
We provide the lowest initial cost and lifetime cost of constructing and operating a pool in the industry. By focusing on volume, speed, and simplicity, we cut an average of 20K+ off the price of a pool. With fair financing plans, streamlined operations, and the best sourcing in the industry leveraging 25+ years of connections, we offer the leanest pool on the market with the fastest installation, industry-leading warranties, and lowest future operating costs.

BRAND TONE: Professional yet approachable, family-oriented, trustworthy, confident without being flashy. Speak to hardworking families who deserve to enjoy their backyard.

CONTENT RULES:
- Always emphasize affordability + quality (never sacrifice one for the other)
- Highlight speed of installation as a major differentiator
- Use emotional language about family memories, backyard enjoyment, summer fun
- Reference the rising costs of vacations and how a pool is a smart investment
- Never be pushy or salesy — be educational and trustworthy
- Include calls to action that feel natural and inviting
- Use Canadian English spelling where applicable`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, contentType, targetAudience, additionalContext, requestId, generateImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the generation start
    await supabase.from("audit_log").insert({
      request_id: requestId,
      action: "generation_started",
      details: { prompt, contentType, targetAudience, generateImage },
    });

    // Update request status
    await supabase
      .from("content_requests")
      .update({ status: "generating" })
      .eq("id", requestId);

    // Build the user prompt
    let userPrompt = `Create ${contentType.replace("_", " ")} content based on this brief:\n\n"${prompt}"`;
    if (targetAudience) userPrompt += `\n\nTarget audience: ${targetAudience}`;
    if (additionalContext) userPrompt += `\n\nAdditional context: ${additionalContext}`;

    if (contentType === "social_post" || contentType === "caption") {
      userPrompt += "\n\nKeep it concise, engaging, and include relevant hashtags. Format for social media.";
    } else if (contentType === "blog_article") {
      userPrompt += "\n\nWrite a full blog article with a compelling headline, introduction, body sections with subheadings, and a conclusion with CTA. Use markdown formatting.";
    } else if (contentType === "ad_copy") {
      userPrompt += "\n\nWrite compelling ad copy with a strong headline, body text, and clear call to action. Keep it punchy and conversion-focused.";
    }

    // Generate text content
    const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: OKEANOS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!textResponse.ok) {
      const status = textResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const textData = await textResponse.json();
    const textContent = textData.choices?.[0]?.message?.content || "";

    let imageUrl: string | null = null;

    // Generate image if requested
    if (generateImage) {
      const imagePrompt = `Professional marketing photo for a fiberglass pool installation company called Okeanos Ontario. ${prompt}. Style: clean, modern, aspirational, family-friendly. Show beautiful backyard with pool, happy family atmosphere, Canadian suburban setting. High quality, photorealistic.`;

      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: imagePrompt }],
          modalities: ["image", "text"],
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (base64Image) {
          // Upload to storage
          const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
          const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const fileName = `${requestId}/${Date.now()}.png`;

          const { error: uploadError } = await supabase.storage
            .from("generated-content")
            .upload(fileName, binaryData, { contentType: "image/png" });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("generated-content").getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
          }
        }
      }
    }

    // Get current max version
    const { data: existingContent } = await supabase
      .from("generated_content")
      .select("version")
      .eq("request_id", requestId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingContent && existingContent.length > 0 ? existingContent[0].version + 1 : 1;

    // Save generated content
    const { data: content, error: contentError } = await supabase
      .from("generated_content")
      .insert({
        request_id: requestId,
        text_content: textContent,
        image_url: imageUrl,
        content_type: contentType,
        version: nextVersion,
      })
      .select()
      .single();

    if (contentError) throw contentError;

    // Update request status to review
    await supabase
      .from("content_requests")
      .update({ status: "review" })
      .eq("id", requestId);

    // Log completion
    await supabase.from("audit_log").insert({
      request_id: requestId,
      content_id: content.id,
      action: "generation_completed",
      details: { version: nextVersion, hasImage: !!imageUrl },
    });

    return new Response(JSON.stringify({ success: true, content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
