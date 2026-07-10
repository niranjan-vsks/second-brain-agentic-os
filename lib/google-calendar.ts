/**
 * Google Calendar API client — raw fetch, no googleapis dependency, mirroring
 * lib/youtube-api.ts. Direct OAuth (deliberate design decision over MCP:
 * Jarvis is a single in-house agent needing 3 operations, so a protocol layer
 * would be overkill — same power, fewer moving parts).
 *
 * Uses GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET if set, else falls back to
 * YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET (same Google Cloud project can serve
 * both — just enable the Calendar API and add the callback URL).
 * Tokens encrypted at rest via lib/crypto.ts. Honest-status rule: throws a
 * clear "needs configuration" error, never fakes a connected state.
 */
import { db } from "@/lib/db"
import { connectedAccounts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { decrypt, encrypt } from "@/lib/crypto"

function clientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID
}
function clientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET
}

export function isCalendarOAuthConfigured(): boolean {
  return Boolean(clientId() && clientSecret())
}

export function getCalendarRedirectUri(origin: string): string {
  return `${origin}/api/auth/google-calendar/callback`
}

export function buildCalendarConsentUrl(origin: string, userId: string): string {
  if (!isCalendarOAuthConfigured()) {
    throw new Error("Google OAuth not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or reuse YOUTUBE_CLIENT_ID/SECRET with the Calendar API enabled).")
  }
  const params = new URLSearchParams({
    client_id: clientId()!,
    redirect_uri: getCalendarRedirectUri(origin),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    state: userId,
    scope: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email"].join(" "),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCalendarCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId()!,
      client_secret: clientSecret()!,
      redirect_uri: getCalendarRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) throw new Error(`Calendar token exchange failed: ${await res.text()}`)
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

/** Get the user's calendar connection row, or null. */
export async function getCalendarConnection(userId: string) {
  const [row] = await db
    .select()
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, "google_calendar"), eq(connectedAccounts.status, "connected")))
    .limit(1)
  return row ?? null
}

/** Valid access token for the user's calendar, refreshing if expired. */
async function getCalendarAccessToken(userId: string): Promise<string> {
  const conn = await getCalendarConnection(userId)
  if (!conn?.refreshToken) throw new Error("Google Calendar not connected — connect it from the Jarvis tab.")

  if (conn.accessToken && conn.tokenExpiry && conn.tokenExpiry > new Date(Date.now() + 60_000)) {
    return decrypt(conn.accessToken)
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId()!,
      client_secret: clientSecret()!,
      refresh_token: decrypt(conn.refreshToken),
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    await db.update(connectedAccounts).set({ status: "error", updatedAt: new Date() }).where(eq(connectedAccounts.id, conn.id))
    throw new Error(`Calendar token refresh failed: ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  await db
    .update(connectedAccounts)
    .set({ accessToken: encrypt(json.access_token), tokenExpiry: new Date(Date.now() + json.expires_in * 1000), updatedAt: new Date() })
    .where(eq(connectedAccounts.id, conn.id))
  return json.access_token
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink?: string
}

/** List upcoming events in a window (defaults: now → +7 days). */
export async function listEvents(userId: string, opts?: { timeMin?: string; timeMax?: string; maxResults?: number }): Promise<CalendarEvent[]> {
  const token = await getCalendarAccessToken(userId)
  const params = new URLSearchParams({
    timeMin: opts?.timeMin ?? new Date().toISOString(),
    timeMax: opts?.timeMax ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
    maxResults: String(opts?.maxResults ?? 20),
    singleEvents: "true",
    orderBy: "startTime",
  })
  const res = await fetch(`${CAL_BASE}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Calendar list failed: ${await res.text()}`)
  const json = (await res.json()) as { items?: CalendarEvent[] }
  return json.items ?? []
}

/** Create an event. Times are ISO 8601 with timezone (e.g. "2026-07-11T15:00:00+05:30"). */
export async function createEvent(
  userId: string,
  input: { summary: string; description?: string; startDateTime: string; endDateTime: string; timeZone?: string },
): Promise<CalendarEvent> {
  const token = await getCalendarAccessToken(userId)
  const tz = input.timeZone ?? "Asia/Kolkata"
  const res = await fetch(CAL_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description ?? "",
      start: { dateTime: input.startDateTime, timeZone: tz },
      end: { dateTime: input.endDateTime, timeZone: tz },
    }),
  })
  if (!res.ok) throw new Error(`Calendar create failed: ${await res.text()}`)
  return (await res.json()) as CalendarEvent
}

/** Delete an event by id. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const token = await getCalendarAccessToken(userId)
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar delete failed: ${await res.text()}`)
  }
}
