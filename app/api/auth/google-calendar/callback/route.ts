/**
 * Google Calendar OAuth callback — exchanges the code for tokens, stores them
 * ENCRYPTED, verifies against the real API (fetches the account email — never
 * fake-connected), then upserts the connected_accounts row.
 */
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { connectedAccounts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { exchangeCalendarCode } from "@/lib/google-calendar"
import { encrypt } from "@/lib/crypto"
import { headers } from "next/headers"
import { randomUUID } from "crypto"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateUserId = url.searchParams.get("state")
  if (!code || stateUserId !== session.user.id) {
    return Response.json({ error: "Missing code or state mismatch" }, { status: 400 })
  }

  try {
    const tokens = await exchangeCalendarCode(code, url.origin)
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token (revoke prior access at myaccount.google.com/permissions and retry)")

    // Verify against the real API — fetch the account email (honest-status rule)
    const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!meRes.ok) throw new Error(`Account verification failed: ${await meRes.text()}`)
    const me = (await meRes.json()) as { email?: string }

    const values = {
      accountEmail: me.email ?? "",
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      status: "connected" as const,
      updatedAt: new Date(),
    }

    const [existing] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.userId, session.user.id), eq(connectedAccounts.provider, "google_calendar")))
      .limit(1)

    if (existing) {
      await db.update(connectedAccounts).set(values).where(eq(connectedAccounts.id, existing.id))
    } else {
      await db.insert(connectedAccounts).values({ id: randomUUID(), userId: session.user.id, provider: "google_calendar", ...values })
    }

    return Response.redirect(`${url.origin}/?calendar=connected`)
  } catch (e) {
    return Response.redirect(`${url.origin}/?calendar=error&message=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`)
  }
}
