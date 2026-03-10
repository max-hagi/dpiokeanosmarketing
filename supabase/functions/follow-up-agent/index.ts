import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Schedule delays for each sequence type
const SEQUENCE_SCHEDULES: Record<string, { delay_hours: number; subject_template: string }[]> = {
  A: [
    { delay_hours: 0, subject_template: "Your Okeanos pool summary — next steps inside" },
    { delay_hours: 24, subject_template: "Quick note from Okeanos" },
    { delay_hours: 120, subject_template: "Still thinking it over? Here's something that might help." },
    { delay_hours: 336, subject_template: "Leaving the door open" },
  ],
  B: [
    { delay_hours: 0, subject_template: "Thanks for reaching out — here's a starting point" },
    { delay_hours: 168, subject_template: "" }, // Dynamic based on concern
    { delay_hours: 504, subject_template: "Quick check-in — has anything changed?" },
    { delay_hours: 1080, subject_template: "" }, // Dynamic seasonal
  ],
  C: [
    { delay_hours: 0, subject_template: "Here's exactly what our pools cost — no guessing" },
  ],
  D: [
    { delay_hours: 0, subject_template: "Quick question about your location" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, sequenceType, crmRecordId } = await req.json();
    if (!leadId || !sequenceType) {
      return new Response(JSON.stringify({ error: "leadId and sequenceType are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Fetch conversation messages for personalization
    const { data: messages } = await supabase
      .from("conversation_messages")
      .select("role, content")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    const conversationText = messages?.map(m => `${m.role}: ${m.content}`).join("\n") || "";
    const convData = lead.conversation_data as any || {};
    const qData = lead.qualification_data as any;

    const schedule = SEQUENCE_SCHEDULES[sequenceType] || SEQUENCE_SCHEDULES.B;
    const now = new Date();

    // Create sequence record
    const { data: sequence, error: seqError } = await supabase
      .from("follow_up_sequences")
      .insert({
        lead_id: leadId,
        crm_record_id: crmRecordId || null,
        sequence_type: sequenceType,
        status: "active",
        current_message_number: 0,
        total_messages: schedule.length,
      })
      .select()
      .single();
    if (seqError) throw seqError;

    // Generate all messages via AI
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
            content: `You are a follow-up email writer for Okeanos Ontario, a fiberglass pool installation company.

GOLDEN RULE OF PERSONALIZATION:
- USE project details: timeline, pool features, concerns about contractors, location, budget range
- NEVER reference personal/family details: kids' names, relationship status, family size, job
- GOOD: "Since you mentioned you're aiming for next summer..."
- BAD: "As a parent of young children like yourself..."

EMAIL FORMAT RULES:
- Subject: plain and honest — no "🌊 Your Dream Pool Awaits!" type lines (one emoji max in subject)
- Opening: first name + one grounding sentence about their project
- Body: max 250 words for check-ins, max 400 for educational
- Closing: one clear, low-friction CTA (reply / book a call / click one link)
- Sign-off: "— The Okeanos Team" (not a fake personal name)
- No ALL CAPS urgency, no fake scarcity, no emojis in body
- Tone: warm but efficient, like a well-run company that respects their time`,
          },
          {
            role: "user",
            content: `Generate the follow-up email sequence for this lead.

SEQUENCE TYPE: ${sequenceType}
LEAD NAME: ${lead.full_name}
LOCATION: ${lead.location || "Unknown"}
BUDGET: ${lead.budget || "Not shared"}
TIMELINE: ${lead.timeline || "Unknown"}
PERSONA: ${lead.persona_match || "Unknown"}

CONVERSATION SUMMARY: ${lead.inquiry_summary || lead.message}

KEY CONVERSATION DATA:
- Pool vision: ${convData.pool_vision || "Not discussed"}
- Main concern: ${convData.main_fear || "Not discussed"}
- Trigger: ${convData.trigger || "Not discussed"}
- Must-haves: ${convData.must_haves || "Not discussed"}
- Backyard access: ${convData.backyard_access || "Not discussed"}
- Budget aligned: ${convData.budget_aligned || "Unknown"}

SCORE BREAKDOWN: ${qData ? JSON.stringify(qData.scores) : "Not available"}
WEAK AREAS: ${qData ? JSON.stringify(qData.key_risks) : "Unknown"}

SEQUENCE ${sequenceType} REQUIREMENTS:
${sequenceType === "A" ? `
Message 1 (immediate): Summary + next steps. Thank by first name. Confirm what they're looking for. Explain team reviews, reaches out within 24h.
Message 2 (24h later): Short, 3-4 sentences. Acknowledge they may be comparing. One differentiator relevant to their concern. CTA: reply or book call.
Message 3 (5 days): Genuinely useful resource, NOT sales pitch. Options: fiberglass vs concrete comparison, week-by-week install process, or what's included in $45K-$75K. Soft: "No rush."
Message 4 (14 days): Very short, 2-3 sentences. Acknowledge timing. One easy way back.` :
sequenceType === "B" ? `
Message 1 (immediate): Thank them. Set expectations. Link one useful content piece based on weak score area.
Message 2 (7 days): Educational 300-400 words. Conversational, not brochure. End: "Any questions? Reply — a real person will get back."
Message 3 (21 days): Short check-in. One simple question about their weak score area.
Message 4 (45 days): Seasonal reminder relevant to their timeline.` :
sequenceType === "C" ? `
Message 1 (immediate): Lead with transparency. State $45K-$75K + HST range. Break down inclusions. State exclusions. End: "If that works, we'd love to talk. If not, no hard feelings."` :
`Message 1 (immediate): One paragraph. Explain service area affects scheduling/pricing. Ask for full address or postal code. List areas served. "If you're outside our area, we'll be honest."`}

Return each message with subject and body.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_sequence",
              description: "Return the email sequence messages",
              parameters: {
                type: "object",
                properties: {
                  messages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        message_number: { type: "number" },
                        subject: { type: "string" },
                        body: { type: "string" },
                        personalization_tags: {
                          type: "array",
                          items: { type: "string" },
                          description: "List of personalization elements used, e.g. 'their timeline', 'their main concern'",
                        },
                      },
                      required: ["message_number", "subject", "body", "personalization_tags"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["messages"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_sequence" } },
      }),
    });

    let generatedMessages: any[] = [];

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          generatedMessages = parsed.messages || [];
        } catch { /* fallback */ }
      }
    } else {
      console.error("AI follow-up error:", aiResponse.status, await aiResponse.text());
    }

    // Fallback if AI fails
    if (generatedMessages.length === 0) {
      generatedMessages = schedule.map((s, i) => ({
        message_number: i + 1,
        subject: s.subject_template || `Follow-up from Okeanos — Message ${i + 1}`,
        body: `Hi ${lead.full_name.split(" ")[0]},\n\nThank you for reaching out to Okeanos Ontario about your pool project. We're here to help whenever you're ready.\n\n— The Okeanos Team`,
        personalization_tags: ["first name"],
      }));
    }

    // Insert all messages
    const messagesToInsert = generatedMessages.map((msg, i) => {
      const scheduleItem = schedule[i] || { delay_hours: (i + 1) * 24 };
      const scheduledAt = new Date(now.getTime() + scheduleItem.delay_hours * 60 * 60 * 1000);
      return {
        sequence_id: sequence.id,
        lead_id: leadId,
        message_number: msg.message_number || i + 1,
        subject: msg.subject,
        body: msg.body,
        personalization_tags: msg.personalization_tags || [],
        scheduled_at: scheduledAt.toISOString(),
        status: scheduleItem.delay_hours === 0 ? "queued" : "pending",
      };
    });

    const { data: insertedMessages, error: msgError } = await supabase
      .from("follow_up_messages")
      .insert(messagesToInsert)
      .select();
    if (msgError) throw msgError;

    // Update CRM record with sequence info
    if (crmRecordId) {
      await supabase.from("crm_records").update({
        follow_up_sequence: sequenceType,
        last_interaction_date: now.toISOString(),
      }).eq("id", crmRecordId);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "follow_up_sequence_created",
      details: {
        lead_id: leadId,
        sequence_id: sequence.id,
        sequence_type: sequenceType,
        message_count: insertedMessages?.length || 0,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        sequence,
        messages: insertedMessages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("follow-up-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
