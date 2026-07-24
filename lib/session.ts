import "server-only"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

// Route-level auth guard for RSC pages/layouts. Returns the session user or
// redirects to /sign-in. Mirrors the per-action getUserId() invariant.
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")
  return session.user
}
