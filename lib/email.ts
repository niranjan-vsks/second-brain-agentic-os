import "server-only"
// Email send seam (Resend) — env/vault-activated, same pattern as every other
// external service. Until a Resend key + EMAIL_FROM are set, isEmailConfigured
// is false and callers keep everything as drafts (never silently no-op a send).

import { getSecret } from "@/lib/config"

export async function isEmailConfigured(userId: string): Promise<boolean> {
  const key = await getSecret(userId, "resend", "email.send")
  return Boolean(key && process.env.EMAIL_FROM)
}

export async function sendEmail(
  userId: string,
  msg: { to: string; subject: string; text: string; replyTo?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const key = await getSecret(userId, "resend", "email.send")
  const from = process.env.EMAIL_FROM
  if (!key || !from) return { ok: false as const, error: "Email not configured — add a Resend key + EMAIL_FROM" }
  if (!msg.to) return { ok: false as const, error: "No recipient email" }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return { ok: false as const, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    const data = (await res.json()) as { id?: string }
    return { ok: true as const, id: data.id ?? "" }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "send failed" }
  }
}
