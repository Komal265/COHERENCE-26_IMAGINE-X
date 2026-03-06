export default async function handler(
  req: { method?: string; body?: Record<string, unknown> },
  res: { setHeader: (k: string, v: string) => void; status: (n: number) => { end: () => void; json: (o: object) => void }; end: () => void }
) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  try {
    const { to, subject, body, fromEmail } = req.body as { to?: string; subject?: string; body?: string; fromEmail?: string };
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields: to, subject, body" });
    }

    const from = fromEmail || process.env.RESEND_FROM_EMAIL || "OutreachAI <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: (body as string).replace(/\n/g, "<br>"),
        text: body,
      }),
    });

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Failed to send email" });
    }
    return res.status(200).json({ id: data.id, success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
