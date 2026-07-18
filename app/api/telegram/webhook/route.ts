/**
 * Telegram bot webhook (§9) — read-only question answering via the same
 * text-to-SQL engine as the web chat. Auth is a REAL requirement: only the
 * allow-listed Telegram user id is processed; everything else ignored.
 * No mutating actions via Telegram in this PRD (explicit boundary).
 *
 * Configurable two ways (env wins if set, otherwise Settings → Connections):
 *   - Bot token: TELEGRAM_BOT_TOKEN env, or a "Telegram Bot" key in API Keys
 *   - Allowed Telegram user id: TELEGRAM_ALLOWED_USER_ID env, or the
 *     "Allowed Telegram user id" field in Settings → Connections
 *   - Owner (Better Auth) user id: OS_OWNER_USER_ID env, or auto-resolved to
 *     the single-tenant app's first-created user (single-operator app)
 *
 * Setup: create bot via BotFather, configure it in Settings → Connections
 * (or the env vars above), then register the webhook:
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>/api/telegram/webhook
 */
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { answerOsQuestion } from "@/lib/os-chat"
import { getSecret, getConfig, CONNECTIONS_DEFAULTS } from "@/lib/config"

export const maxDuration = 60

async function resolveOwnerUserId(): Promise<string | null> {
  if (process.env.OS_OWNER_USER_ID) return process.env.OS_OWNER_USER_ID
  const [row] = await db.select({ id: userTable.id }).from(userTable).orderBy(asc(userTable.createdAt)).limit(1)
  return row?.id ?? null
}

export async function POST(req: Request) {
  const ownerUserId = await resolveOwnerUserId()
  if (!ownerUserId) {
    return Response.json({ ok: true, skipped: "No app user exists yet — sign up first" })
  }

  const [storedToken, connections] = await Promise.all([
    getSecret(ownerUserId, "telegram_bot"),
    getConfig(ownerUserId, "connections", CONNECTIONS_DEFAULTS),
  ])
  const token = storedToken || process.env.TELEGRAM_BOT_TOKEN
  const allowedTelegramId = connections.telegramAllowedUserId || process.env.TELEGRAM_ALLOWED_USER_ID
  if (!token || !allowedTelegramId) {
    // Honest "needs configuration" — respond 200 so Telegram doesn't retry-storm
    return Response.json({
      ok: true,
      skipped: "Telegram not configured — add a Telegram Bot key + Allowed Telegram User ID in Settings → Connections",
    })
  }

  const update = (await req.json()) as {
    message?: { text?: string; from?: { id: number }; chat?: { id: number } }
  }
  const fromId = update.message?.from?.id
  const chatId = update.message?.chat?.id
  const text = update.message?.text

  // Allow-list gate: silently ignore anyone else (§9)
  if (!fromId || String(fromId) !== allowedTelegramId || !chatId || !text) {
    return Response.json({ ok: true })
  }

  const answer = await answerOsQuestion(ownerUserId, text, "telegram")

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: answer.slice(0, 4000) }),
  })
  return Response.json({ ok: true })
}
