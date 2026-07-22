import "server-only"
// Canonical agent registry — the SINGLE SOURCE OF TRUTH for the Agent Playground.
//
// Derived from the REAL code paths, not an imagined diagram:
//   - agent keys / tiers come from lib/model-router.ts TASK_TIERS
//   - handoff edges come from the actual chains (LinkedIn compose→tweak,
//     YouTube premise→script→prompt, career auto-pipeline evaluate→tailor→
//     outreach, lead-gen discover→qualify→promote, Jarvis god-mode control)
//   - a few deterministic (non-LLM) participants are included because they are
//     real orchestration nodes: Scout (zero-token ATS scanner) and Voyager
//     (agent-browser). Their tier is "deterministic".
//
// The base graph here is STATIC. User edits (renames, rewires, added/deleted
// agents, pauses, orchestrator changes) live as an overlay in app_config
// ("agent_graph"); lib/agent-graph.ts merges base ⊕ overlay into the effective
// graph that the Playground renders and that agents consult at dispatch time.
//
// This file adds ZERO LLM cost — it is pure data.

export type AgentTier = "light" | "standard" | "heavy" | "deterministic"

export type AgentGroup =
  | "core"
  | "linkedin"
  | "youtube"
  | "leadgen"
  | "career"
  | "freelance"
  | "arsenal"
  | "jobhunt"

export interface AgentDef {
  /** Machine identifier — stable, matches TASK_TIERS keys where an LLM task exists. */
  key: string
  /** Human-friendly name shown on the canvas. Stable. */
  displayName: string
  /** One-line functional role. */
  role: string
  tier: AgentTier
  group: AgentGroup
  /** True for orchestrators (crown badge, distinct border). */
  isOrchestrator?: boolean
  /** Load-bearing agents cannot be deleted from the Playground. */
  loadBearing?: boolean
  /** Which status source drives this node's live glow (see lib/agent-status.ts). */
  statusSource:
    | "jarvis"
    | "linkedin"
    | "youtube"
    | "generation"
    | "leadgen"
    | "career"
    | "career_scan"
    | "automation"
    | "jobhunt"
    | "static"
  /** AgentKey in lib/config.ts AGENT_KEYS whose directive/skills apply (if any). */
  overrideKey?: string
}

export interface AgentEdgeDef {
  id: string
  source: string
  target: string
  /** "handoff" = data passes downstream; "control" = orchestrator dispatches. */
  kind: "handoff" | "control"
  label?: string
}

export interface AgentGroupDef {
  id: AgentGroup
  label: string
}

export const AGENT_GROUPS: AgentGroupDef[] = [
  { id: "core", label: "Jarvis Core" },
  { id: "linkedin", label: "LinkedIn OS" },
  { id: "youtube", label: "YouTube Pipeline" },
  { id: "leadgen", label: "Lead-Gen" },
  { id: "career", label: "Career Intelligence" },
  { id: "freelance", label: "Freelance" },
  { id: "arsenal", label: "Arsenal" },
  { id: "jobhunt", label: "Job-Hunt Engine" },
]

export const BASE_AGENTS: AgentDef[] = [
  // ---- Core -----------------------------------------------------------------
  {
    key: "os_chat.jarvis",
    displayName: "Jarvis",
    role: "God-mode orchestrator — 20-tool planning loop over the whole OS",
    tier: "heavy",
    group: "core",
    isOrchestrator: true,
    loadBearing: true,
    statusSource: "jarvis",
  },
  {
    key: "os_chat.text_to_sql",
    displayName: "Oracle",
    role: "Text-to-SQL — read-only, allowlisted, userId-scoped, audited",
    tier: "standard",
    group: "core",
    loadBearing: true,
    statusSource: "jarvis",
  },
  {
    key: "os_chat.summarize_rows",
    displayName: "Digest",
    role: "Turns SQL rows into plain-English answers",
    tier: "light",
    group: "core",
    statusSource: "jarvis",
  },
  {
    key: "browse_page",
    displayName: "Voyager",
    role: "Sandboxed browser (agent-browser) — read-only page fetch",
    tier: "deterministic",
    group: "core",
    statusSource: "jarvis",
  },
  {
    key: "telegram.ack",
    displayName: "Courier",
    role: "Telegram mirror acknowledgements",
    tier: "light",
    group: "core",
    statusSource: "static",
  },

  // ---- LinkedIn OS ----------------------------------------------------------
  {
    key: "linkedin.trend_summarize",
    displayName: "Radar",
    role: "Trend/idea intake summarizer",
    tier: "light",
    group: "linkedin",
    statusSource: "linkedin",
  },
  {
    key: "linkedin.compose_post",
    displayName: "Quill",
    role: "Draft Composer — voice-true LinkedIn posts",
    tier: "standard",
    group: "linkedin",
    loadBearing: true,
    statusSource: "linkedin",
    overrideKey: "linkedin_post",
  },
  {
    key: "linkedin.tweak_post",
    displayName: "Tuner",
    role: "Tweak Agent — chat-based post refinement, git-style revisions",
    tier: "standard",
    group: "linkedin",
    statusSource: "linkedin",
    overrideKey: "linkedin_post",
  },

  // ---- YouTube Pipeline -----------------------------------------------------
  {
    key: "youtube.premise",
    displayName: "Muse",
    role: "Premise/hook generator",
    tier: "standard",
    group: "youtube",
    statusSource: "youtube",
  },
  {
    key: "youtube.script_compose",
    displayName: "Scribe",
    role: "Script Composer — full narration + shot breakdown",
    tier: "heavy",
    group: "youtube",
    loadBearing: true,
    statusSource: "youtube",
    overrideKey: "youtube_script",
  },
  {
    key: "youtube.prompt_builder",
    displayName: "Forge",
    role: "Prompt Engineer — builds the Higgsfield generation prompt",
    tier: "heavy",
    group: "youtube",
    loadBearing: true,
    statusSource: "generation",
  },
  {
    key: "youtube.title_variants",
    displayName: "Namer",
    role: "Upload metadata — title/description/tag variants",
    tier: "light",
    group: "youtube",
    statusSource: "youtube",
  },
  {
    key: "edits.edit_spec",
    displayName: "Cutter",
    role: "Remotion edit-spec generator (NL → constrained JSON)",
    tier: "heavy",
    group: "youtube",
    statusSource: "youtube",
  },

  // ---- Lead-Gen -------------------------------------------------------------
  {
    key: "leadgen.qualify",
    displayName: "Prospector",
    role: "Qualifier — scores discovered businesses against ICP",
    tier: "standard",
    group: "leadgen",
    loadBearing: true,
    statusSource: "leadgen",
    overrideKey: "leadgen_qualify",
  },

  // ---- Career Intelligence --------------------------------------------------
  {
    key: "career.auto_pipeline",
    displayName: "Conductor",
    role: "Auto-pipeline orchestrator — evaluate → shortlist → tailor → outreach",
    tier: "heavy",
    group: "career",
    isOrchestrator: true,
    loadBearing: true,
    statusSource: "career",
  },
  {
    key: "career.scanner",
    displayName: "Scout",
    role: "Zero-token ATS scanner — public Greenhouse/Lever JSON, no LLM",
    tier: "deterministic",
    group: "career",
    statusSource: "career_scan",
  },
  {
    key: "career.extract_keywords",
    displayName: "Parser",
    role: "ATS keyword extraction",
    tier: "light",
    group: "career",
    statusSource: "career",
  },
  {
    key: "career.legitimacy_scan",
    displayName: "Sentinel",
    role: "Job legitimacy heuristics (3-tier)",
    tier: "light",
    group: "career",
    statusSource: "career",
  },
  {
    key: "career.evaluate",
    displayName: "Assessor",
    role: "Rubric evaluation → 6-block report + score + legitimacy tier",
    tier: "heavy",
    group: "career",
    loadBearing: true,
    statusSource: "career",
  },
  {
    key: "career.tailor_resume",
    displayName: "Tailor",
    role: "Resume/cover-letter tailoring — never fabricates",
    tier: "heavy",
    group: "career",
    statusSource: "career",
  },
  {
    key: "career.outreach",
    displayName: "Herald",
    role: "Recruiter/hiring-manager outreach drafting",
    tier: "standard",
    group: "career",
    statusSource: "career",
    overrideKey: "career_outreach",
  },
  {
    key: "career.apply_assist",
    displayName: "Aide",
    role: "Portal answer drafting from resume + STAR stories",
    tier: "standard",
    group: "career",
    statusSource: "career",
  },
  {
    key: "career.deep_research",
    displayName: "Digger",
    role: "6-axis company research (auto-exec or prompt-generator)",
    tier: "heavy",
    group: "career",
    statusSource: "career",
  },

  // ---- Freelance ------------------------------------------------------------
  {
    key: "ads.creative",
    displayName: "Adsmith",
    role: "Ad creative composer — PAS/BAB/testimonial scripts",
    tier: "standard",
    group: "freelance",
    statusSource: "jarvis",
    overrideKey: "ads_creative",
  },

  // ---- Arsenal --------------------------------------------------------------
  {
    key: "arsenal.skill_extract",
    displayName: "Curator",
    role: "Skill metadata inference for ingested SKILL.md files",
    tier: "standard",
    group: "arsenal",
    statusSource: "static",
  },
  {
    key: "arsenal.analyze_automation",
    displayName: "Analyst",
    role: "n8n workflow analysis — run-whole vs absorb-parts",
    tier: "heavy",
    group: "arsenal",
    statusSource: "automation",
  },

  // ---- Job-Hunt Engine (planned subsystem — see Architecture Script) ---------
  // Rendered on the canvas so the 4-node autopilot architecture is visible.
  // statusSource "static" until each node's backend + audit table lands.
  {
    key: "jobhunt.sourcer",
    displayName: "Sourcer",
    role: "Node 1 — sources & curates high-fit roles 24/7 via Crawl4AI across portals + hidden listings",
    tier: "deterministic",
    group: "jobhunt",
    statusSource: "jobhunt",
  },
  {
    key: "jobhunt.applicant",
    displayName: "Applicant",
    role: "Node 2 — surgical resume tailoring + headless-browser application; returns Job ID + confirmation screenshot",
    tier: "heavy",
    group: "jobhunt",
    statusSource: "static",
  },
  {
    key: "jobhunt.enricher",
    displayName: "Enricher",
    role: "Node 3 — Apollo→Hunter waterfall to find the hiring manager + deep company research",
    tier: "standard",
    group: "jobhunt",
    statusSource: "static",
  },
  {
    key: "jobhunt.emissary",
    displayName: "Emissary",
    role: "Node 4 — synchronized cold outreach (email + LinkedIn), humanized, minutes after apply",
    tier: "standard",
    group: "jobhunt",
    statusSource: "static",
  },
]

export const BASE_EDGES: AgentEdgeDef[] = [
  // LinkedIn handoffs
  { id: "e-li-1", source: "linkedin.trend_summarize", target: "linkedin.compose_post", kind: "handoff", label: "trend → draft" },
  { id: "e-li-2", source: "linkedin.compose_post", target: "linkedin.tweak_post", kind: "handoff", label: "draft → tweak" },
  // YouTube pipeline handoffs
  { id: "e-yt-1", source: "youtube.premise", target: "youtube.script_compose", kind: "handoff", label: "premise → script" },
  { id: "e-yt-2", source: "youtube.script_compose", target: "youtube.prompt_builder", kind: "handoff", label: "script → prompt" },
  { id: "e-yt-3", source: "youtube.prompt_builder", target: "youtube.title_variants", kind: "handoff", label: "→ upload meta" },
  { id: "e-yt-4", source: "youtube.script_compose", target: "edits.edit_spec", kind: "handoff", label: "→ edits" },
  // Career auto-pipeline
  { id: "e-ca-1", source: "career.scanner", target: "career.evaluate", kind: "handoff", label: "discovered → eval" },
  { id: "e-ca-2", source: "career.evaluate", target: "career.tailor_resume", kind: "handoff", label: "shortlist → tailor" },
  { id: "e-ca-3", source: "career.tailor_resume", target: "career.outreach", kind: "handoff", label: "tailor → outreach" },
  { id: "e-ca-4", source: "career.evaluate", target: "career.deep_research", kind: "handoff", label: "→ research" },
  { id: "e-ca-5", source: "career.evaluate", target: "career.extract_keywords", kind: "handoff", label: "→ keywords" },
  { id: "e-ca-6", source: "career.evaluate", target: "career.legitimacy_scan", kind: "handoff", label: "→ legitimacy" },
  { id: "e-ca-orch", source: "career.auto_pipeline", target: "career.evaluate", kind: "control", label: "drives" },
  // Core
  { id: "e-core-1", source: "os_chat.text_to_sql", target: "os_chat.summarize_rows", kind: "handoff", label: "rows → prose" },
  // Jarvis global control edges (dashed)
  { id: "e-jv-1", source: "os_chat.jarvis", target: "os_chat.text_to_sql", kind: "control" },
  { id: "e-jv-2", source: "os_chat.jarvis", target: "browse_page", kind: "control" },
  { id: "e-jv-3", source: "os_chat.jarvis", target: "career.auto_pipeline", kind: "control" },
  { id: "e-jv-4", source: "os_chat.jarvis", target: "leadgen.qualify", kind: "control" },
  { id: "e-jv-5", source: "os_chat.jarvis", target: "linkedin.compose_post", kind: "control" },
  { id: "e-jv-6", source: "os_chat.jarvis", target: "ads.creative", kind: "control" },
  { id: "e-jv-7", source: "os_chat.jarvis", target: "arsenal.analyze_automation", kind: "control" },
  // Job-Hunt engine: sourced role → apply → enrich → outreach (shared data packet)
  { id: "e-jh-1", source: "jobhunt.sourcer", target: "jobhunt.applicant", kind: "handoff", label: "curated role" },
  { id: "e-jh-2", source: "jobhunt.applicant", target: "jobhunt.enricher", kind: "handoff", label: "job id + org" },
  { id: "e-jh-3", source: "jobhunt.enricher", target: "jobhunt.emissary", kind: "handoff", label: "manager + intel" },
  { id: "e-jh-orch", source: "os_chat.jarvis", target: "jobhunt.sourcer", kind: "control", label: "boots + feeds PRD" },
]

export const AGENT_BY_KEY: Record<string, AgentDef> = Object.fromEntries(BASE_AGENTS.map((a) => [a.key, a]))
