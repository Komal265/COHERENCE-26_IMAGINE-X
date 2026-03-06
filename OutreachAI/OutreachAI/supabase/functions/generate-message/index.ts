import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getFallbackMessage(lead: { name?: string; company?: string; industry?: string; role?: string }) {
  const name = lead?.name || "there";
  const company = lead?.company || "your company";
  return `Hi ${name},

I hope this message finds you well. I'm reaching out regarding opportunities at ${company}. We've helped similar organizations improve their outreach and engagement.

I'd love to arrange a brief call at your convenience to explore how we might support ${company}. Would you be open to a 15-minute conversation this week?

Best regards`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ message: getFallbackMessage(lead || {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Write a personalized outreach email.

Lead Information:
Name: ${lead?.name || "there"}
Company: ${lead?.company || "their company"}
Industry: ${lead?.industry || "technology"}
Role: ${lead?.role || "professional"}

Write a short personalized outreach email offering our solution.
Make it sound human and natural. Keep it under 100 words.
Return ONLY the email body text, no subject line.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional outreach email writer. Write concise, personalized emails." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ message: getFallbackMessage(lead || {}) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ message: getFallbackMessage(lead || {}) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(JSON.stringify({ message: getFallbackMessage(lead || {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || getFallbackMessage(lead || {});

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-message error:", e);
    return new Response(
      JSON.stringify({ message: getFallbackMessage({}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
