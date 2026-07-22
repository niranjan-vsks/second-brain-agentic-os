// Per-agent voice profiles — gives every agent a DISTINCT voice for the
// Playground "talk to your agents" feature. Pure data (client-importable, no
// server-only): the browser SpeechSynthesis path reads these directly.
//
// Distinctness with zero infra: each agent maps to a deterministic browser
// voice slot (by gender hint) PLUS its own pitch/rate offsets, so even agents
// sharing a base system voice sound recognizably different. When a premium
// OmniVoice server is wired (OMNIVOICE_TTS_URL), the same persona attributes
// (gender/age/pitch/style) drive its Voice-Design mode instead — see
// app/actions/agent-voice.ts.

export type VoiceGender = "male" | "female"

export interface VoiceProfile {
  gender: VoiceGender
  /** SpeechSynthesis pitch 0–2 (default 1). */
  pitch: number
  /** SpeechSynthesis rate 0.1–10 (we stay ~0.85–1.15). */
  rate: number
  /** Persona tone fed to the line-writer + (future) OmniVoice Voice-Design. */
  persona: string
}

// Sensible defaults by tier when an agent has no explicit profile.
const TIER_DEFAULT: Record<string, VoiceProfile> = {
  heavy: { gender: "male", pitch: 0.9, rate: 0.98, persona: "measured, authoritative, senior" },
  standard: { gender: "female", pitch: 1.05, rate: 1.04, persona: "crisp, efficient, focused" },
  light: { gender: "female", pitch: 1.15, rate: 1.1, persona: "quick, chipper, terse" },
  deterministic: { gender: "male", pitch: 0.8, rate: 1.0, persona: "flat, precise, machine-like" },
}

// Signature voices for the named agents (stable identities).
export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  "os_chat.jarvis": { gender: "male", pitch: 0.82, rate: 0.97, persona: "calm, British, unflappable butler-AI — think J.A.R.V.I.S." },
  "os_chat.text_to_sql": { gender: "female", pitch: 1.0, rate: 1.05, persona: "precise, analytical, dry wit" },
  "os_chat.summarize_rows": { gender: "female", pitch: 1.18, rate: 1.12, persona: "brisk, plain-spoken" },
  "browse_page": { gender: "male", pitch: 0.78, rate: 1.0, persona: "explorer, terse field-reporter" },
  "telegram.ack": { gender: "female", pitch: 1.2, rate: 1.14, persona: "chirpy courier" },

  "linkedin.trend_summarize": { gender: "female", pitch: 1.1, rate: 1.08, persona: "trend-savvy scout" },
  "linkedin.compose_post": { gender: "female", pitch: 1.02, rate: 1.0, persona: "confident ghost-writer, punchy" },
  "linkedin.tweak_post": { gender: "male", pitch: 1.0, rate: 1.05, persona: "editor, exacting, wry" },

  "youtube.premise": { gender: "female", pitch: 1.12, rate: 1.06, persona: "hooky, creative spark" },
  "youtube.script_compose": { gender: "male", pitch: 0.92, rate: 0.98, persona: "storyteller, cinematic cadence" },
  "youtube.prompt_builder": { gender: "male", pitch: 0.85, rate: 1.0, persona: "engineer, deliberate" },
  "youtube.title_variants": { gender: "female", pitch: 1.16, rate: 1.12, persona: "snappy copy namer" },
  "edits.edit_spec": { gender: "male", pitch: 0.95, rate: 1.02, persona: "clinical film cutter" },

  "leadgen.qualify": { gender: "male", pitch: 0.9, rate: 1.04, persona: "sharp closer, sizes people up fast" },

  "career.auto_pipeline": { gender: "male", pitch: 0.86, rate: 0.96, persona: "conductor, commanding, orchestral" },
  "career.scanner": { gender: "male", pitch: 0.8, rate: 1.08, persona: "recon scout, clipped signals" },
  "career.extract_keywords": { gender: "female", pitch: 1.16, rate: 1.12, persona: "quick parser" },
  "career.legitimacy_scan": { gender: "male", pitch: 0.9, rate: 1.02, persona: "wary sentinel, suspicious" },
  "career.evaluate": { gender: "female", pitch: 0.98, rate: 0.98, persona: "rigorous assessor, fair but tough" },
  "career.tailor_resume": { gender: "female", pitch: 1.04, rate: 1.0, persona: "meticulous tailor, protective of the voice" },
  "career.outreach": { gender: "male", pitch: 1.0, rate: 1.04, persona: "warm herald, persuasive" },
  "career.apply_assist": { gender: "female", pitch: 1.08, rate: 1.06, persona: "helpful aide" },
  "career.deep_research": { gender: "male", pitch: 0.88, rate: 0.98, persona: "deep-digging investigator" },

  "ads.creative": { gender: "female", pitch: 1.1, rate: 1.05, persona: "punchy adsmith, high energy" },

  "arsenal.skill_extract": { gender: "female", pitch: 1.06, rate: 1.08, persona: "curator, tidy" },
  "arsenal.analyze_automation": { gender: "male", pitch: 0.9, rate: 1.0, persona: "systems analyst" },

  // Job-hunt engine nodes (planned subsystem — see Architecture Script)
  "jobhunt.sourcer": { gender: "male", pitch: 0.84, rate: 1.06, persona: "relentless hunter, always scanning" },
  "jobhunt.applicant": { gender: "female", pitch: 1.0, rate: 1.0, persona: "surgical applicant, precise" },
  "jobhunt.enricher": { gender: "male", pitch: 0.88, rate: 1.02, persona: "intel enricher, resourceful" },
  "jobhunt.emissary": { gender: "male", pitch: 0.98, rate: 1.03, persona: "smooth emissary, diplomatic" },
}

export function voiceFor(agentKey: string, tier: string): VoiceProfile {
  return VOICE_PROFILES[agentKey] ?? TIER_DEFAULT[tier] ?? TIER_DEFAULT.standard
}

/** Deterministic index so an agent always lands on the same browser voice. */
export function voiceSlot(agentKey: string, poolSize: number): number {
  if (poolSize <= 0) return 0
  let h = 0
  for (let i = 0; i < agentKey.length; i++) h = (h * 31 + agentKey.charCodeAt(i)) >>> 0
  return h % poolSize
}
