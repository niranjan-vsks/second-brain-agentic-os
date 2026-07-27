"use server"

// Resume file import — PDF / DOCX / plain text/markdown -> markdown text, so
// the operator can upload a file instead of hand-pasting. Runs server-side
// (uploaded file arrives as base64 from the client). No Python runtime is
// available on Vercel, so this uses JS-native equivalents of markitdown:
// pdf-parse for PDF text extraction, mammoth for DOCX -> markdown.

import { auth } from "@/lib/auth"
import { headers } from "next/headers"

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
}

const MAX_BYTES = 15 * 1024 * 1024 // 15MB

export async function parseResumeFileAction(
  base64: string,
  filename: string,
): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  await requireAuth()

  let buf: Buffer
  try {
    buf = Buffer.from(base64, "base64")
  } catch {
    return { ok: false, error: "Couldn't decode the uploaded file" }
  }
  if (buf.length === 0) return { ok: false, error: "File is empty" }
  if (buf.length > MAX_BYTES) return { ok: false, error: "File too large (max 15MB)" }

  const ext = (filename.split(".").pop() || "").toLowerCase()

  try {
    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buf) })
      // pageJoiner defaults to "-- N of M --" markers between pages — noise for
      // a resume; a blank line is enough of a page break for the tailoring agent.
      const result = await parser.getText({ pageJoiner: "\n\n" })
      await parser.destroy()
      const text = result.text.trim()
      if (!text) return { ok: false, error: "Couldn't extract any text from this PDF (it may be a scanned image)" }
      return { ok: true, markdown: text }
    }
    if (ext === "docx") {
      // mammoth only ships convertToHtml/extractRawText (no markdown mode) —
      // raw text is the reliable choice for a resume, no lossy HTML stripping.
      const { default: mammoth } = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer: buf })
      const text = result.value.trim()
      if (!text) return { ok: false, error: "Couldn't extract any text from this DOCX" }
      return { ok: true, markdown: text }
    }
    if (ext === "md" || ext === "txt" || ext === "markdown") {
      return { ok: true, markdown: buf.toString("utf8").trim() }
    }
    if (ext === "doc") {
      return { ok: false, error: "Legacy .doc isn't supported — save it as .docx or .pdf and re-upload" }
    }
    return { ok: false, error: `Unsupported file type ".${ext}" — upload PDF, DOCX, or Markdown/text` }
  } catch (e) {
    return { ok: false, error: `Failed to parse the file: ${e instanceof Error ? e.message : "unknown error"}` }
  }
}
