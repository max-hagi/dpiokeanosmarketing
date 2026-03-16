import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a social media strategist for Okeanos Fiberglass Pools, a pool installation company serving the Greater Golden Horseshoe region of Ontario, Canada. Their ideal customers are homeowners aged 35–55 with household income $150k–$200k+, located within 100km of Brampton. They specialize in fiberglass pool installation only — not full landscaping or turnkey projects. Their differentiators are: pool-only expertise, Canadian-made pools, Hayward equipment, transparent pricing ($45k–$75k range), and engineering-led quality. Generate content that builds trust and drives inquiries — not content that feels like advertising.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { focusTheme, platforms, contentMix, tone } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const now = new Date();
    const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const year = now.getFullYear();

    // Step 1: Trend research via tool calling
    const trendSearchQueries = [
      `Instagram pool content trends ${monthYear}`,
      `TikTok home improvement viral content ${monthYear}`,
      `fiberglass pool social media marketing ideas ${year}`,
      `pool company Instagram trends Canada ${year}`,
    ];

    const trendPrompt = `Search for current social media trends relevant to a fiberglass pool company. For each of these queries, find 1-2 specific actionable trends:

${trendSearchQueries.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return a JSON object with these fields:
- trends: array of objects, each with { summary: string (plain English trend description), source: string (domain name only, e.g. "later.com") }
- Return 4-6 trends total.`;

    const trendResponse = await fetch(
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
            { role: "system", content: "You are a social media trend researcher. Return only valid JSON." },
            { role: "user", content: trendPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_trends",
                description: "Return discovered social media trends",
                parameters: {
                  type: "object",
                  properties: {
                    trends: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          summary: { type: "string" },
                          source: { type: "string" },
                        },
                        required: ["summary", "source"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["trends"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_trends" } },
        }),
      }
    );

    if (!trendResponse.ok) {
      const errText = await trendResponse.text();
      console.error("Trend research failed:", trendResponse.status, errText);
      if (trendResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (trendResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Trend research failed");
    }

    const trendData = await trendResponse.json();
    let trends: { summary: string; source: string }[] = [];
    try {
      const toolCall = trendData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        trends = parsed.trends || [];
      }
    } catch (e) {
      console.error("Failed to parse trends:", e);
      trends = [
        { summary: "Before and after backyard transformation content is trending on Instagram Reels", source: "later.com" },
        { summary: "Day-by-day installation process videos generate high engagement on TikTok", source: "hootsuite.com" },
        { summary: "Homeowner testimonial and reaction videos are performing well across platforms", source: "sproutsocial.com" },
        { summary: "Educational content about pool maintenance tips drives saves and shares", source: "buffer.com" },
      ];
    }

    // Step 2: Generate content plan
    const platformList = (platforms || ["instagram", "tiktok", "facebook"]).join(", ");
    const mixList = (contentMix || ["educational", "behind_the_scenes", "trend_driven", "promotional", "social_proof"]).join(", ");
    const toneText = tone && tone !== "default" ? tone : "whatever fits best";
    const themeText = focusTheme ? `Weekly theme: "${focusTheme}".` : "No specific theme — choose based on the trends found.";

    const planPrompt = `Based on these current trends:
${trends.map((t, i) => `${i + 1}. ${t.summary} (source: ${t.source})`).join("\n")}

${themeText}

Generate a content plan of 3-5 posts for these platforms: ${platformList}.
Content mix to include: ${mixList}.
Tone: ${toneText}.

For each post, return a JSON object with:
- platform: one of the selected platforms
- content_type: "reel" | "carousel" | "static" | "story" | "short_video"
- trend_tag: which trend this post leverages (short label, e.g. "Before & After")
- caption: full ready-to-post caption with hook (first line), body (2-4 sentences), and call to action
- hashtags: array of 10-15 relevant hashtags (without # prefix)
- visual_direction: plain English description of what the image or video should look like
- image_prompt: detailed prompt ready for an AI image generator
- video_hook: first spoken or on-screen text line for video content (null if static/carousel)

Return exactly a JSON object: { posts: [...] }`;

    const planResponse = await fetch(
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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: planPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_plan",
                description: "Return the weekly content plan",
                parameters: {
                  type: "object",
                  properties: {
                    posts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          platform: { type: "string" },
                          content_type: { type: "string" },
                          trend_tag: { type: "string" },
                          caption: { type: "string" },
                          hashtags: { type: "array", items: { type: "string" } },
                          visual_direction: { type: "string" },
                          image_prompt: { type: "string" },
                          video_hook: { type: "string", nullable: true },
                        },
                        required: ["platform", "content_type", "trend_tag", "caption", "hashtags", "visual_direction", "image_prompt"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["posts"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_plan" } },
        }),
      }
    );

    if (!planResponse.ok) {
      const errText = await planResponse.text();
      console.error("Plan generation failed:", planResponse.status, errText);
      if (planResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (planResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Plan generation failed");
    }

    const planData = await planResponse.json();
    let posts: any[] = [];
    try {
      const toolCall = planData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        posts = parsed.posts || [];
      }
    } catch (e) {
      console.error("Failed to parse plan:", e);
      throw new Error("Failed to parse content plan from AI");
    }

    return new Response(
      JSON.stringify({ trends, posts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("weekly-planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
