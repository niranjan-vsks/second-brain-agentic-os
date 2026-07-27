// Known model IDs per provider, for the Settings routing UI dropdowns. Not
// exhaustive or auto-synced — just the common/current picks so the operator
// isn't stuck typing exact model strings from memory. "Custom…" always falls
// back to a free-text box for anything not listed (new releases, less common
// OpenRouter model ids, etc).

export type CatalogProvider = "gateway" | "openrouter" | "moonshot" | "google" | "custom"

export const MODEL_CATALOG: Record<CatalogProvider, string[]> = {
  gateway: [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "anthropic/claude-haiku-4-5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.5",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1",
    "openai/gpt-5",
  ],
  google: [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ],
  moonshot: [
    "kimi-k2-0711-preview",
    "kimi-k2-turbo-preview",
    "moonshot-v1-8k",
    "moonshot-v1-32k",
    "moonshot-v1-128k",
  ],
  openrouter: [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-haiku-4-5",
    "openai/gpt-4.1-mini",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "z-ai/glm-4.6",
    "qwen/qwen3-235b-a22b",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  custom: [],
}

export const CUSTOM_MODEL_VALUE = "__custom__"
