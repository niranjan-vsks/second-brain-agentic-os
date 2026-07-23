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

// =============================================================================
// USER-CONFIGURABLE BRAIN (Settings → Model Brain) + VAULT-AWARE KEYS
//
// The env-based getModel() above stays as the zero-config fallback. This path
// lets the operator pick a provider + models in the UI and BRING THEIR OWN KEY
// via the encrypted vault (openrouter / moonshot). Every agent calls
// getModelForUser(userId, tier); it resolves: user's llm_brain config → vault
// key (or env) → an OpenAI-compatible provider (or a plain gateway string).
// =============================================================================

const MOONSHOT_BASE = "https://api.moonshot.ai/v1"
const MOONSHOT_DEFAULTS: Record<ModelTier, string> = {
  light: "kimi-k2-0711-preview",
  standard: "kimi-k2-0711-preview",
  heavy: "kimi-k2-0711-preview",
}
const OPENROUTER_DEFAULTS: Record<ModelTier, string> = {
  light: "google/gemini-2.5-flash-lite",
  standard: "google/gemini-2.5-flash",
  heavy: "anthropic/claude-sonnet-4.5",
}

type BrainModel = Parameters<typeof import("ai").generateText>[0]["model"]

/**
 * Resolve the model for a user + tier, honoring their Settings → Model Brain
 * choice and vault key. Falls back to the env-based getModel() when the user
 * hasn't configured a brain (provider "gateway" with no overrides).
 */
export async function getModelForUser(userId: string, tier: ModelTier = "heavy"): Promise<BrainModel> {
  const { getConfig, getSecret, LLM_BRAIN_DEFAULTS } = await import("@/lib/config")
  const brain = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)
  const override = brain.models?.[tier]?.trim()

  if (brain.provider === "moonshot") {
    const apiKey = (await getSecret(userId, "moonshot", "llm.brain")) || process.env.MOONSHOT_API_KEY
    if (!apiKey) throw new Error("Kimi (Moonshot) selected but no key — add a Moonshot key in Settings → API Keys.")
    const compat = createOpenAICompatible({ name: "moonshot", apiKey, baseURL: MOONSHOT_BASE })
    return compat(override || MOONSHOT_DEFAULTS[tier])
  }

  if (brain.provider === "openrouter") {
    const apiKey = (await getSecret(userId, "openrouter", "llm.brain")) || process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter selected but no key — add an OpenRouter key in Settings → API Keys.")
    const compat = createOpenAICompatible({ name: "openrouter", apiKey, baseURL: "https://openrouter.ai/api/v1" })
    return compat(override || OPENROUTER_DEFAULTS[tier])
  }

  if (brain.provider === "custom") {
    const apiKey = (await getSecret(userId, "openrouter", "llm.brain")) || process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY
    const baseURL = brain.baseUrl || process.env.LLM_BASE_URL
    if (!apiKey || !baseURL) throw new Error("Custom brain needs a base URL (Settings → Model Brain) + a key (API Keys).")
    const compat = createOpenAICompatible({ name: "custom", apiKey, baseURL })
    return compat(override || process.env.LLM_MODEL || "gpt-4o-mini")
  }

  // gateway (default): honor a per-tier override, else fall back to env getModel()
  if (override) return override
  return getModel(tier)
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

/** Per-user brain description for the Settings UI: provider, effective models, key/env readiness. */
export async function describeLlmForUser(
  userId: string,
): Promise<{ provider: string; models: Record<ModelTier, string>; configured: boolean; keySource: string }> {
  const { getConfig, getSecret, LLM_BRAIN_DEFAULTS } = await import("@/lib/config")
  const brain = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)
  const eff = (tier: ModelTier, def: string) => brain.models?.[tier]?.trim() || def

  if (brain.provider === "moonshot") {
    const key = (await getSecret(userId, "moonshot", "").catch(() => null)) || process.env.MOONSHOT_API_KEY
    return {
      provider: "Kimi (Moonshot)",
      models: { light: eff("light", MOONSHOT_DEFAULTS.light), standard: eff("standard", MOONSHOT_DEFAULTS.standard), heavy: eff("heavy", MOONSHOT_DEFAULTS.heavy) },
      configured: Boolean(key),
      keySource: key ? "ready" : "missing Moonshot key",
    }
  }
  if (brain.provider === "openrouter") {
    const key = (await getSecret(userId, "openrouter", "").catch(() => null)) || process.env.OPENROUTER_API_KEY
    return {
      provider: "OpenRouter",
      models: { light: eff("light", OPENROUTER_DEFAULTS.light), standard: eff("standard", OPENROUTER_DEFAULTS.standard), heavy: eff("heavy", OPENROUTER_DEFAULTS.heavy) },
      configured: Boolean(key),
      keySource: key ? "ready" : "missing OpenRouter key",
    }
  }
  if (brain.provider === "custom") {
    const key = (await getSecret(userId, "openrouter", "").catch(() => null)) || process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY
    const base = brain.baseUrl || process.env.LLM_BASE_URL || ""
    return {
      provider: `Custom (${base || "no base URL"})`,
      models: { light: eff("light", "—"), standard: eff("standard", "—"), heavy: eff("heavy", "—") },
      configured: Boolean(key && base),
      keySource: key && base ? "ready" : "missing base URL or key",
    }
  }
  // gateway
  const env = describeLlm()
  return {
    provider: "Vercel AI Gateway",
    models: { light: eff("light", env.models.light), standard: eff("standard", env.models.standard), heavy: eff("heavy", env.models.heavy) },
    configured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL),
    keySource: process.env.AI_GATEWAY_API_KEY ? "ready" : "needs AI_GATEWAY_API_KEY (or pick Kimi/OpenRouter)",
  }
}
