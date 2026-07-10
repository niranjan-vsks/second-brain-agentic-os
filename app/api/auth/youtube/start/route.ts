/**
 * YouTube OAuth start (§13, Task 6) — redirects the signed-in owner to Google's
 * consent screen for a specific channel row. ?channelId=<youtube_channels.id>
 */
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { youtubeChannels } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { buildConsentUrl, isYoutubeOAuthConfigured } from "@/lib/youtube-api"
import { headers } from "next/headers"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isYoutubeOAuthConfigured()) {
    return Response.json(
      { error: "YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (see §13 of the PRD / CLAUDE.md)." },
      { status: 503 },
    )
  }
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  if (!channelId) return Response.json({ error: "channelId required" }, { status: 400 })
  const [channel] = await db
    .select({ id: youtubeChannels.id })
    .from(youtubeChannels)
    .where(and(eq(youtubeChannels.id, channelId), eq(youtubeChannels.userId, session.user.id)))
    .limit(1)
  if (!channel) return Response.json({ error: "Channel not found" }, { status: 404 })
  return Response.redirect(buildConsentUrl(url.origin, channelId))
}
