// Shared data packet for the 4-node Job-Hunt engine. Stored in
// job_applications.jobhunt (jsonb); each node reads + writes its slice.

export interface HiringManager {
  name: string
  email: string
  linkedin: string
  title: string
  source: "apollo" | "hunter" | "manual" | ""
  confidence: "verified" | "pattern" | "unknown"
}

export interface JobHuntPacket {
  /** Node 2 — application */
  trackingId?: string
  appliedAt?: string
  confirmationScreenshotUrl?: string
  applyMethod?: "auto_browser" | "staged" | "manual"
  tailoredResumeVersionId?: string
  /** Node 3 — enrichment */
  domain?: string
  hiringManager?: HiringManager
  companyIntel?: string
  /** Node 4 — outreach */
  emailDraft?: { subject: string; body: string }
  linkedinDraft?: string
  emailStatus?: "draft" | "sent" | "skipped"
  outreachAt?: string
  /** cross-node */
  notes?: string
}

export const EMPTY_PACKET: JobHuntPacket = {}

export function readPacket(v: unknown): JobHuntPacket {
  if (v && typeof v === "object") return v as JobHuntPacket
  return {}
}
