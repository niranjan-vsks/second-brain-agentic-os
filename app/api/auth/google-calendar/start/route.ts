/**
 * Google Calendar OAuth start — redirects the signed-in owner to Google's
 * consent screen. Mirrors the YouTube OAuth start route.
 */
import { auth } from "@/lib/auth"
import { buildCalendarConsentUrl, isCalendarOAuthConfigured } from "@/lib/google-calendar"
import { headers } from "next/headers"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isCalendarOAuthConfigured()) {
    return Response.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or reuse YOUTUBE_CLIENT_ID/SECRET with the Calendar API enabled)." },
      { status: 503 },
    )
  }
  const url = new URL(req.url)
  return Response.redirect(buildCalendarConsentUrl(url.origin, session.user.id))
}
