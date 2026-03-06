import { supabaseFunctions } from "@/integrations/supabase/client";

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL;

async function invokeEdgeFunction<T>(name: string, body: object): Promise<{ data?: T; error?: string }> {
  try {
    const { data, error } = await supabaseFunctions.functions.invoke(name, { body });
    if (error) return { error: error.message } as { error: string };
    return { data: data as T };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function invokeGenerateMessage(lead: { name?: string; company?: string; industry?: string; role?: string }) {
  return invokeEdgeFunction<{ message: string }>("generate-message", { lead });
}

const FROM_EMAIL_KEY = "outreach_from_email";

export function getFromEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(FROM_EMAIL_KEY) || "";
}

export function setFromEmail(value: string): void {
  if (typeof window === "undefined") return;
  if (value.trim()) localStorage.setItem(FROM_EMAIL_KEY, value.trim());
  else localStorage.removeItem(FROM_EMAIL_KEY);
}

async function sendViaApi(url: string, params: { to: string; subject: string; body: string; fromEmail?: string }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { data: { success: true } };
  return { error: (data?.error || `HTTP ${res.status}`) as string };
}

export async function invokeSendEmail(params: { to: string; subject: string; body: string; fromEmail?: string }) {
  const fromEmail = params.fromEmail || getFromEmail();
  const payload = { ...params, ...(fromEmail ? { fromEmail } : {}) };

  const urls: string[] = [];
  if (EMAIL_API_URL) urls.push(EMAIL_API_URL.endsWith("/api/send-email") ? EMAIL_API_URL : `${EMAIL_API_URL.replace(/\/$/, "")}/api/send-email`);
  if (typeof window !== "undefined") {
    urls.push(`${window.location.origin}/api/send-email`);
    if (window.location.port === "8080" || window.location.hostname === "localhost") {
      urls.push("http://localhost:3001/api/send-email");
    }
  }

  for (const url of urls) {
    try {
      const result = await sendViaApi(url, payload);
      if (!result.error) return result;
    } catch {
      /* Network error - try next URL */
    }
  }

  return invokeEdgeFunction<{ success?: boolean; error?: string }>("send-email", payload);
}
