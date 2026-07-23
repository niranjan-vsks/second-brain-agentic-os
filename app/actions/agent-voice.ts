"use server"

// "Talk to your agents" — Jarvis speaks on each agent's behalf (it has the live
// data), but the line is written in that agent's FIRST-PERSON voice + persona,
// grounded in the agent's real role and current status. Cheap: light tier,
// 1-2 sentence outputs.
//
// The audio itself is synthesized client-side (browser SpeechSynthesis, distinct
// voice per agent). If a premium OmniVoice server is configured (OMNIVOICE_TTS_URL),
// synthesizeSpeech() routes through it for cloned/designed voices instead.

import { headers } from "next/headers"
import { generateText } from "ai"
import { auth } from "@/lib/auth"
import { getModelForUser } from "@/lib/llm"
import { AGENT_BY_KEY } from "@/lib/agent-registry"
import { getOverlay } from "@/lib/agent-graph"
import { getStatusSources, agentStatus, blockedReasons } from "@/lib/agent-status"
import { voiceFor } from "@/lib/agent-voices"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

/**
 * Returns a short spoken line for one agent. mode "introduce" = crisp
 * self-introduction; mode "ask" = answer a question grounded in role + status.
 */
export async function speakLineForAgent(
  agentKey: string,
  mode: "introduce" | "ask",
  question?: string,
): Promise<{ ok: true; line: string; displayName: string } | { ok: false; error: string }> {
  const userId = await getUserId()

  // Effective def (base ⊕ overlay rename); fall back to base.
  const base = AGENT_BY_KEY[agentKey]
  const overlay = await getOverlay(userId)
  const custom = overlay.added?.find((a) => a.key === agentKey)
  const def = base ?? custom
  if (!def) return { ok: false as const, error: "Unknown agent" }
  const displayName = overlay.renames?.[agentKey] ?? def.displayName

  const sources = await getStatusSources(userId)
  const st = base ? agentStatus(base, sources, blockedReasons()) : { status: "idle", detail: "standing by" }
  const persona = voiceFor(agentKey, def.tier).persona
  const paused = overlay.paused?.includes(agentKey)

  const system = `You are "${displayName}", a specialist agent inside the operator's AI operating system. Your job: ${def.role}. Your model tier: ${def.tier}. Voice/persona: ${persona}.
Speak in FIRST PERSON as ${displayName}. 1-2 short sentences, spoken aloud — natural, in-character, no markdown, no emojis, no stage directions.
Your live status right now: ${paused ? "PAUSED by the operator" : st.status} — ${st.detail}.
NEVER invent metrics or data you don't have; if asked for data you don't hold, say the operator can pull it via Jarvis.`

  const prompt =
    mode === "introduce"
      ? `Introduce yourself to the operator in one or two crisp sentences: who you are and what you do for them.`
      : `The operator asks: "${(question ?? "").slice(0, 400)}". Answer briefly, in character, grounded only in your role and status.`

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "light"), // agent_voice.speak — short in-character line, cheapest tier
      system,
      prompt,
    })
    return { ok: true as const, line: text.trim().replace(/^["']|["']$/g, "").slice(0, 400), displayName }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "voice line failed" }
  }
}

/**
 * OmniVoice premium-TTS seam (env-activated stub). When OMNIVOICE_TTS_URL is
 * set (a self-hosted OmniVoice inference server exposing POST /generate), this
 * returns synthesized audio for the given text + voice attributes. Until then,
 * the client uses the browser's SpeechSynthesis with per-agent voice profiles.
 */
export async function synthesizeSpeech(
  text: string,
  attributes: { gender: string; pitch: number; rate: number; persona: string },
): Promise<{ ok: true; audioBase64: string; mime: string } | { ok: false; reason: string }> {
  const url = process.env.OMNIVOICE_TTS_URL
  if (!url) return { ok: false as const, reason: "browser_tts" } // client falls back to SpeechSynthesis
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OMNIVOICE_TTS_KEY ? { Authorization: `Bearer ${process.env.OMNIVOICE_TTS_KEY}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 600), voice_attributes: attributes, format: "mp3" }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return { ok: false as const, reason: `omnivoice ${res.status}` }
    const data = (await res.json()) as { audio_base64?: string; mime?: string }
    if (!data.audio_base64) return { ok: false as const, reason: "omnivoice: no audio" }
    return { ok: true as const, audioBase64: data.audio_base64, mime: data.mime ?? "audio/mpeg" }
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : "omnivoice failed" }
  }
}
