/**
 * Render poller cron (§12.4) — submits queued edit_requests to Remotion Lambda,
 * polls active renders, persists output to Blob, creates edit_versions rows.
 *
 * CONFIGURABLE STUB: Remotion Lambda provisioning is a Task 0 owner step (deploy
 * via `npx remotion lambda functions deploy`, then set REMOTION_LAMBDA_FUNCTION_NAME,
 * REMOTION_LAMBDA_REGION, REMOTION_LAMBDA_BUCKET, REMOTION_SERVE_URL and AWS creds).
 * Until then this route reports skipped honestly — it never fakes a render.
 * When provisioned, replace the submitRender/pollRender internals with
 * @remotion/lambda's renderMediaOnLambda/getRenderProgress — the surrounding
 * state handling is already final.
 */
import { db } from "@/lib/db"
import { editRequests, editVersions, notifications } from "@/lib/db/schema"
import { and, eq, inArray, desc } from "drizzle-orm"
import { persistRemoteFile } from "@/lib/storage"
import { randomUUID } from "crypto"

export const maxDuration = 300

function isRemotionConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_LAMBDA_FUNCTION_NAME && process.env.REMOTION_LAMBDA_REGION && process.env.REMOTION_LAMBDA_BUCKET,
  )
}

// STUB seam — swap internals for @remotion/lambda calls once provisioned.
async function submitRender(_spec: string, _sourceUrl: string): Promise<string> {
  throw new Error("STUB: Remotion Lambda render submission not implemented until provisioning (Task 0).")
}
async function pollRender(_renderJobId: string): Promise<{ done: boolean; outputUrl?: string; error?: string }> {
  throw new Error("STUB: Remotion Lambda render polling not implemented until provisioning (Task 0).")
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isRemotionConfigured()) {
    return Response.json({ skipped: true, reason: "Remotion Lambda not configured (REMOTION_LAMBDA_* env vars missing)" })
  }

  const active = await db.select().from(editRequests).where(inArray(editRequests.status, ["submitted", "rendering"])).limit(10)
  const results: Record<string, string> = {}
  for (const request of active) {
    try {
      if (request.status === "submitted") {
        const renderJobId = await submitRender(request.remotionSpec, request.sourceBlobUrl)
        await db.update(editRequests).set({ status: "rendering", renderJobId }).where(eq(editRequests.id, request.id))
        results[request.id] = "rendering"
      } else if (request.renderJobId) {
        const progress = await pollRender(request.renderJobId)
        if (progress.done && progress.outputUrl) {
          const outputBlobUrl = await persistRemoteFile(
            progress.outputUrl,
            `videos/${request.userId}/${request.videoProjectId}/edit-${request.id}.mp4`,
          )
          await db.update(editRequests).set({ status: "complete", outputBlobUrl }).where(eq(editRequests.id, request.id))
          const [latest] = await db
            .select({ versionNumber: editVersions.versionNumber })
            .from(editVersions)
            .where(eq(editVersions.videoProjectId, request.videoProjectId))
            .orderBy(desc(editVersions.versionNumber))
            .limit(1)
          await db
            .update(editVersions)
            .set({ isCurrent: false })
            .where(and(eq(editVersions.videoProjectId, request.videoProjectId), eq(editVersions.isCurrent, true)))
          await db.insert(editVersions).values({
            id: randomUUID(),
            userId: request.userId,
            videoProjectId: request.videoProjectId,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            editRequestId: request.id,
            blobUrl: outputBlobUrl,
            isCurrent: true,
          })
          await db.insert(notifications).values({
            userId: request.userId,
            type: "edit_complete",
            message: `Edit rendered: "${request.editPrompt.slice(0, 80)}" — new version is current.`,
          })
          results[request.id] = "complete"
        } else if (progress.error) {
          await db.update(editRequests).set({ status: "failed", errorMessage: progress.error }).where(eq(editRequests.id, request.id))
          results[request.id] = "failed"
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown"
      await db.update(editRequests).set({ status: "failed", errorMessage: msg }).where(eq(editRequests.id, request.id))
      results[request.id] = `error: ${msg}`
    }
  }
  return Response.json({ active: active.length, results })
}
