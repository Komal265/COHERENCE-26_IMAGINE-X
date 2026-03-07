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
            const { data: unreplied } = await supabase
              .from("messages")
              .select("id, lead_id, created_at")
              .is("reply_text", null)
              .in("status", ["sent", "replied", "followup_sent"])
              .order("created_at", { ascending: true });
            const leadToMessage = new Map<string, string>();
            for (const m of unreplied || []) {
              const key = (m as { lead_id: string }).lead_id;
              if (!leadToMessage.has(key)) leadToMessage.set(key, (m as { id: string }).id);
            }
            const ImapFlow = (await import("imapflow")).default;
            const { simpleParser } = await import("mailparser");
            const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }, logger: false });
            await client.connect();
            let updated = 0;
            try {
              const lock = await client.getMailboxLock("INBOX");
              try {
                const uids = await client.search({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, { uid: true });
                if (uids.length > 0) {
                  const list = client.fetch(uids, { envelope: true, source: true }, { uid: true });
                  for await (const msg of list) {
                  const raw = msg.source?.toString();
                  if (!raw) continue;
                  const parsed = await simpleParser(raw);
                  const from = parsed.from?.value?.[0]?.address?.toLowerCase?.() || "";
                  const lead = leadByEmail.get(from);
                  if (!lead) continue;
                  const messageId = leadToMessage.get(lead.id);
                  if (!messageId) continue;
                  const text = (parsed.text || parsed.html || "").replace(/<[^>]+>/g, " ").trim().slice(0, 10000);
                  const tone = classifyTone(text);
                  const { error } = await supabase
                    .from("messages")
                    .update({ reply_text: text, reply_tone: tone, reply_received_at: new Date().toISOString(), status: "replied" })
                    .eq("id", messageId);
                  if (!error) {
                    updated++;
                    leadToMessage.delete(lead.id);
                  }
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
