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
// Direct-Moonshot model ids differ from OpenRouter's namespaced ids and vary by
// account permissions ("kimi-latest" 404'd on the owner's key). We route Kimi
// through OpenRouter in the fallback chain instead; this default only applies if
// the operator explicitly picks the Moonshot provider in Settings (where the
// model-discovery dropdown shows their actual available ids). kimi-k2-0711-preview
// is the broadest-compatibility historical id.
const MOONSHOT_DEFAULTS: Record<ModelTier, string> = {
  light: "kimi-k2-0711-preview",
  standard: "kimi-k2-0711-preview",
  heavy: "kimi-k2-0711-preview",
}
const OPENROUTER_DEFAULTS: Record<ModelTier, string> = {
  light: "google/gemini-3.5-flash-lite",
  standard: "google/gemini-3.5-flash",
  heavy: "moonshotai/kimi-k3", // Kimi K3 = the smart brain
}

const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
const GOOGLE_DEFAULTS: Record<ModelTier, string> = {
  // gemini-2.5-* is being retired for new API keys ("no longer available to
  // new users" 404) — Gemini 3.5 is the current stable (non-preview) gen.
  light: "gemini-3.5-flash-lite",
  standard: "gemini-3.5-flash",
  // 3-pro-tier free quota is 0 on new keys — default heavy to flash so a free
  // Google AI Studio key works. Billed keys can override to a pro model.
  heavy: "gemini-3.5-flash",
}

type BrainModel = Parameters<typeof import("ai").generateText>[0]["model"]
type Provider = "gateway" | "openrouter" | "moonshot" | "google" | "custom"

/** Gateway usable only when a gateway key (or Vercel runtime) is present. */
function gatewayUsable(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL)
}

/**
 * First direct-provider vault key the operator has stored, in preference order.
 * Lets agents work off a BYO key when the AI Gateway isn't configured (e.g.
 * local dev, or before wiring gateway billing). Returns null if none stored.
 */
async function firstVaultProvider(userId: string): Promise<Provider | null> {
  const { getSecret } = await import("@/lib/config")
  // provider -> [vault key id, extra env vars to also accept]
  const order: [Provider, string, string[]][] = [
    ["google", "google_ai", ["GEMINI_API_KEY"]],
    ["openrouter", "openrouter", []],
    ["moonshot", "moonshot", []],
  ]
  for (const [prov, keyId, extraEnv] of order) {
    const k = await getSecret(userId, keyId, "llm.autofallback").catch(() => null)
    if (k || extraEnv.some((e) => process.env[e])) return prov
  }
  return null
}

/** Resolve ONE provider+model into a usable model object (or a gateway string). */
async function buildModel(
  userId: string,
  provider: Provider,
  model: string,
  tier: ModelTier,
  baseUrl?: string,
): Promise<BrainModel> {
  const { getSecret } = await import("@/lib/config")

  if (provider === "moonshot") {
    const apiKey = (await getSecret(userId, "moonshot", "llm.brain")) || process.env.MOONSHOT_API_KEY
    if (!apiKey) throw new Error("Kimi (Moonshot) selected but no key — add a Moonshot key in Settings → API Keys.")
    return createOpenAICompatible({ name: "moonshot", apiKey, baseURL: MOONSHOT_BASE })(model || MOONSHOT_DEFAULTS[tier])
  }
  if (provider === "google") {
    const apiKey = (await getSecret(userId, "google_ai", "llm.brain")) || (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
    if (!apiKey) throw new Error("Gemini (Google AI Studio) selected but no key — add a Google AI Studio key in Settings → API Keys.")
    return createOpenAICompatible({ name: "google", apiKey, baseURL: GOOGLE_BASE })(model || GOOGLE_DEFAULTS[tier])
  }
  if (provider === "openrouter") {
    const apiKey = (await getSecret(userId, "openrouter", "llm.brain")) || process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter selected but no key — add an OpenRouter key in Settings → API Keys.")
    return createOpenAICompatible({ name: "openrouter", apiKey, baseURL: "https://openrouter.ai/api/v1" })(model || OPENROUTER_DEFAULTS[tier])
  }
  if (provider === "custom") {
    const apiKey = (await getSecret(userId, "openrouter", "llm.brain")) || process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY
    const url = baseUrl || process.env.LLM_BASE_URL
    if (!apiKey || !url) throw new Error("Custom brain needs a base URL (Settings → Model Brain) + a key (API Keys).")
    return createOpenAICompatible({ name: "custom", apiKey, baseURL: url })(model || process.env.LLM_MODEL || "gpt-4o-mini")
  }
  // gateway
  // If the AI Gateway isn't usable here (no key / not on Vercel) but the operator
  // stored a direct-provider key, route through that so agents still work.
  if (!gatewayUsable()) {
    const fb = await firstVaultProvider(userId)
    if (fb) return buildModel(userId, fb, "", tier)
  }
  if (model) return model
  return getModel(tier)
}

/** A resolved brain choice (provider + model strings) BEFORE it's built into a model object. */
interface BrainChoice {
  provider: Provider
  model: string
  baseUrl?: string
}

/**
 * Resolve the user's configured brain CHOICE (provider + model strings) for a
 * tier/task, honoring Settings → Model Brain: per-task override → per-group
 * strategy → global default strategy → legacy global brain provider/model.
 * Returns just the choice; buildModel turns it into a usable model object.
 */
async function resolveBrainChoice(userId: string, tier: ModelTier, task?: string): Promise<BrainChoice> {
  const { getConfig, LLM_BRAIN_DEFAULTS } = await import("@/lib/config")
  const brain = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)

  // 1. per-task override (advanced)
  const override = task ? brain.taskModels?.[task] : undefined
  if (override?.provider) {
    return { provider: override.provider as Provider, model: override.model?.trim() ?? "", baseUrl: brain.baseUrl }
  }

  // 2/3. strategy — group override else global default
  const strategies = brain.strategies ?? []
  if (strategies.length > 0 && (brain.defaultStrategy || Object.keys(brain.groupStrategies ?? {}).length > 0)) {
    let group: string | undefined
    if (task) {
      try {
        const { AGENT_BY_KEY } = await import("@/lib/agent-registry")
        group = AGENT_BY_KEY[task]?.group
      } catch {
        group = undefined
      }
    }
    const stratId = (group && brain.groupStrategies?.[group]) || brain.defaultStrategy
    const strat = strategies.find((s) => s.id === stratId)
    const choice = strat?.tiers?.[tier]
    if (choice?.provider) {
      return { provider: choice.provider as Provider, model: choice.model?.trim() ?? "", baseUrl: brain.baseUrl }
    }
  }

  // 4/5. legacy global brain
  return { provider: brain.provider as Provider, model: brain.models?.[tier]?.trim() ?? "", baseUrl: brain.baseUrl }
}

/**
 * Resolve the model for a user + tier, honoring Settings → Model Brain (global
 * provider) AND an optional per-TASK override. Vault-key aware. Falls back to
 * env getModel() when unconfigured.
 */
export async function getModelForUser(userId: string, tier: ModelTier = "heavy", task?: string): Promise<BrainModel> {
  const c = await resolveBrainChoice(userId, tier, task)
  return buildModel(userId, c.provider, c.model, tier, c.baseUrl)
}

// --- Resilient multi-provider fallback -----------------------------------------
// A transient provider error (503 Service Unavailable, 5xx, overloaded, timeout)
// must never break an agent when a different provider's key is sitting in the
// vault. getModelChainForUser returns the user's chosen brain FIRST, then
// provider-diverse fallbacks; generateTextResilient tries each in order.

/**
 * Cross-provider fallback candidates per tier, ordered. All Kimi routed via
 * OpenRouter (verified ids) — NOT direct Moonshot, whose model ids vary by
 * account permission and 404 unpredictably. Multiple OpenRouter models are
 * fine: they route to different upstreams, and the chain dedups by
 * provider+model (not provider), so distinct models coexist. If OpenRouter is
 * account-dead (out of credits / bad key) the loop skips its siblings.
 */
const FALLBACK_CANDIDATES: Record<ModelTier, BrainChoice[]> = {
  heavy: [
    { provider: "openrouter", model: "moonshotai/kimi-k3" }, // smart brain
    { provider: "google", model: "gemini-3.5-flash" }, // different provider entirely
    { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" }, // premium, reliable
    { provider: "openrouter", model: "deepseek/deepseek-v4-pro" }, // cheap, reliable
  ],
  standard: [
    { provider: "google", model: "gemini-3.5-flash" },
    { provider: "openrouter", model: "moonshotai/kimi-k3" },
    { provider: "openrouter", model: "deepseek/deepseek-v4-flash" },
  ],
  light: [
    { provider: "google", model: "gemini-3.5-flash-lite" },
    { provider: "openrouter", model: "google/gemini-3.5-flash-lite" },
  ],
}

/** Does this provider have a usable key (vault or env)? */
async function providerHasKey(userId: string, provider: Provider): Promise<boolean> {
  const { getSecret } = await import("@/lib/config")
  if (provider === "gateway") return gatewayUsable()
  const map: Partial<Record<Provider, { keyId: string; env: string[] }>> = {
    google: { keyId: "google_ai", env: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"] },
    openrouter: { keyId: "openrouter", env: ["OPENROUTER_API_KEY"] },
    moonshot: { keyId: "moonshot", env: ["MOONSHOT_API_KEY"] },
    custom: { keyId: "openrouter", env: ["LLM_API_KEY", "OPENROUTER_API_KEY"] },
  }
  const m = map[provider]
  if (!m) return false
  const k = await getSecret(userId, m.keyId, "llm.chain").catch(() => null)
  return Boolean(k || m.env.some((e) => process.env[e]))
}

/** One entry in the resilient model chain — the built model plus its provider tag. */
interface ChainEntry {
  model: BrainModel
  provider: Provider
  label: string
}

/**
 * Ordered list of models to try: the user's configured brain choice first,
 * then fallbacks whose keys exist. Deduped by provider+model (distinct models
 * on the same provider are kept — OpenRouter routes them to different
 * upstreams). Always ends with a buildable last resort so the chain is never
 * empty.
 */
export async function getModelChainForUser(userId: string, tier: ModelTier = "heavy", task?: string): Promise<ChainEntry[]> {
  const primary = await resolveBrainChoice(userId, tier, task)
  const chain: ChainEntry[] = []
  const usedKeys = new Set<string>()

  const add = async (c: BrainChoice) => {
    const key = `${c.provider}:${c.model || "default"}`
    if (usedKeys.has(key)) return
    if (!(await providerHasKey(userId, c.provider))) return
    try {
      chain.push({ model: await buildModel(userId, c.provider, c.model, tier, c.baseUrl), provider: c.provider, label: key })
      usedKeys.add(key)
    } catch {
      // key/config missing for this provider — skip it silently
    }
  }

  await add(primary)
  for (const cand of FALLBACK_CANDIDATES[tier]) await add(cand)
  // Last resort: env/gateway default (always buildable, may itself route to a vault key)
  if (chain.length === 0) chain.push({ model: await buildModel(userId, "gateway", "", tier), provider: "gateway", label: "gateway:default" })
  return chain
}

/**
 * Errors where retrying on a DIFFERENT provider is likely to succeed:
 * transient outages (5xx / overloaded / timeout / rate-limit) AND
 * account-level exhaustion on one provider (out of credits / quota / payment
 * required) — because a different provider's key may still be funded. Auth /
 * bad-request errors are NOT included: those fail identically everywhere.
 */
export function isTransientLLMError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return (
    /\b(500|502|503|504|429|402)\b/.test(msg) ||
    msg.includes("service unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("temporarily") ||
    // account exhaustion on one provider — a funded fallback provider still works
    msg.includes("requires more credits") ||
    msg.includes("can only afford") ||
    msg.includes("insufficient") ||
    msg.includes("quota") ||
    msg.includes("payment required") ||
    msg.includes("credit card")
  )
}

/**
 * Account-level failure: the provider's KEY is unusable (bad/expired key, no
 * permission, out of credits, over quota). Every model on that provider will
 * fail identically, so we skip its remaining chain entries — but still try
 * OTHER providers, whose keys may be fine.
 */
function isAccountDeadError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return (
    /\b(401|403|402)\b/.test(msg) ||
    msg.includes("unauthorized") ||
    msg.includes("permission denied") ||
    msg.includes("invalid api key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("no auth credentials") ||
    msg.includes("requires more credits") ||
    msg.includes("can only afford") ||
    msg.includes("insufficient") ||
    msg.includes("payment required") ||
    msg.includes("credit card") ||
    msg.includes("quota")
  )
}

type GenerateTextParams = Parameters<typeof import("ai").generateText>[0]

/**
 * generateText with automatic cross-provider fallback. Tries the user's brain
 * choice, then provider-diverse fallbacks, and NEVER dies on a single bad entry
 * — it walks the entire chain, only throwing once every option is exhausted.
 * When a provider's KEY is dead (auth/credits/quota) its remaining entries are
 * skipped (they'd fail identically), but other providers are still tried.
 * Each attempt gets maxRetries with backoff to ride out intermittent 503s.
 */
export async function generateTextResilient(
  userId: string,
  tier: ModelTier,
  task: string | undefined,
  params: Omit<GenerateTextParams, "model">,
): Promise<{ text: string; steps?: unknown }> {
  const { generateText } = await import("ai")
  const chain = await getModelChainForUser(userId, tier, task)
  const deadProviders = new Set<Provider>()
  const errors: string[] = []

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]
    if (deadProviders.has(entry.provider)) continue // key already proven dead this call
    try {
      const r = await generateText({ ...(params as GenerateTextParams), model: entry.model, maxRetries: 4 })
      return { text: r.text, steps: r.steps }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const accountDead = isAccountDeadError(e)
      if (accountDead) deadProviders.add(entry.provider)
      errors.push(`${entry.label}: ${msg.slice(0, 120)}`)
      console.error(`[llm] ${task ?? tier} attempt ${i + 1}/${chain.length} (${entry.label}) failed${accountDead ? " [key dead — skipping provider]" : ""}: ${msg.slice(0, 200)}`)
      // never throw mid-chain — keep trying other options
    }
  }
  throw new Error(`All ${chain.length} model option(s) failed — ${errors.join(" | ")}`)
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
  if (brain.provider === "google") {
    const key = (await getSecret(userId, "google_ai", "").catch(() => null)) || (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
    return {
      provider: "Gemini (Google AI Studio)",
      models: { light: eff("light", GOOGLE_DEFAULTS.light), standard: eff("standard", GOOGLE_DEFAULTS.standard), heavy: eff("heavy", GOOGLE_DEFAULTS.heavy) },
      configured: Boolean(key),
      keySource: key ? "ready" : "missing Google AI Studio key",
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
