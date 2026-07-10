/**
 * Thin storage interface (§6 of the YouTube PRD) — the seam where an S3 swap
 * happens later without touching calling code. Backed by Vercel Blob today.
 * Requires BLOB_READ_WRITE_TOKEN (auto-set when the Blob integration is added).
 */
import { put } from "@vercel/blob"

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** Save a video/image buffer under a deterministic path; returns the permanent URL. */
export async function saveVideo(data: Buffer | ArrayBuffer, path: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Storage not configured: BLOB_READ_WRITE_TOKEN missing. Add the Vercel Blob integration.")
  }
  const payload: Blob = new Blob([data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)])
  const blob = await put(path, payload, {
    access: "public",
    addRandomSuffix: false,
  })
  return blob.url
}

/** Fetch a remote temp URL (e.g. Higgsfield output) and persist it to Blob. */
export async function persistRemoteFile(tempUrl: string, path: string): Promise<string> {
  const res = await fetch(tempUrl)
  if (!res.ok) throw new Error(`Failed to fetch remote file (${res.status}): ${tempUrl}`)
  return saveVideo(await res.arrayBuffer(), path)
}
