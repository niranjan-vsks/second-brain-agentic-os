"use client"
// Browser-side speech playback for agent voices. Distinct voice per agent:
// deterministic voice slot (filtered by gender hint) + per-agent pitch/rate.
// Zero infra — works today. When OmniVoice is wired server-side, the caller can
// prefer synthesizeSpeech() and only fall back to this.

import { voiceFor, voiceSlot, type VoiceProfile } from "@/lib/agent-voices"

function hasTTS(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!hasTTS()) return resolve([])
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) return resolve(existing)
    const handler = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true })
    // Fallback if the event never fires
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 600)
  })
}

function pickVoice(all: SpeechSynthesisVoice[], profile: VoiceProfile, agentKey: string): SpeechSynthesisVoice | null {
  if (all.length === 0) return null
  const en = all.filter((v) => v.lang.toLowerCase().startsWith("en"))
  const pool = en.length > 0 ? en : all
  // Gender-hint filter using common voice-name heuristics (best-effort per OS).
  const femaleHints = ["female", "zira", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "google uk english female", "google us english"]
  const maleHints = ["male", "david", "mark", "daniel", "alex", "fred", "google uk english male", "rishi"]
  const wants = profile.gender === "female" ? femaleHints : maleHints
  const gendered = pool.filter((v) => wants.some((h) => v.name.toLowerCase().includes(h)))
  const chosenPool = gendered.length > 0 ? gendered : pool
  return chosenPool[voiceSlot(agentKey, chosenPool.length)] ?? chosenPool[0]
}

export interface SpeakHandle {
  cancel: () => void
}

/**
 * Speak `text` as the given agent. Returns a handle to cancel, and resolves the
 * promise when speech ends. onStart/onEnd let the UI drive the speaking glow.
 */
export async function speakAsAgent(
  agentKey: string,
  tier: string,
  text: string,
  cb?: { onStart?: () => void; onEnd?: () => void },
): Promise<SpeakHandle> {
  if (!hasTTS() || !text.trim()) {
    cb?.onEnd?.()
    return { cancel: () => {} }
  }
  const profile = voiceFor(agentKey, tier)
  const all = await voicesReady()
  const voice = pickVoice(all, profile, agentKey)

  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text.slice(0, 600))
  if (voice) utter.voice = voice
  utter.pitch = profile.pitch
  utter.rate = profile.rate
  utter.onstart = () => cb?.onStart?.()
  utter.onend = () => cb?.onEnd?.()
  utter.onerror = () => cb?.onEnd?.()
  window.speechSynthesis.speak(utter)
  return {
    cancel: () => {
      window.speechSynthesis.cancel()
      cb?.onEnd?.()
    },
  }
}

export function cancelSpeech() {
  if (hasTTS()) window.speechSynthesis.cancel()
}

/** Play OmniVoice-synthesized base64 audio (used when the server seam returns audio). */
export function playBase64Audio(base64: string, mime: string, cb?: { onStart?: () => void; onEnd?: () => void }): SpeakHandle {
  if (typeof window === "undefined") return { cancel: () => {} }
  const audio = new Audio(`data:${mime};base64,${base64}`)
  audio.onplay = () => cb?.onStart?.()
  audio.onended = () => cb?.onEnd?.()
  audio.onerror = () => cb?.onEnd?.()
  void audio.play()
  return { cancel: () => { audio.pause(); cb?.onEnd?.() } }
}
