/**
 * Flexible LLM provider config — the single seam for the multi-agent brain,
 * now with TIERED MODEL ROUTING.
 *
 * Three tiers, chosen deterministically per task (see lib/model-router.ts):
 *   light    — extraction, scoring, formatting, acks. Cheap + fast.
 *   standard — drafting prose (outreach, LinkedIn posts), SQL generation.
 *   heavy    — deep reasoning: job evaluation, resume tailoring, scripts, research synthesis.
 *
 * Resolution order per tier (env-driven, no redeploy needed):
 *   1. LLM_PROVIDER=openrouter|custom -> OpenAI-compatible endpoint.
 *      Tier model IDs: LLM_MODEL_LIGHT / LLM_MODEL_STANDARD / LLM_MODEL_HEAVY,
 *      each falling back to LLM_MODEL (all tiers on one model = old behavior).
 *   2. default (unset) -> Vercel AI Gateway. Tier model IDs:
 *      GATEWAY_MODEL_LIGHT / GATEWAY_MODEL_STANDARD / GATEWAY_MODEL_HEAVY,
 *      each falling back to GATEWAY_MODEL, then to the budget defaults below.
 *
 * Budget defaults (Vercel AI Gateway model strings):
 *   light:    google/gemini-2.5-flash-lite   (fractions of a cent per call)
 *   standard: google/gemini-2.5-flash        (good prose, ~10x cheaper than flagships)
 *   heavy:    anthropic/claude-sonnet-4.5    (best instruction-following for
 *             never-fabricate constraints — resume tailoring, evaluation)
 *
 * getModel() with no argument = heavy (backward compatible: all existing
 * callers were on the flagship default).
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export type ModelTier = "light" | "standard" | "heavy"

const GATEWAY_DEFAULTS: Record<ModelTier, string> = {
  light: "google/gemini-2.5-flash-lite",
  standard: "google/gemini-2.5-flash",
  heavy: "anthropic/claude-sonnet-4.5",
}

function tierEnv(prefix: "GATEWAY_MODEL" | "LLM_MODEL", tier: ModelTier): string | undefined {
  return process.env[`${prefix}_${tier.toUpperCase()}`]
}

/**
 * Provider detection, backward compatible with the original seam:
 * explicit LLM_PROVIDER wins; otherwise OPENROUTER_API_KEY implies openrouter
 * and LLM_BASE_URL implies custom (original priority order preserved).
 */
function activeProvider(): "openrouter" | "custom" | "gateway" {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase()
  if (explicit === "openrouter" || explicit === "custom") return explicit
  if (process.env.OPENROUTER_API_KEY) return "openrouter"
  if (process.env.LLM_BASE_URL) return "custom"
  return "gateway"
}

/** Resolve the model id string for a tier (before provider wrapping). */
export function resolveModelId(tier: ModelTier): string {
  const provider = activeProvider()
  if (provider === "openrouter" || provider === "custom") {
    return tierEnv("LLM_MODEL", tier) || process.env.LLM_MODEL || "(unset)"
  }
  return tierEnv("GATEWAY_MODEL", tier) || process.env.GATEWAY_MODEL || GATEWAY_DEFAULTS[tier]
}

export function getModel(tier: ModelTier = "heavy"): Parameters<typeof import("ai").generateText>[0]["model"] {
  const provider = activeProvider()

  if (provider === "openrouter" || provider === "custom") {
    const apiKey = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY
    const baseURL =
      process.env.LLM_BASE_URL ||
      (provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined)
    const modelId = tierEnv("LLM_MODEL", tier) || process.env.LLM_MODEL

    if (!apiKey || !baseURL || !modelId) {
      throw new Error(
        `LLM_PROVIDER=${provider} requires LLM_MODEL (or LLM_MODEL_${tier.toUpperCase()}), LLM_BASE_URL (custom only), and LLM_API_KEY/OPENROUTER_API_KEY. Missing one or more.`,
      )
    }

    const compat = createOpenAICompatible({ name: provider, apiKey, baseURL })
    return compat(modelId)
  }

  // Default: Vercel AI Gateway — plain model string
  return tierEnv("GATEWAY_MODEL", tier) || process.env.GATEWAY_MODEL || GATEWAY_DEFAULTS[tier]
}

/** Human-readable description of the active brain per tier, for settings UI / diagnostics. */
export function describeLlm(): { provider: string; models: Record<ModelTier, string>; configured: boolean } {
  const provider = activeProvider()
  const models: Record<ModelTier, string> = {
    light: resolveModelId("light"),
    standard: resolveModelId("standard"),
    heavy: resolveModelId("heavy"),
  }
  if (provider === "openrouter" || provider === "custom") {
    const configured = Boolean(
      (process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY) &&
        (process.env.LLM_MODEL || process.env.LLM_MODEL_HEAVY),
    )
    return { provider, models, configured }
  }
  return { provider: "vercel-ai-gateway", models, configured: true }
}
