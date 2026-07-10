/**
 * Model Routing Framework — deterministic task→tier registry + escalation.
 *
 * Design decision (over learned/LLM-classifier routers): operator_os has a
 * CLOSED set of known agent tasks, so routing is a lookup table, not an
 * inference problem. This captures ~all of the cost savings of a smart router
 * with zero added latency, zero new dependencies, and one new failure mode
 * fewer. The single dynamic behavior worth having is ESCALATION: if a
 * light/standard output fails its caller's validation, retry once on the
 * next tier up.
 *
 * Context never lives in a model — it all lives in Neon — so tier hops are
 * lossless (the "sovereign memory layer" property).
 *
 * To re-tier a task: edit the registry. To re-model a tier: set the env vars
 * documented in lib/llm.ts. No business-logic changes needed for either.
 */
import { generateText } from "ai"
import { getModel, resolveModelId, type ModelTier } from "@/lib/llm"

/** Every LLM-calling task in the OS, mapped to the minimum tier that does it well. */
export const TASK_TIERS = {
  // ---- light: extraction / scoring / formatting / acks -------------------
  "career.extract_keywords": "light",
  "career.legitimacy_scan": "light",
  "os_chat.summarize_rows": "light", // turning SQL rows into plain English
  "telegram.ack": "light",
  "linkedin.trend_summarize": "light",
  "youtube.title_variants": "light",

  // ---- standard: drafting prose / SQL generation --------------------------
  "os_chat.text_to_sql": "standard",
  "os_chat.jarvis": "standard", // tool-loop conductor (calendar, autopay, SQL)
  "career.outreach": "standard",
  "career.apply_assist": "standard",
  "linkedin.compose_post": "standard",
  "linkedin.tweak_post": "standard",
  "ads.creative": "standard",
  "youtube.premise": "standard",

  // ---- heavy: multi-constraint reasoning ----------------------------------
  "career.evaluate": "heavy", // 6-block report + rubric + legitimacy tiers
  "career.tailor_resume": "heavy", // never-fabricate constitution
  "career.deep_research": "heavy",
  "career.auto_pipeline": "heavy",
  "youtube.script_compose": "heavy",
  "youtube.prompt_builder": "heavy",
  "edits.edit_spec": "heavy", // Remotion edit spec generation
} as const satisfies Record<string, ModelTier>

export type RoutedTask = keyof typeof TASK_TIERS

const ESCALATION: Record<ModelTier, ModelTier | null> = {
  light: "standard",
  standard: "heavy",
  heavy: null,
}

/** Resolve the model for a registered task. Unknown callers should use getModel(tier) directly. */
export function getModelForTask(task: RoutedTask) {
  return getModel(TASK_TIERS[task])
}

export function describeRoute(task: RoutedTask): { tier: ModelTier; modelId: string } {
  const tier = TASK_TIERS[task]
  return { tier, modelId: resolveModelId(tier) }
}

/**
 * generateText with tier routing + one-step escalation.
 *
 * Runs the task on its registered tier. If `validate` returns a string
 * (the rejection reason) or throws, retries ONCE on the next tier up.
 * Heavy-tier failures surface immediately — there is nowhere to go.
 */
export async function generateRouted(
  task: RoutedTask,
  args: { system?: string; prompt: string; maxOutputTokens?: number },
  validate?: (text: string) => string | null,
): Promise<{ text: string; tier: ModelTier; escalated: boolean }> {
  const tier = TASK_TIERS[task]

  const attempt = async (t: ModelTier) => {
    const { text } = await generateText({
      model: getModel(t),
      system: args.system,
      prompt: args.prompt,
      ...(args.maxOutputTokens ? { maxOutputTokens: args.maxOutputTokens } : {}),
    })
    return text
  }

  let text: string
  try {
    text = await attempt(tier)
    const rejection = validate?.(text) ?? null
    if (rejection === null) return { text, tier, escalated: false }
    console.log(`[v0] model-router: ${task} on ${tier} rejected (${rejection}) — escalating`)
  } catch (e) {
    const next = ESCALATION[tier]
    if (!next) throw e
    console.log(`[v0] model-router: ${task} on ${tier} threw (${e instanceof Error ? e.message : "?"}) — escalating`)
  }

  const next = ESCALATION[tier]
  if (!next) {
    // Validation failed on heavy — return the output anyway; caller's validation
    // already communicated the problem and can handle it.
    return { text: text!, tier, escalated: false }
  }

  text = await attempt(next)
  return { text, tier: next, escalated: true }
}
