import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Threshold checks for each category
function analyzeWeakCategories(scores: any): { category: string; score: number; max: number; action: string; sequence?: string }[] {
  const weak: any[] = [];

  if (scores.location.score < 15) {
    weak.push({
      category: "location",
      score: scores.location.score,
      max: 25,
      action: "Send service area email explaining Golden Horseshoe coverage. Confirm exact address before disqualifying.",
      sequence: "D",
    });
  }

  if (scores.budget.score < 15) {
    const budgetDetail = scores.budget.detail;
    if (!budgetDetail || budgetDetail === "Unknown") {
      weak.push({
        category: "budget",
        score: scores.budget.score,
        max: 25,
        action: "Send transparent pricing email with $45K–$75K range. No pressure — ask them to confirm range.",
        sequence: "C",
      });
    } else {
      weak.push({
        category: "budget",
        score: scores.budget.score,
        max: 25,
        action: "Send value education email: what's included, financing options, long-term savings of fiberglass vs concrete vs vinyl.",
        sequence: "C",
      });
    }
  }

  if (scores.timeline.score < 10) {
    weak.push({
      category: "timeline",
      score: scores.timeline.score,
      max: 20,
      action: "Add to long-term nurture sequence. Send 'Planning ahead' educational email. Flag for re-engagement in 3 months. No urgency language.",
      sequence: "B",
    });
  }

  if (scores.project_fit.score < 12) {
    weak.push({
      category: "project_fit",
      score: scores.project_fit.score,
      max: 20,
      action: "Send 'what we do and don't do' clarity email — pool-only scope, landscaper coordination benefit. Include landscaper referral if turnkey was requested.",
      sequence: "B",
    });
  }

  if (scores.lead_quality.score < 5) {
    weak.push({
      category: "lead_quality",
      score: scores.lead_quality.score,
      max: 10,
      action: "Send 'just checking in' re-engagement message — short and light. If no response in 5 days, move to dormant.",
      sequence: "B",
    });
  }

  return weak;
}

function generateCustomerId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "OK-";
  for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function determineSegment(score: number, createdAt?: string): string {
  if (score >= 70) return "High Value";
  if (score >= 30) return "Nurture";
  // Only "Dormant" if lead is 60+ days old
  if (createdAt) {
    const daysSince = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 60) return "Dormant";
  }
  return "Low Priority";
}

function determineRouting(fitLevel: string, score: number): string {
  if (fitLevel === "high_fit" || score >= 70) return "QUALIFIED";
  if (score >= 50) return "NURTURE";
  return "NURTURE";
}

function determineSequenceType(fitLevel: string, score: number, weakCategories: any[]): string {
  if (fitLevel === "high_fit" || score >= 50) return "A";
  // Check for budget recovery
  const hasBudgetWeak = weakCategories.some(w => w.category === "budget");
  if (hasBudgetWeak) return "C";
  // Check for location recovery
  const hasLocationWeak = weakCategories.some(w => w.category === "location");
  if (hasLocationWeak) return "D";
  return "B";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead with qualification data
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    if (fetchError || !lead) throw new Error("Lead not found");

    const qData = lead.qualification_data as any;
    if (!qData) throw new Error("Lead has not been qualified yet. Run qualification first.");

    // Fetch conversation messages for notes
    const { data: messages } = await supabase
      .from("conversation_messages")
      .select("role, content")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    const conversationSummary = lead.inquiry_summary || lead.message;

    // Analyze weak categories
    const weakCategories = analyzeWeakCategories(qData.scores);
    const strongCategories = Object.entries(qData.scores as Record<string, any>)
      .filter(([key, val]: [string, any]) => {
        if (key === "location") return val.score >= 15;
        if (key === "budget") return val.score >= 15;
        if (key === "timeline") return val.score >= 10;
        if (key === "project_fit") return val.score >= 12;
        if (key === "lead_quality") return val.score >= 5;
        return false;
      })
      .map(([key]) => key);

    const segment = determineSegment(qData.total_score, lead.created_at);
    const routing = determineRouting(qData.fit_level, qData.total_score);
    const sequenceType = determineSequenceType(qData.fit_level, qData.total_score, weakCategories);

    // Calculate response time
    const createdAt = new Date(lead.created_at);
    const firstAssistantMsg = messages?.find(m => m.role === "assistant");
    let responseTimeHours: number | null = null;
    if (firstAssistantMsg) {
      // Approximate — messages don't have timestamps accessible here easily
      responseTimeHours = 0; // Instant for chatbot
    }

    // Generate sales briefing using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let salesBriefing = "";

    if (LOVABLE_API_KEY) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are an internal sales briefing writer for Okeanos Ontario (fiberglass pool installations). Write concise, actionable briefing notes. Never use markdown headers — use plain text with dashes and simple formatting.`,
            },
            {
              role: "user",
              content: `Generate a sales briefing note for this lead:

LEAD: ${lead.full_name}
SCORE: ${qData.total_score}/100 | SEGMENT: ${segment} | ROUTING: ${routing}

STRONG CATEGORIES: ${strongCategories.join(", ") || "None"}
WEAK CATEGORIES: ${weakCategories.map(w => `${w.category} (${w.score}/${w.max}) — ${w.action}`).join("\n")}

PERSONA MATCH: ${lead.persona_match || "Not determined"}
CONVERSATION SUMMARY: ${conversationSummary}

Location: ${lead.location || "Unknown"}
Budget: ${lead.budget || "Unknown"}
Timeline: ${lead.timeline || "Unknown"}

Format as:
SALES BRIEFING — [Name]
─────────────────────────────────────────────
Score: X/100  |  Segment: [segment]
Routing: [routing]

WHY THIS SCORE:
  ✅ Strong: [list]
  ⚠️ Weak: [list with reasons]

WHAT'S BEING DONE AUTOMATICALLY:
  [list actions Agent 7 will take]

WHAT THE SALES TEAM SHOULD DO:
  [1-3 specific human actions]

PERSONA NOTE:
  [persona insights and friction points]

NEIGHBOURHOOD NOTE:
  [if in priority area, flag it]`,
            },
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        salesBriefing = aiData.choices?.[0]?.message?.content || "";
      }
    }

    // Fallback briefing if AI fails
    if (!salesBriefing) {
      salesBriefing = `SALES BRIEFING — ${lead.full_name}
─────────────────────────────────────────────
Score: ${qData.total_score}/100  |  Segment: ${segment}
Routing: ${routing}

WHY THIS SCORE:
  ✅ Strong: ${strongCategories.join(", ") || "None identified"}
  ⚠️ Weak: ${weakCategories.map(w => `${w.category} (${w.score}/${w.max})`).join(", ") || "None"}

WHAT'S BEING DONE AUTOMATICALLY:
  ${weakCategories.map(w => w.action).join("\n  ") || "No automated actions needed — lead is well-qualified."}

WHAT THE SALES TEAM SHOULD DO:
  1. Review lead profile and conversation transcript
  2. ${qData.total_score >= 70 ? "Contact within 24 hours for discovery call" : "Wait for automated nurture sequence to warm the lead"}
  3. ${lead.persona_match ? `Tailor approach for ${lead.persona_match} persona` : "Determine persona fit through initial call"}`;
    }

    // Check for existing CRM record
    const { data: existingCrm } = await supabase
      .from("crm_records")
      .select("id")
      .eq("lead_id", leadId)
      .maybeSingle();

    const crmData: any = {
      lead_id: leadId,
      customer_id: generateCustomerId(),
      full_name: lead.full_name,
      email_address: lead.email,
      phone_number: lead.phone,
      mailing_address: lead.mailing_address || lead.location,
      lead_source: lead.source ? lead.source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Other",
      lead_stage: "Inquiry",
      response_time_hours: responseTimeHours,
      initial_contact_date: lead.created_at,
      preferred_contact_method: lead.preferred_contact ? lead.preferred_contact.charAt(0).toUpperCase() + lead.preferred_contact.slice(1) : "Email",
      customer_segment: segment,
      engagement_score: lead.engagement_score || 0,
      referral_source: lead.referral_source,
      notes: conversationSummary,
      qualification_score: qData.total_score,
      score_breakdown: qData.scores,
      routing_decision: routing,
      persona_match: lead.persona_match,
      weak_categories: weakCategories,
      assigned_actions: weakCategories.map(w => ({
        category: w.category,
        action: w.action,
        status: "pending",
      })),
      follow_up_sequence: sequenceType,
      sales_briefing: salesBriefing,
      marketing_campaign_id: lead.campaign_id,
      keyword_source: lead.keyword_source,
      last_interaction_date: new Date().toISOString(),
    };

    let crmRecord;
    if (existingCrm) {
      // Update existing
      delete crmData.customer_id; // Don't regenerate
      const { data, error } = await supabase
        .from("crm_records")
        .update(crmData)
        .eq("id", existingCrm.id)
        .select()
        .single();
      if (error) throw error;
      crmRecord = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("crm_records")
        .insert(crmData)
        .select()
        .single();
      if (error) throw error;
      crmRecord = data;
    }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "crm_record_created",
      details: {
        lead_id: leadId,
        crm_record_id: crmRecord.id,
        customer_id: crmRecord.customer_id,
        weak_categories: weakCategories.map(w => w.category),
        routing_decision: routing,
        sequence_type: sequenceType,
      },
    });

    // ─── AUTO-CHAIN: Trigger follow-up agent automatically ───
    try {
      // Check if a sequence already exists for this lead
      const { data: existingSeq } = await supabase
        .from("follow_up_sequences")
        .select("id")
        .eq("lead_id", leadId)
        .maybeSingle();

      if (!existingSeq) {
        console.log(`Auto-triggering follow-up sequence (type ${sequenceType}) for lead ${leadId}`);
        const followUpResp = await fetch(`${supabaseUrl}/functions/v1/follow-up-agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ leadId, sequenceType, crmRecordId: crmRecord.id }),
        });
        if (!followUpResp.ok) {
          console.error("Auto-follow-up failed:", followUpResp.status, await followUpResp.text());
        } else {
          console.log(`Auto-follow-up completed for lead ${leadId}`);
        }
      } else {
        console.log(`Follow-up sequence already exists for lead ${leadId}, skipping.`);
      }
    } catch (chainErr) {
      console.error("Auto-follow-up chain error:", chainErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        crm_record: crmRecord,
        weak_categories: weakCategories,
        strong_categories: strongCategories,
        routing_decision: routing,
        sequence_type: sequenceType,
        sales_briefing: salesBriefing,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crm-action-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
