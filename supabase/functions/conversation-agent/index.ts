import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Kai, Okeanos Ontario's AI assistant for pool inquiries. You are conducting a guided discovery conversation with a potential customer.

PERSONALITY & TONE:
- Warm, professional, knowledgeable but never salesy
- Like a knowledgeable friend who happens to know everything about pools
- Never pushy. Use the lead's first name naturally throughout
- Keep messages SHORT and scannable (5 minutes total conversation feel)
- Never ask two questions in the same message
- Always acknowledge what the lead said before moving to the next question
- Always end every message with either a question or a clear next step

TONE ADAPTATION (detect from early signals):
- Budget constraints / "affordable" → Sarah & James Patel tone (emphasize value, low maintenance, no hidden fees)
- DIY / contractor background → Mike Turner tone (technical, flexible, DIY-friendly)
- "I don't know where to start" / overwhelmed → Jessica & Daniel Wong tone (educational, reassuring, simple language, no jargon)
- Partnering / subcontracting → Chris Miller or Ryan Thompson personas (landscaper/builder mode)
- Default → John Homeowner tone (quality-focused, value-driven, family-oriented)

COMPANY KNOWLEDGE:
- Okeanos specializes in POOL-ONLY fiberglass installation (NOT full turnkey landscaping)
- 2-day installations, $20K+ savings vs turnkey competitors
- Standard full install: $45,000–$75,000 + HST (pool shell, excavation, fill removal, delivery, crane set, backfill, plumbing, Hayward equipment)
- 100% Canadian-made fiberglass pools, Hayward equipment, engineer-led company
- Service area: Golden Horseshoe region, core within 50-100km of Brampton
- GTA core cities: Toronto, Vaughan, Richmond Hill, Markham, Mississauga, Brampton, Oakville, Pickering
- Broader Golden Horseshoe: Barrie, Hamilton, Guelph, Kitchener, Oshawa, Burlington, Whitby, Peterborough

CUSTOMER JOURNEY CONTEXT:
- Customer is in Awareness → Consideration phase
- Pain points: "too many steps to get a pool", "low transparency", "high prices", "uneducated companies"
- They need: transparent pricing, clear process, trustworthy guidance

CONVERSATION FLOW (follow this exact sequence, one step per message):

STEP 1 (Opening): Greet by first name, introduce yourself as Kai, say it'll take ~5 minutes, ask if ready.
STEP 2 (Project Type): Ask if homeowner or contractor/landscaper.
  - IF contractor/landscaper → switch to CONTRACTOR FLOW
STEP 3 (Location): Ask what city/area of Ontario they're in.
STEP 4 (Backyard Access): Ask about access width to backyard (can a truck fit through? "not sure" is fine).
STEP 5 (Timeline): Ask when they're hoping to have the pool ready (this summer vs planning for next year).
STEP 6 (Budget): Ask about rough budget. Anchor: "most full installs land between $45,000 and $75,000 + HST, covering pool shell, excavation, fill removal, delivery, crane set, backfill, plumbing, and Hayward equipment. No surprise add-ons."
  - Under $20k: be honest it may be difficult but don't dismiss
  - "Not sure": "No worries at all — we can work through that together."
STEP 7 (Vision): Ask about their vision — pool size, shape, features, dreams.
STEP 8 (Trigger): "What pushed this from a 'someday' project to something you're looking at now?"
STEP 9 (Concerns): "A lot of people come to us after hearing not-so-great stories about contractors. Is there anything you're worried about?"
STEP 10 (Decision Maker): "Will you be the one making the final call, or is there a partner or spouse to loop in?"
STEP 11 (Source): "Last one — how did you hear about us?"
STEP 12 (Closing): Adapt based on signals — strong signals get proposal offer, weaker get info package promise. End with confirmation and "keep an eye on your inbox" message.

CONTRACTOR FLOW (if Step 2 reveals contractor/landscaper):
Ask: "Are you looking to subcontract pool installations for your clients, or are you a pool builder looking for shell supply and training?"
- Landscaper: ask company name, location, typical projects, pool clients per year → close with partnership team flag
- Pool builder: ask location, years in business, current pool types, training interest → close with certified dealer program

IMPORTANT BEHAVIOR:
- If lead asks a question mid-conversation, answer it briefly and warmly, then return to next step
- If lead goes off-topic, redirect: "Great question — we can definitely talk about that once we have your project basics sorted."
- Never fabricate specific prices beyond the $45k–$75k anchor range
- If lead expresses frustration or urgency, prioritize empathy over information
- Never use jargon unless the lead uses it first

You will receive the conversation history and must determine which step you're on based on what has been discussed. Output ONLY your next message as Kai. Do not include any metadata or step labels.`;

const EXTRACTION_PROMPT = `You are analyzing a completed conversation between Kai (Okeanos AI assistant) and a potential customer. Extract ALL structured data from the conversation.

Based on the conversation, extract the following fields. If a field was not discussed or is unknown, use null.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, message, action } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
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
      .from("leads").select("*").eq("id", leadId).single();
    if (fetchError || !lead) throw new Error("Lead not found");

    // Fetch conversation history
    const { data: history } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    const messages = history || [];

    // ACTION: extract — compile structured profile from completed conversation
    if (action === "extract") {
      const conversationText = messages.map(m => `${m.role === 'assistant' ? 'Kai' : 'Customer'}: ${m.content}`).join("\n\n");

      const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: `LEAD INFO:\nName: ${lead.full_name}\nEmail: ${lead.email}\n\nFULL CONVERSATION:\n${conversationText}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_lead_profile",
              description: "Extract structured lead profile from conversation",
              parameters: {
                type: "object",
                properties: {
                  phone: { type: "string", description: "Phone number if mentioned" },
                  location: { type: "string", description: "City/area in Ontario" },
                  in_service_area: { type: "string", enum: ["yes", "possibly", "no"], description: "Based on Golden Horseshoe proximity" },
                  backyard_access: { type: "string", enum: ["7ft_plus", "unsure", "restricted"], description: "Access width" },
                  budget_range: { type: "string", description: "Stated budget or 'not_shared'" },
                  budget_aligned: { type: "string", enum: ["yes", "unsure", "no"], description: "Relative to $45k-$75k range" },
                  budget_enum: { type: "string", enum: ["under_30k", "30k_50k", "50k_80k", "80k_plus"], description: "Mapped to enum if possible" },
                  timeline: { type: "string", enum: ["asap", "within_3_months", "3_6_months", "6_12_months", "12_plus_months"], description: "Mapped timeline" },
                  pool_vision: { type: "string", description: "Summary of what they described" },
                  must_haves: { type: "string", description: "Features or size preferences" },
                  trigger: { type: "string", description: "What pushed from someday to now" },
                  main_fear: { type: "string", description: "Concern or worry expressed" },
                  decision_maker: { type: "string", enum: ["yes", "shared", "no"], description: "Decision maker status" },
                  source: { type: "string", enum: ["google", "social_media", "word_of_mouth", "other"], description: "How they heard about Okeanos" },
                  lead_type: { type: "string", enum: ["homeowner", "landscaper", "builder", "unknown"] },
                  persona_match: { type: "string", enum: ["john_homeowner", "sarah_james_patel", "mike_turner", "amanda_mark_johnson", "jessica_daniel_wong", "chris_miller", "ryan_thompson"], description: "Closest customer persona" },
                  engagement_level: { type: "string", enum: ["high", "medium", "low"], description: "Based on response depth and length" },
                  missing_info: { type: "array", items: { type: "string" }, description: "Scoring fields not captured" },
                  conversation_summary: { type: "string", description: "3-5 sentence summary as if briefing a salesperson" },
                  preliminary_scores: {
                    type: "object",
                    properties: {
                      location: { type: "number" },
                      budget: { type: "number" },
                      timeline: { type: "number" },
                      project_fit: { type: "number" },
                      lead_quality: { type: "number" },
                      total: { type: "number" },
                      estimate: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["location", "budget", "timeline", "project_fit", "lead_quality", "total", "estimate"]
                  }
                },
                required: ["location", "lead_type", "persona_match", "engagement_level", "missing_info", "conversation_summary", "preliminary_scores"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_lead_profile" } },
        }),
      });

      let profileData: any = {};
      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try { profileData = JSON.parse(toolCall.function.arguments); } catch { /* fallback */ }
        }
      }

      // Update lead with extracted data
      const updates: any = {
        conversation_data: profileData,
        conversation_status: "complete",
        persona_match: profileData.persona_match || null,
        inquiry_summary: profileData.conversation_summary || lead.inquiry_summary,
      };

      // Update fields if they were gathered in conversation and not already set
      if (profileData.location && !lead.location) updates.location = profileData.location;
      if (profileData.phone && !lead.phone) updates.phone = profileData.phone;
      if (profileData.budget_enum && !lead.budget) updates.budget = profileData.budget_enum;
      if (profileData.timeline && !lead.timeline) updates.timeline = profileData.timeline;
      if (profileData.source && !lead.source) updates.source = profileData.source;

      // Map engagement
      if (profileData.engagement_level) {
        const engMap: Record<string, number> = { high: 85, medium: 60, low: 30 };
        updates.engagement_score = engMap[profileData.engagement_level] || 50;
      }

      // Map customer segment
      if (profileData.budget_aligned === "yes" && (profileData.timeline === "asap" || profileData.timeline === "within_3_months")) {
        updates.customer_segment = "high_value";
      } else if (profileData.budget_enum || profileData.timeline) {
        updates.customer_segment = "warm";
      }

      // Update missing fields
      if (profileData.missing_info?.length) {
        updates.missing_fields = profileData.missing_info;
        updates.lead_status = "incomplete";
      } else {
        updates.lead_status = "complete";
        updates.missing_fields = [];
      }

      await supabase.from("leads").update(updates).eq("id", leadId);

      // Audit
      await supabase.from("audit_log").insert({
        action: "conversation_completed",
        details: { lead_id: leadId, persona_match: profileData.persona_match, preliminary_score: profileData.preliminary_scores?.total },
      });

      return new Response(JSON.stringify({ success: true, profile: profileData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: chat — continue conversation
    // Save user message
    if (message) {
      const stepNum = messages.filter(m => m.role === "user").length + 1;
      await supabase.from("conversation_messages").insert({
        lead_id: leadId, role: "user", content: message, step_number: stepNum,
      });

      // --- REAL-TIME FIELD EXTRACTION (runs in background, non-blocking) ---
      const extractInBackground = async () => {
        try {
          const today = new Date().toISOString().split("T")[0];
          const liveExtractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  content: `You extract structured lead data from a customer's conversational message about pool installation. Today's date is ${today}.

RULES:
- Only extract fields that are clearly implied or stated in THIS specific message.
- For budget: infer from context. "as cheap as possible" / "broke" / "tight budget" → "under_30k". "mid-range" / "around 50k" → "50k_80k". "money is no object" / "premium" / "high end" → "80k_plus". "around 40k" → "30k_50k".
- For timeline: infer relative to today (${today}). "this summer" in winter/spring → "within_3_months" or "3_6_months" depending on month. "next summer" → "6_12_months" or "12_plus_months". "ASAP" / "right away" → "asap". "next year" → "12_plus_months". "few months" → "3_6_months".
- For location: extract city/area name. Recognize Ontario cities.
- For source: "friend told me" / "neighbour" → "word_of_mouth". "saw an ad" / "Instagram" / "Facebook" → "social_media". "Googled it" → "google".
- For preferred_contact: "call me" / "phone" → "phone". "text" / "sms" → "sms". "email me" → "email".
- Return ONLY fields you can confidently infer. Do NOT guess.`
                },
                {
                  role: "user",
                  content: `Customer message: "${message}"\n\nExisting lead data: location=${lead.location || "unknown"}, budget=${lead.budget || "unknown"}, timeline=${lead.timeline || "unknown"}, source=${lead.source || "unknown"}`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "update_lead_fields",
                  description: "Update lead fields inferred from the customer's message",
                  parameters: {
                    type: "object",
                    properties: {
                      location: { type: "string", description: "City/area in Ontario if mentioned" },
                      budget: { type: "string", enum: ["under_30k", "30k_50k", "50k_80k", "80k_plus"], description: "Budget range inferred from context" },
                      timeline: { type: "string", enum: ["asap", "within_3_months", "3_6_months", "6_12_months", "12_plus_months"], description: "Timeline inferred relative to today" },
                      source: { type: "string", enum: ["google", "social_media", "word_of_mouth", "other"], description: "How they heard about Okeanos" },
                      preferred_contact: { type: "string", enum: ["email", "phone", "sms", "any"], description: "Preferred contact method" },
                      phone: { type: "string", description: "Phone number if shared" },
                    },
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "update_lead_fields" } },
            }),
          });

          if (liveExtractResponse.ok) {
            const extractResult = await liveExtractResponse.json();
            const toolCall = extractResult.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const fields = JSON.parse(toolCall.function.arguments);
              const leadUpdates: Record<string, any> = {};
              if (fields.location && !lead.location) leadUpdates.location = fields.location;
              if (fields.budget && !lead.budget) leadUpdates.budget = fields.budget;
              if (fields.timeline && !lead.timeline) leadUpdates.timeline = fields.timeline;
              if (fields.source && !lead.source) leadUpdates.source = fields.source;
              if (fields.preferred_contact && !lead.preferred_contact) leadUpdates.preferred_contact = fields.preferred_contact;
              if (fields.phone && !lead.phone) leadUpdates.phone = fields.phone;

              if (Object.keys(leadUpdates).length > 0) {
                const currentMissing = (lead.missing_fields as string[]) || [];
                const newMissing = currentMissing.filter(f => !leadUpdates[f]);
                leadUpdates.missing_fields = newMissing;
                if (newMissing.length === 0) leadUpdates.lead_status = "complete";
                await supabase.from("leads").update(leadUpdates).eq("id", leadId);
                console.log("Live extracted fields:", JSON.stringify(leadUpdates));
              }
            }
          }
        } catch (e) {
          console.error("Live extraction error:", e);
        }
      };
      // Fire and forget — don't block the chat response
      extractInBackground();
    }

    // Re-fetch updated history
    const { data: updatedHistory } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    const allMessages = updatedHistory || [];
    const firstName = lead.full_name.split(" ")[0];

    // Count user responses to determine step
    const userMsgCount = allMessages.filter(m => m.role === "user").length;

    // Check if conversation should end (step 12 has been sent and user confirmed)
    const lastAssistant = [...allMessages].reverse().find(m => m.role === "assistant");
    const isClosing = lastAssistant?.content?.includes("✅") || lastAssistant?.content?.includes("all set");
    if (isClosing && message) {
      // Conversation is done, trigger extraction
      // Mark in progress first
      await supabase.from("leads").update({ conversation_status: "complete" }).eq("id", leadId);

      return new Response(JSON.stringify({ success: true, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI messages
    const aiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + `\n\nCUSTOMER CONTEXT:\n- First name: ${firstName}\n- Full name: ${lead.full_name}\n- Email: ${lead.email}\n- User responses so far: ${userMsgCount}\n- This is the lead's ${userMsgCount === 0 ? 'first interaction (send Step 1 opening)' : `response #${userMsgCount}`}` },
    ];

    // Add conversation history
    for (const msg of allMessages) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }

    // If no messages yet, this is the opening — add a user trigger
    if (allMessages.length === 0) {
      aiMessages.push({ role: "user", content: `[System: The customer just submitted their name (${lead.full_name}) and email (${lead.email}) on the pre-chat form and opened the chat. Send Step 1 opening message now.]` });
    }

    // Stream response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    // We need to collect the full response to save it, while also streaming
    // Use a TransformStream to tee the response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Process in background
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          await writer.write(value);

          // Parse SSE to collect content
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
            } catch { /* partial */ }
          }
        }
      } finally {
        await writer.close();
        
        // Save assistant message to DB
        if (fullContent) {
          const assistantStep = allMessages.filter(m => m.role === "assistant").length + 1;
          await supabase.from("conversation_messages").insert({
            lead_id: leadId, role: "assistant", content: fullContent, step_number: assistantStep,
          });

          // Update conversation status
          if (lead.conversation_status === "not_started") {
            await supabase.from("leads").update({ conversation_status: "in_progress" }).eq("id", leadId);
          }
        }
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("conversation-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
