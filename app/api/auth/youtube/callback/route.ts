/**
 * YouTube OAuth callback — exchanges the code for tokens, stores the refresh
 * token ENCRYPTED (§8), verifies the connection against the real API (fetches
 * the channel id — never fake-connected), then marks the channel `connected`.
 */
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { youtubeChannels } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { exchangeCodeForTokens } from "@/lib/youtube-api"
import { encrypt } from "@/lib/crypto"
import { headers } from "next/headers"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const channelRowId = url.searchParams.get("state")
  if (!code || !channelRowId) return Response.json({ error: "Missing code/state" }, { status: 400 })

  try {
    const tokens = await exchangeCodeForTokens(code, url.origin)
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token (revoke prior access and retry with prompt=consent)")

    // Verify against the real API — fetch the actual channel ID (§8 honest-status rule)
    const meRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!meRes.ok) throw new Error(`Channel verification failed: ${await meRes.text()}`)
    const me = (await meRes.json()) as { items?: { id: string; snippet?: { title?: string } }[] }
    const realChannelId = me.items?.[0]?.id
    if (!realChannelId) throw new Error("No YouTube channel found on this Google account")

    await db
      .update(youtubeChannels)
      .set({
        youtubeChannelId: realChannelId,
        oauthRefreshToken: encrypt(tokens.refresh_token),
        oauthAccessToken: encrypt(tokens.access_token),
        oauthTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        status: "connected",
      })
      .where(and(eq(youtubeChannels.id, channelRowId), eq(youtubeChannels.userId, session.user.id)))

    return Response.redirect(`${url.origin}/?youtube=connected`)
  } catch (e) {
    return Response.redirect(`${url.origin}/?youtube=error&message=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`)
  }
}
