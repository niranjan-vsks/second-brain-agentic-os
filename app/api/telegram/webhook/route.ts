/**
 * Telegram bot webhook (§9) — read-only question answering via the same
 * text-to-SQL engine as the web chat. Auth is a REAL requirement: only the
 * allow-listed TELEGRAM_ALLOWED_USER_ID is processed; everything else ignored.
 * No mutating actions via Telegram in this PRD (explicit boundary).
 *
 * Setup: create bot via BotFather, set TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USER_ID
 * + OS_OWNER_USER_ID (the Better Auth user id), then register the webhook:
 * https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>/api/telegram/webhook
 */
import { answerOsQuestion } from "@/lib/os-chat"

export const maxDuration = 60

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const allowedTelegramId = process.env.TELEGRAM_ALLOWED_USER_ID
  const ownerUserId = process.env.OS_OWNER_USER_ID
  if (!token || !allowedTelegramId || !ownerUserId) {
    // Honest "needs configuration" — respond 200 so Telegram doesn't retry-storm
    return Response.json({ ok: true, skipped: "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ALLOWED_USER_ID / OS_OWNER_USER_ID)" })
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
