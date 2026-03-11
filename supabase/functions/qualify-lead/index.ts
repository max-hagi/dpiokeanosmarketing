import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── DETERMINISTIC SCORING ───

const GTA_CORE = [
  "toronto", "vaughan", "richmond hill", "markham", "mississauga",
  "brampton", "oakville", "pickering", "etobicoke", "scarborough",
  "north york", "ajax", "whitby", "milton",
];

const GOLDEN_HORSESHOE = [
  "barrie", "hamilton", "guelph", "kitchener", "oshawa", "peterborough",
  "waterloo", "burlington", "st. catharines", "st catharines", "niagara falls",
  "cambridge", "brantford", "newmarket", "aurora", "stouffville",
  "bolton", "orangeville", "cobourg", "port hope", "orillia",
  "simcoe", "welland", "grimsby", "lincoln", "halton hills",
  "georgetown", "dufferin", "caledon",
];

function scoreLocation(location: string | null): number {
  if (!location) return 0;
  const loc = location.toLowerCase().trim();
  if (GTA_CORE.some((c) => loc.includes(c))) return 25;
  if (GOLDEN_HORSESHOE.some((c) => loc.includes(c))) return 15;
  // Check if Ontario is mentioned
  if (loc.includes("ontario") || loc.includes("on")) return 5;
  return 0;
}

function scoreBudget(budget: string | null): number {
  if (!budget) return 8; // unknown
  switch (budget) {
    case "80k_plus": return 25;
    case "50k_80k": return 22;
    case "30k_50k": return 18;
    case "under_30k": return 10;
    default: return 8;
  }
}

function scoreTimeline(timeline: string | null): number {
  if (!timeline) return 5; // unknown
  switch (timeline) {
    case "asap":
    case "within_3_months": return 20;
    case "3_6_months": return 16;
    case "6_12_months": return 10;
    case "12_plus_months": return 4;
    default: return 5;
  }
}

function scoreLeadQuality(lead: any): number {
  let score = 0;
  // Full contact info
  if (lead.full_name && lead.email && lead.phone) score += 4;
  else if (lead.full_name && lead.email) score += 2;
  // Source quality
  if (lead.source === "word_of_mouth" || lead.referral_source) score += 3;
  else if (lead.source === "google" || lead.source === "social_media") score += 2;
  return Math.min(score, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    if (fetchError || !lead) throw new Error("Lead not found");

    // Deterministic scores
    const locationScore = scoreLocation(lead.location);
    const budgetScore = scoreBudget(lead.budget);
    const timelineScore = scoreTimeline(lead.timeline);
    const leadQualityScore = scoreLeadQuality(lead);

    // AI analysis for Project Fit (0-20) + strengths/risks/recommendation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a lead qualification analyst for Okeanos Ontario, a fiberglass pool-only installation company in Ontario, Canada.

COMPANY CONTEXT FROM ICP:
- Okeanos specializes in POOL-ONLY installation (NOT full turnkey landscaping)
- Ideal customer: homeowner with detached/semi-detached home, usable backyard, aged 35-55
- Core value prop: 2-day installs, $20K+ savings vs turnkey, 100% Canadian-made pools, Hayward equipment, engineer-led
- They LOSE leads who want full turnkey landscaping bundled with pool
- Best leads: have existing landscaper, want pool-only, in Golden Horseshoe region
- Common concerns: price transparency, timeline, winter durability, permits

SCORING RULES FOR PROJECT FIT (0-20 points):
Award points based on the lead's message and inquiry summary:
- Wants pool-only installation (not full turnkey landscaping): +10 points
- Has or mentions an existing landscaper for surrounding work: +5 points
- Mentions detached/semi-detached home with backyard access: +5 points
- Wants full turnkey landscaping bundled with pool: -10 points (penalty)
- Outside service scope (e.g., commercial, condo): -15 points (penalty)
Minimum 0, maximum 20.

ALSO CHECK for lead quality signals in the message:
- Mentioned a specific pool model or feature preference: +3 points (add to lead_quality_bonus)
- Any other quality signals from the message content

You must also produce:
- 2-3 KEY STRENGTHS (bullet points — what makes this lead a good fit)
- 2-3 KEY RISKS (bullet points — concerns, missing info, or disqualifiers)
- 1 sentence RECOMMENDATION (plain English summary of the qualification decision)

Analyze the following lead data carefully.`,
          },
          {
            role: "user",
            content: `LEAD DATA:
Name: ${lead.full_name}
Email: ${lead.email}
Phone: ${lead.phone || "Not provided"}
Location: ${lead.location || "Not provided"}
Budget: ${lead.budget || "Not provided"}
Timeline: ${lead.timeline || "Not provided"}
Source: ${lead.source || "Not provided"}
Referral: ${lead.referral_source || "None"}
Preferred Contact: ${lead.preferred_contact || "Any"}

ORIGINAL MESSAGE:
"${lead.message}"

INQUIRY SUMMARY:
"${lead.inquiry_summary || lead.message}"

MISSING FIELDS: ${JSON.stringify(lead.missing_fields || [])}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "qualify_lead",
              description: "Return project fit score and qualification analysis",
              parameters: {
                type: "object",
                properties: {
                  project_fit_score: {
                    type: "number",
                    description: "Project fit score from 0-20 based on scoring rules",
                  },
                  lead_quality_bonus: {
                    type: "number",
                    description: "Additional lead quality points from message analysis (0-3)",
                  },
                  key_strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 bullet points on what makes this lead a good fit",
                  },
                  key_risks: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 bullet points on concerns or disqualifiers",
                  },
                  recommendation: {
                    type: "string",
                    description: "One sentence plain English qualification decision",
                  },
                },
                required: ["project_fit_score", "lead_quality_bonus", "key_strengths", "key_risks", "recommendation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "qualify_lead" } },
      }),
    });

    let projectFitScore = 10; // default mid
    let leadQualityBonus = 0;
    let keyStrengths: string[] = ["Lead submitted an inquiry"];
    let keyRisks: string[] = ["Requires further conversation to assess fit"];
    let recommendation = "Further qualification needed through conversation.";

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          projectFitScore = Math.max(0, Math.min(20, parsed.project_fit_score ?? 10));
          leadQualityBonus = Math.max(0, Math.min(3, parsed.lead_quality_bonus ?? 0));
          keyStrengths = parsed.key_strengths || keyStrengths;
          keyRisks = parsed.key_risks || keyRisks;
          recommendation = parsed.recommendation || recommendation;
        } catch {
          // fallback
        }
      }
    } else {
      console.error("AI qualification error:", aiResponse.status, await aiResponse.text());
    }

    // Final lead quality = deterministic + AI bonus
    const finalLeadQuality = Math.min(10, leadQualityScore + leadQualityBonus);

    // Total score
    const totalScore = locationScore + budgetScore + timelineScore + projectFitScore + finalLeadQuality;

    // Fit level
    let fitLevel: string;
    if (totalScore >= 70) fitLevel = "high_fit";
    else if (totalScore >= 50) fitLevel = "medium_fit";
    else fitLevel = "low_fit";

    const qualificationData = {
      scores: {
        location: { score: locationScore, max: 25, detail: lead.location || "Unknown" },
        budget: { score: budgetScore, max: 25, detail: lead.budget || "Unknown" },
        timeline: { score: timelineScore, max: 20, detail: lead.timeline || "Unknown" },
        project_fit: { score: projectFitScore, max: 20 },
        lead_quality: { score: finalLeadQuality, max: 10 },
      },
      total_score: totalScore,
      fit_level: fitLevel,
      key_strengths: keyStrengths,
      key_risks: keyRisks,
      recommendation,
    };

    // Update lead
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        qualification_score: totalScore,
        qualification_data: qualificationData,
        fit_level: fitLevel,
        qualified_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) throw updateError;

    // Audit log
    await supabase.from("audit_log").insert({
      action: "lead_qualified",
      details: {
        lead_id: leadId,
        total_score: totalScore,
        fit_level: fitLevel,
        scores: qualificationData.scores,
      },
    });

    // ─── ROUTING AGENT (Agent 5) ───
    // Runs automatically after qualification
    let routingAction: string;
    let routingReason: string;

    if (fitLevel === "high_fit") {
      routingAction = "fast_track";
      routingReason = `High-fit lead (score ${totalScore}/100). Priority routing for immediate sales follow-up. ${lead.timeline === "asap" || lead.timeline === "within_3_months" ? "Urgent timeline — contact within 4 hours." : "Schedule discovery call within 24 hours."}`;
    } else if (fitLevel === "medium_fit") {
      // Check what's missing to decide routing
      const missingFields = lead.missing_fields as string[] || [];
      const hasBudget = !!lead.budget;
      const hasTimeline = !!lead.timeline;

      if (!hasBudget || !hasTimeline || missingFields.length > 0) {
        routingAction = "nurture_conversation";
        routingReason = `Medium-fit lead (score ${totalScore}/100). Missing key info (${missingFields.join(", ") || "budget/timeline"}). Route to Conversation Agent to gather details before sales handoff.`;
      } else {
        routingAction = "sales_review";
        routingReason = `Medium-fit lead (score ${totalScore}/100). Profile is complete but fit is moderate. Route to sales team for manual review and potential discovery call.`;
      }
    } else {
      // low_fit
      const hasDisqualifier = projectFitScore <= 0;
      if (hasDisqualifier) {
        routingAction = "disqualify";
        routingReason = `Low-fit lead (score ${totalScore}/100). Project requirements outside Okeanos service scope. Send polite decline with referral suggestions.`;
      } else {
        routingAction = "drip_nurture";
        routingReason = `Low-fit lead (score ${totalScore}/100). Not currently a strong match but may convert with time. Add to email drip campaign for future follow-up.`;
      }
    }

    // Update lead with routing decision
    const { error: routeError } = await supabase
      .from("leads")
      .update({
        routing_action: routingAction,
        routing_reason: routingReason,
        routed_at: new Date().toISOString(),
        // Auto-advance stage if high fit
        ...(fitLevel === "high_fit" ? { lead_stage: "qualified" } : {}),
      })
      .eq("id", leadId);

    if (routeError) throw routeError;

    // Audit routing
    await supabase.from("audit_log").insert({
      action: "lead_routed",
      details: {
        lead_id: leadId,
        routing_action: routingAction,
        routing_reason: routingReason,
        fit_level: fitLevel,
      },
    });

    // ─── AUTO-CHAIN: Trigger CRM action agent automatically ───
    try {
      console.log(`Auto-triggering CRM action for lead ${leadId}`);
      const crmResp = await fetch(`${supabaseUrl}/functions/v1/crm-action-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ leadId }),
      });
      if (!crmResp.ok) {
        console.error("Auto-CRM failed:", crmResp.status, await crmResp.text());
      } else {
        console.log(`Auto-CRM completed for lead ${leadId}`);
      }
    } catch (chainErr) {
      console.error("Auto-CRM chain error:", chainErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        qualification: qualificationData,
        routing: { action: routingAction, reason: routingReason },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("qualify-lead error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
