/**
 * YouTube Data API v3 + Analytics API client — raw fetch, no googleapis dependency.
 * Honest-status rule (§8): every function throws a clear "needs configuration"
 * error when YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET or a channel refresh
 * token is missing. Never fakes a connected state.
 */
import { db } from "@/lib/db"
import { youtubeChannels } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { decrypt, encrypt } from "@/lib/crypto"

export function isYoutubeOAuthConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
}

export function getOAuthRedirectUri(origin: string): string {
  return `${origin}/api/auth/youtube/callback`
}

export function buildConsentUrl(origin: string, channelRowId: string): string {
  if (!isYoutubeOAuthConfigured()) throw new Error("YouTube OAuth not configured: set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.")
  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID!,
    redirect_uri: getOAuthRedirectUri(origin),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    state: channelRowId,
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ].join(" "),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: getOAuthRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

/** Get a valid access token for a channel, refreshing if expired. userId-scoped. */
export async function getAccessToken(userId: string, channelRowId: string): Promise<string> {
  const [channel] = await db
    .select()
    .from(youtubeChannels)
    .where(and(eq(youtubeChannels.id, channelRowId), eq(youtubeChannels.userId, userId)))
    .limit(1)
  if (!channel) throw new Error("Channel not found")
  if (!channel.oauthRefreshToken) throw new Error(`Channel "${channel.channelName}" needs OAuth setup (status: ${channel.status})`)

  if (channel.oauthAccessToken && channel.oauthTokenExpiry && channel.oauthTokenExpiry > new Date(Date.now() + 60_000)) {
    return decrypt(channel.oauthAccessToken)
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: decrypt(channel.oauthRefreshToken),
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    await db.update(youtubeChannels).set({ status: "needs_reauth" }).where(eq(youtubeChannels.id, channelRowId))
    throw new Error(`Token refresh failed for "${channel.channelName}" — channel marked needs_reauth`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  await db
    .update(youtubeChannels)
    .set({
      oauthAccessToken: encrypt(json.access_token),
      oauthTokenExpiry: new Date(Date.now() + json.expires_in * 1000),
      status: "connected",
    })
    .where(eq(youtubeChannels.id, channelRowId))
  return json.access_token
}

/** Upload a video (resumable, single-shot for typical short files). Returns YouTube video ID. */
export async function uploadVideo(
  userId: string,
  channelRowId: string,
  video: { buffer: ArrayBuffer; title: string; description: string; tags: string[] },
): Promise<string> {
  const token = await getAccessToken(userId, channelRowId)
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: { title: video.title, description: video.description, tags: video.tags },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    },
  )
  if (!initRes.ok) throw new Error(`Upload init failed: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get("location")
  if (!uploadUrl) throw new Error("Upload init returned no location header")
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: video.buffer,
  })
  if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`)
  const json = (await uploadRes.json()) as { id: string }
  return json.id
}

/** Set privacy — used by the one-click unpublish action (§4). */
export async function setVideoPrivacy(userId: string, channelRowId: string, youtubeVideoId: string, privacy: "private" | "unlisted" | "public") {
  const token = await getAccessToken(userId, channelRowId)
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: youtubeVideoId, status: { privacyStatus: privacy } }),
  })
  if (!res.ok) throw new Error(`Set privacy failed: ${await res.text()}`)
}

/** Basic stats snapshot via Data API (views/likes/comments) + Analytics watch time. */
export async function fetchVideoStats(userId: string, channelRowId: string, youtubeVideoId: string) {
  const token = await getAccessToken(userId, channelRowId)
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${youtubeVideoId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Stats fetch failed: ${await res.text()}`)
  const json = (await res.json()) as { items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }
  const s = json.items?.[0]?.statistics
  let watchTimeMinutes = 0
  try {
    const ares = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${new Date().toISOString().slice(0, 10)}&metrics=estimatedMinutesWatched&filters=video==${youtubeVideoId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (ares.ok) {
      const ajson = (await ares.json()) as { rows?: number[][] }
      watchTimeMinutes = Math.round(ajson.rows?.[0]?.[0] ?? 0)
    }
  } catch {
    // Analytics API optional — Data API stats still recorded
  }
  return {
    views: Number(s?.viewCount ?? 0),
    likes: Number(s?.likeCount ?? 0),
    comments: Number(s?.commentCount ?? 0),
    watchTimeMinutes,
  }
}
