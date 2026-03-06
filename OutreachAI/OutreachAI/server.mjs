/** Local dev server for /api/send-email - run with: npm run dev:api (or node server.mjs) */
import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import nodemailer from "nodemailer";

// Load .env manually (no dotenv dep)
try {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const useGmail = GMAIL_USER && GMAIL_APP_PASSWORD;

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url?.startsWith("/api/send-email") || req.method !== "POST") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (!useGmail && !RESEND_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Set RESEND_API_KEY in .env, or GMAIL_USER + GMAIL_APP_PASSWORD to send without a domain" }));
    return;
  }

  try {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    const body = await new Promise((resolve, reject) => {
      req.on("end", () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
      req.on("error", reject);
    });
    const { to, subject, body: emailBody, fromEmail } = body;
    if (!to || !subject || !emailBody) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields: to, subject, body" }));
      return;
    }

    if (useGmail) {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, "") },
      });
      const from = fromEmail || RESEND_FROM_EMAIL || `OutreachAI <${GMAIL_USER}>`;
      await transporter.sendMail({
        from,
        to,
        subject,
        html: String(emailBody).replace(/\n/g, "<br>"),
        text: emailBody,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
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
    const status = r.status;
    const message = data.message || data.error || "Failed to send";
    if (status === 403) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Resend 403: Use Gmail instead (uncomment GMAIL_USER and GMAIL_APP_PASSWORD in .env) or verify a domain at resend.com/domains" }));
      return;
    }
    res.writeHead(r.ok ? 200 : status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r.ok ? { id: data.id, success: true } : { error: message }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message || "Unknown error" }));
  }
});

const PORT = 3001;
server.listen(PORT, () => console.log("API server: http://localhost:" + PORT + "/api/send-email"));
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use. Close other terminals running 'npm run dev' or run: taskkill /F /IM node.exe");
    process.exit(1);
  }
  throw err;
});
