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
      fullName, email, phone, location, mailingAddress,
      budget, timeline, source, preferredContact,
      referralSource, campaignId, keywordSource,
      message, missingFields, leadStatus,
    } = await req.json();

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

    // Generate inquiry summary + auto-enrichment using AI
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
            content: `You are a lead intake assistant for Okeanos Ontario, a fiberglass pool installation company in Ontario, Canada.

COMPANY CONTEXT:
- Okeanos specializes in fast (2-day) fiberglass pool installations at 20K+ savings
- Ideal customer: homeowner aged 30-50, budget $30K-$80K, planning install within 12 months
- Common customer concerns: winter durability, price transparency, timeline, and permit process
- Pain points from journey mapping: "too many steps to get a pool", "low transparency", "high prices", "uneducated companies"

YOUR TASK:
1. Rewrite the customer's raw message as a clean, professional 2-3 sentence INQUIRY SUMMARY
2. Based on the lead data, determine a CUSTOMER SEGMENT: "high_value" (budget $50K+, timeline within 6 months), "warm" (has budget and timeline), "new_lead" (default), or "dormant" (12+ months timeline)
3. Calculate an ENGAGEMENT SCORE (0-100) based on: fields filled (each +10), budget provided (+15), timeline ASAP/within 3 months (+15), referred by someone (+10), detailed message (+10)

Focus on: what type of pool/project they want, specific concerns, and buying readiness.
Acknowledge the customer journey pain points — flag if the customer mentions pricing concerns, timeline worries, or trust issues.
Do NOT add information not in the original message.`,
          },
          {
            role: "user",
            content: `Customer: ${fullName}
Email: ${email}
Phone: ${phone || "Not provided"}
Location: ${location || "Not provided"}
Address: ${mailingAddress || "Not provided"}
Budget: ${budget || "Not provided"}
Timeline: ${timeline || "Not provided"}
Source: ${source || "Not provided"}
Referred by: ${referralSource || "None"}
Campaign: ${campaignId || "None"}
Keyword: ${keywordSource || "None"}
Preferred contact: ${preferredContact || "Any"}

Original message:
"${message}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "process_lead_profile",
              description: "Structure the lead profile with summary, segment, and engagement score",
              parameters: {
                type: "object",
                properties: {
                  inquiry_summary: { type: "string", description: "Clean 2-3 sentence summary of the inquiry" },
                  customer_segment: { type: "string", enum: ["new_lead", "high_value", "warm", "dormant"] },
                  engagement_score: { type: "number", description: "Score from 0-100" },
                },
                required: ["inquiry_summary", "customer_segment", "engagement_score"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "process_lead_profile" } },
      }),
    });

    let inquirySummary = message;
    let customerSegment = "new_lead";
    let engagementScore = 0;

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const toolCall = summaryData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          inquirySummary = parsed.inquiry_summary || message;
          customerSegment = parsed.customer_segment || "new_lead";
          engagementScore = parsed.engagement_score || 0;
        } catch {
          // fallback to raw message
        }
      }
    }

    // Insert lead
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        full_name: fullName,
        email,
        phone: phone || null,
        location: location || null,
        mailing_address: mailingAddress || null,
        budget: budget || null,
        timeline: timeline || null,
        source: source || null,
        preferred_contact: preferredContact || null,
        referral_source: referralSource || null,
        campaign_id: campaignId || null,
        keyword_source: keywordSource || null,
        message,
        inquiry_summary: inquirySummary,
        missing_fields: missingFields || [],
        lead_status: leadStatus || "incomplete",
        lead_stage: "inquiry",
        customer_segment: customerSegment,
        engagement_score: engagementScore,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Audit log
    await supabase.from("audit_log").insert({
      action: "lead_captured",
      details: {
        lead_id: lead.id,
        lead_status: leadStatus,
        customer_segment: customerSegment,
        engagement_score: engagementScore,
        missing_fields: missingFields,
        source: source || "unknown",
        campaign_id: campaignId || null,
        keyword_source: keywordSource || null,
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
