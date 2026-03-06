import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NODE_OPTIONS = [
  { label: "Lead Upload", type: "trigger", icon: "Upload", desc: "Start when leads imported" },
  { label: "New Lead Added", type: "trigger", icon: "Zap", desc: "Trigger on new lead" },
  { label: "AI Generate Message", type: "action", icon: "Brain", desc: "Generate personalized outreach" },
  { label: "Send Email", type: "action", icon: "Mail", desc: "Send via email" },
  { label: "Send LinkedIn", type: "action", icon: "Linkedin", desc: "Send LinkedIn message" },
  { label: "Wait Delay", type: "action", icon: "Clock", desc: "Human-like delay" },
  { label: "Reply Received", type: "action", icon: "MessageSquare", desc: "Trigger when lead replies" },
  { label: "Reply Analyzer", type: "action", icon: "BarChart3", desc: "AI tone analysis of reply" },
  { label: "Generate Follow-Up", type: "action", icon: "Reply", desc: "AI smart follow-up suggestion" },
  { label: "Condition", type: "logic", icon: "GitBranch", desc: "Branch by condition" },
  { label: "Lead Filter", type: "logic", icon: "Filter", desc: "Filter leads" },
  { label: "A/B Split", type: "logic", icon: "Split", desc: "Split test messages" },
  { label: "Throttling Guard", type: "control", icon: "Shield", desc: "Rate limit protection" },
  { label: "Rate Limit", type: "control", icon: "Gauge", desc: "Max sends per hour" },
  { label: "Compliance Check", type: "control", icon: "CheckSquare", desc: "Verify compliance" },
  { label: "Log Event", type: "output", icon: "FileText", desc: "Log activity" },
  { label: "Update Status", type: "output", icon: "RefreshCw", desc: "Update lead status" },
  { label: "Send to CRM", type: "output", icon: "Send", desc: "Push to CRM" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: return default workflow when AI key not configured
      const defaultWorkflow = {
        nodes: [
          { label: "Lead Upload", type: "trigger", icon: "Upload", desc: "Start when leads imported" },
          { label: "AI Generate Message", type: "action", icon: "Brain", desc: "Generate personalized outreach" },
          { label: "Send Email", type: "action", icon: "Mail", desc: "Send via email" },
        ],
        edges: [[0, 1], [1, 2]],
      };
      return new Response(JSON.stringify(defaultWorkflow), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a workflow designer for a sales outreach automation app. Given a user prompt, return a JSON object with:
- "nodes": array of objects with "label", "type" (trigger|action|logic|control|output), "icon", "desc"
- "edges": array of [sourceIndex, targetIndex] pairs (0-based indices into nodes array)

Available node labels: ${NODE_OPTIONS.map((n) => n.label).join(", ")}.
Return ONLY valid JSON, no markdown or extra text.`;

    const userPrompt = `User request: "${prompt}"

Create a workflow. Example: for "send personalized emails to new leads with delay between each", return:
{"nodes":[{"label":"Lead Upload","type":"trigger","icon":"Upload","desc":"Start when leads imported"},{"label":"AI Generate Message","type":"action","icon":"Brain","desc":"Generate personalized outreach"},{"label":"Wait Delay","type":"action","icon":"Clock","desc":"Human-like delay"},{"label":"Send Email","type":"action","icon":"Mail","desc":"Send via email"}],"edges":[[0,1],[1,2],[2,3]]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    let parsed: { nodes?: Array<{ label: string; type: string; icon?: string; desc: string }>; edges?: Array<[number, number]> };
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nodes = (parsed.nodes || []).map((n) => ({
      label: n.label || "Node",
      type: n.type || "action",
      icon: n.icon || "Zap",
      desc: n.desc || "",
    }));

    const edges = (parsed.edges || []).filter(
      (e): e is [number, number] =>
        Array.isArray(e) && e.length === 2 && typeof e[0] === "number" && typeof e[1] === "number"
    );

    return new Response(JSON.stringify({ nodes, edges }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-workflow error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
