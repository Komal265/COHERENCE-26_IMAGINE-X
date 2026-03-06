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

export function sendEmailPlugin(): Plugin {
  return {
    name: "send-email-api",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
