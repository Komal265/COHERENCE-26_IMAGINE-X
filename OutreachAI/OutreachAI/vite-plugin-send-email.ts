import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage } from "http";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function classifyTone(text: string): "positive" | "neutral" | "negative" {
  const t = (text || "").toLowerCase();
  const pos = ["interested", "yes", "great", "thanks", "thank you", "sure", "love to", "happy to", "excited", "sounds good", "let's do", "perfect", "awesome"];
  const neg = ["not interested", "no thanks", "unsubscribe", "stop", "don't", "won't", "can't", "busy", "remove", "decline"];
  const posScore = pos.filter((w) => t.includes(w)).length;
  const negScore = neg.filter((w) => t.includes(w)).length;
  if (negScore > posScore) return "negative";
  if (posScore > 0) return "positive";
  return "neutral";
}

export function sendEmailPlugin(): Plugin {
  return {
    name: "send-email-api",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url === "/api/fetch-replies" && (req.method === "POST" || req.method === "GET")) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          const env = loadEnv(server.config.mode, process.cwd(), "");
          const GMAIL_USER = env.GMAIL_USER || process.env.GMAIL_USER;
          const GMAIL_APP_PASSWORD = (env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD)?.replace(/\s/g, "");
          const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Set GMAIL_USER and GMAIL_APP_PASSWORD in .env to fetch replies" }));
            return;
          }
          if (!supabaseUrl || !supabaseKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env" }));
            return;
          }
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: leads } = await supabase.from("leads").select("id, email").not("email", "is", null);
            const leadByEmail = new Map<string, { id: string }>((leads || []).map((l: { id: string; email: string }) => [l.email.toLowerCase().trim(), l]));
            const { ImapFlow } = await import("imapflow");
            const { simpleParser } = await import("mailparser");
            const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }, logger: false });
            await client.connect();
            let updated = 0;
            try {
              const lock = await client.getMailboxLock("INBOX");
              try {
                const uids = await client.search({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, { uid: true });
                const uidList = Array.isArray(uids) ? uids : [];
                if (uidList.length > 0) {
                  const list = client.fetch(uidList, { envelope: true, source: true }, { uid: true });
                  const repliesByLead: Array<{ leadId: string; text: string; date: Date }> = [];
                  for await (const msg of list) {
                    const raw = msg.source?.toString();
                    if (!raw) continue;
                    const parsed = await simpleParser(raw);
                    const from = parsed.from?.value?.[0]?.address?.toLowerCase?.() || "";
                    const lead = leadByEmail.get(from);
                    if (!lead) continue;
                    const text = (parsed.text || parsed.html || "").replace(/<[^>]+>/g, " ").trim().slice(0, 10000);
                    const date = parsed.date || new Date();
                    repliesByLead.push({ leadId: lead.id, text, date });
                  }
                  const newestPerLead = new Map<string, { text: string; date: Date }>();
                  for (const r of repliesByLead) {
                    const existing = newestPerLead.get(r.leadId);
                    if (!existing || r.date > existing.date) newestPerLead.set(r.leadId, { text: r.text, date: r.date });
                  }
                  for (const [leadId, { text, date }] of newestPerLead) {
                    const { data: latestMessages } = await supabase
                      .from("messages")
                      .select("id")
                      .eq("lead_id", leadId)
                      .in("status", ["sent", "replied", "followup_sent"])
                      .order("created_at", { ascending: false })
                      .limit(1);
                    const latestMessage = latestMessages?.[0];
                    if (!latestMessage?.id) continue;
                    const tone = classifyTone(text);
                    const { error } = await supabase
                      .from("messages")
                      .update({
                        reply_text: text,
                        reply_tone: tone,
                        reply_received_at: date.toISOString(),
                        status: "replied",
                      })
                      .eq("id", latestMessage.id);
                    if (!error) updated++;
                  }
                }
              } finally {
                lock.release();
              }
            } finally {
              await client.logout();
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, updated }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
          }
          return;
        }
        if (url === "/api/process-auto-follow-ups" && (req.method === "POST" || req.method === "GET")) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          const env = loadEnv(server.config.mode, process.cwd(), "");
          const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !supabaseKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env" }));
            return;
          }
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(supabaseUrl, supabaseKey);
            const now = new Date().toISOString();
            const { data: rows } = await supabase
              .from("messages")
              .select("id, lead_id, generated_message, reply_tone, leads (id, name, email, company)")
              .eq("status", "sent")
              .is("reply_text", null)
              .not("follow_up_after", "is", null)
              .lte("follow_up_after", now)
              .is("auto_follow_up_sent_at", null);
            const port = server.config.server?.port ?? 8080;
            const base = `http://127.0.0.1:${port}`;
            let sent = 0;
            for (const row of rows || []) {
              const r = row as { id: string; lead_id: string; generated_message: string | null; reply_tone: string | null; leads: { id: string; name: string; email: string; company: string | null } | null };
              if (r.reply_tone === "negative") continue;
              const lead = r.leads;
              if (!lead?.email) continue;
              const name = lead.name || "there";
              const company = lead.company || "your company";
              const followupBody = `Hi ${name},\n\nI wanted to follow up on my previous message about ${company}. Would you have a few minutes to connect this week?\n\nBest`;
              const subject = `Following up – ${company}`;
              const sendRes = await fetch(`${base}/api/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: lead.email, subject, body: followupBody }),
              });
              const sendData = await sendRes.json().catch(() => ({}));
              if (!sendRes.ok || sendData?.error) continue;
              const { error: upErr } = await supabase
                .from("messages")
                .update({
                  status: "followup_sent",
                  followup_message: followupBody,
                  auto_follow_up_sent_at: new Date().toISOString(),
                } as Record<string, unknown>)
                .eq("id", r.id);
              if (!upErr) sent++;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, sent }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
          }
          return;
        }
        if (!req.url?.startsWith("/api/send-email")) return next();
        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        const env = loadEnv(server.config.mode, process.cwd(), "");
        const RESEND_API_KEY = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
        const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
        const GMAIL_USER = env.GMAIL_USER || process.env.GMAIL_USER;
        const GMAIL_APP_PASSWORD = (env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD)?.replace(/\s/g, "");
        const useGmail = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", "application/json");

        if (!useGmail && !RESEND_API_KEY) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Set RESEND_API_KEY in .env, or GMAIL_USER + GMAIL_APP_PASSWORD to send without a domain" }));
          return;
        }

        try {
          const body = JSON.parse(await readBody(req));
          const { to, subject, body: emailBody, fromEmail } = body;
          if (!to || !subject || !emailBody) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing required fields: to, subject, body" }));
            return;
          }

          if (useGmail) {
            const nodemailer = await import("nodemailer");
            const transporter = nodemailer.default.createTransport({
              host: "smtp.gmail.com",
              port: 587,
              secure: false,
              auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
            });
            const from = fromEmail || RESEND_FROM_EMAIL || `OutreachAI <${GMAIL_USER}>`;
            await transporter.sendMail({
              from,
              to,
              subject,
              html: String(emailBody).replace(/\n/g, "<br>"),
              text: emailBody,
            });
            res.statusCode = 200;
            res.end(JSON.stringify({ id: "gmail", success: true }));
            return;
          }

          const from = fromEmail || RESEND_FROM_EMAIL || "OutreachAI <onboarding@resend.dev>";
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: [to],
              subject,
              html: String(emailBody).replace(/\n/g, "<br>"),
              text: emailBody,
            }),
          });
          const data = await r.json();
          if (r.status === 403) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Resend 403: Use Gmail (set GMAIL_USER and GMAIL_APP_PASSWORD in .env) or verify a domain at resend.com/domains" }));
            return;
          }
          res.statusCode = r.ok ? 200 : r.status;
          res.end(JSON.stringify(r.ok ? { id: data.id, success: true } : { error: data.message || "Failed to send" }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
        }
      });
    },
  };
}
