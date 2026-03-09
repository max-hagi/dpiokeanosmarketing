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
    const {
      fullName,
      email,
      phone,
      location,
      budget,
      timeline,
      source,
      message,
      missingFields,
      leadStatus,
    } = await req.json();

    // Validate required fields
    if (!fullName || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, Email, and Message are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate inquiry summary using AI
    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a lead intake assistant for Okeanos Ontario, a fiberglass pool installation company. 
Your job is to take the raw message from a potential customer and rewrite it as a clean, professional 2-3 sentence summary of what the lead wants. 
Focus on: what type of pool/project they're interested in, any specific concerns they mentioned (winter durability, permits, pricing, timeline), and their readiness to buy.
Do NOT add information that isn't in the original message. Just clean it up and make it concise.`,
          },
          {
            role: "user",
            content: `Customer name: ${fullName}\nLocation: ${location || "Not provided"}\nBudget: ${budget || "Not provided"}\nTimeline: ${timeline || "Not provided"}\n\nOriginal message:\n"${message}"`,
          },
        ],
      }),
    });

    let inquirySummary = message; // fallback to raw message
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const generated = summaryData.choices?.[0]?.message?.content;
      if (generated) inquirySummary = generated;
    }

    // Insert lead into database
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        full_name: fullName,
        email,
        phone: phone || null,
        location: location || null,
        budget: budget || null,
        timeline: timeline || null,
        source: source || null,
        message,
        inquiry_summary: inquirySummary,
        missing_fields: missingFields || [],
        lead_status: leadStatus || "incomplete",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log to audit
    await supabase.from("audit_log").insert({
      action: "lead_captured",
      details: {
        lead_id: lead.id,
        lead_status: leadStatus,
        missing_fields: missingFields,
        source: source || "unknown",
      },
    });

    return new Response(JSON.stringify({ success: true, lead }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-lead error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
