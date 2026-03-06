import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead, reply_text, reply_tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const rules = {
      positive: "Suggest scheduling a call or meeting. Be enthusiastic and helpful.",
      neutral: "Provide more details about your solution. Offer value without being pushy.",
      negative: "Politely acknowledge their response and close the conversation. Leave the door open.",
    };

    const prompt = `A lead replied to our outreach email. Write an appropriate follow-up response.

Lead:
Name: ${lead?.name || "there"}
Company: ${lead?.company || "their company"}
Role: ${lead?.role || "professional"}

Their Reply:
${reply_text || "No reply text"}

Tone: ${reply_tone || "neutral"}

Rules for this tone:
${rules[reply_tone as keyof typeof rules] || rules.neutral}

Write a professional follow-up email. Keep it under 80 words. Return ONLY the email body.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional sales follow-up writer. Write concise, appropriate responses." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const followup_message = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ followup_message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-followup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
