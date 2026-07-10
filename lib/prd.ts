export const RESEARCH_AGENT_PRD = `# PRD: Focused Research Agent ("Deep Harvester")

**Version:** 1.0
**Owner:** You
**Executor:** Claude Code
**Status:** Ready to build

---

## 0. One-Paragraph Summary

A locally-run, CLI-first agentic research system that takes a research brief (topic + subtopics + constraints), orchestrates existing open-source scrapers to pull relevant content from the web in a structured and focused way, filters and deduplicates the haul, distills it into clean, source-attributed Markdown files (and optional PDFs), and writes everything into a Google-Drive-synced output directory so the corpus can be loaded into NotebookLM with zero manual reformatting. The system must be model-agnostic (any LLM behind a single adapter interface) and resumable (crash mid-run, resume without redoing work).

---

## 1. Goals & Non-Goals

### Goals
1. Turn a one-paragraph research brief into a NotebookLM-ready corpus of 10-50 curated Markdown documents in a single command.
2. Every claim in every output document is traceable to a source URL.
3. Model-agnostic: swapping GPT/Claude/Gemini/local models requires changing ONE config value.
4. Resumable: every pipeline stage checkpoints to disk; re-running skips completed work.
5. Scraper-agnostic: the user already has open-source scraping repos; the system wraps them behind one interface rather than implementing scraping itself.
6. Designed for later integration into a Next.js "OS" app (see §10): core logic lives in a pure library layer with no CLI dependencies.

### Non-Goals (v1)
- No browser UI (CLI only; the OS app integration comes later).
- No automatic NotebookLM upload (NotebookLM has no public API as of the time of writing — verify before building; if still true, output to a Drive-synced folder and print manual-import instructions. If an API/automation path exists by build time, implement it behind the \`publishers/\` interface).
- No real-time monitoring dashboards.
- No multi-user support.

---

## 2. User Story

> As an FDE candidate preparing aggressively, I write a brief like "Production RAG evaluation: metrics, frameworks (RAGAS etc.), golden set construction, LLM-as-judge calibration, papers from 2023 onward, prefer engineering blogs from companies who run RAG at scale," run \`harvest run brief.yaml\`, wait, and get back \`~/Drive/research/prod-rag-evals/\` containing 15-30 clean .md files organized by subtopic, each with citations, plus a \`_MANIFEST.md\` index. I open NotebookLM, import the folder, and start studying.

---

## 3. Architecture

\`\`\`
harvest/
├── cli.py                  # Typer CLI entrypoint (thin — calls core only)
├── core/
│   ├── pipeline.py         # Stage orchestrator + checkpointing
│   ├── state.py            # RunState: persisted JSON state machine
│   ├── brief.py            # Brief schema (pydantic) + loader
│   └── config.py           # Global config (models, paths, limits)
├── llm/
│   ├── adapter.py          # LLMAdapter protocol: complete(), complete_json()
│   ├── litellm_impl.py     # Default impl via litellm (covers all providers)
│   └── prompts/            # ALL prompts as .md files with {placeholders}
│       ├── plan_queries.md
│       ├── score_relevance.md
│       ├── extract_content.md
│       ├── synthesize_doc.md
│       └── build_manifest.md
├── scrapers/
│   ├── base.py             # Scraper protocol: search(), fetch()
│   ├── registry.py         # Maps scraper name -> implementation
│   └── adapters/           # One thin adapter per existing OSS scraper repo
│       └── (user's repos wired in here — subprocess or import)
├── stages/
│   ├── s1_plan.py          # Brief -> query plan
│   ├── s2_harvest.py       # Queries -> raw documents
│   ├── s3_filter.py        # Raw docs -> scored, deduped, relevant docs
│   ├── s4_distill.py       # Relevant docs -> synthesized topic Markdown
│   └── s5_publish.py       # Markdown -> output dir (+ optional PDF)
├── publishers/
│   ├── base.py             # Publisher protocol: publish(corpus) -> location
│   ├── drive_folder.py     # Writes to a Drive-synced local folder (default)
│   └── notebooklm.py       # Stub: implement if/when automation path exists
├── runs/                   # One folder per run: state.json + artifacts per stage
└── briefs/                 # Saved research briefs (YAML)
\`\`\`

### Data flow
\`\`\`
brief.yaml
  -> [S1 PLAN]    query_plan.json      (subtopics, search queries, source-type prefs)
  -> [S2 HARVEST] raw/*.json           (url, title, raw_html/text, scraper, fetched_at)
  -> [S3 FILTER]  filtered/*.json      (relevance score 0-100, dedupe cluster id, keep/drop + reason)
  -> [S4 DISTILL] distilled/<subtopic>.md  (synthesized, cited)
  -> [S5 PUBLISH] <output_dir>/        (final .md files, _MANIFEST.md, optional .pdf)
\`\`\`

---

## 4. Detailed Stage Specifications

### S1 — PLAN
- **Input:** \`brief.yaml\` (schema in §5).
- **Process:** One LLM call with \`plan_queries.md\` prompt. Produces:
  - 3-8 subtopics (each becomes one output document).
  - Per subtopic: 3-6 search queries, preferred source types (paper / engineering blog / docs / repo / talk transcript), recency cutoff, and 2-4 "must answer" questions.
- **Output:** \`runs/<run_id>/query_plan.json\` (validated against pydantic schema; on validation failure retry LLM call up to 3 times with error feedback appended).
- **Human gate (default ON):** print plan, ask y/n/edit before proceeding. \`--no-confirm\` skips.

### S2 — HARVEST
- **Input:** query_plan.json.
- **Process:** For each query, call configured scrapers via the registry. Concurrency: asyncio with a semaphore (default 4). Per-query cap (default 10 results). Global cap (default 300 raw docs).
- **Politeness:** respect robots.txt if the underlying scraper doesn't already; per-domain rate limit 1 req/2s; identify with an honest User-Agent; hard-skip paywalled/login-gated content.
- **Dedupe (cheap, pre-LLM):** URL canonicalization (strip utm params, trailing slash, mobile subdomains); skip already-fetched URLs across the run.
- **Output:** \`runs/<run_id>/raw/<sha1(url)>.json\` — one file per doc: \`{url, canonical_url, title, text, source_query, subtopic, scraper, fetched_at, content_hash}\`.
- **Checkpoint:** state.json records completed queries; resume skips them.

### S3 — FILTER
- **Input:** all raw docs.
- **Process:**
  1. Hard filters (no LLM): min text length 500 chars, language = English (or per brief), domain blocklist/allowlist from brief.
  2. Near-dup detection: MinHash/SimHash on text; cluster; keep the longest doc per cluster.
  3. LLM relevance scoring (\`score_relevance.md\`): batch docs (title + first 1500 chars) against the subtopic's "must answer" questions -> score 0-100 + one-line justification. Keep score >= 60 (configurable).
  4. Cap kept docs per subtopic (default 12), keeping highest scores.
- **Output:** \`runs/<run_id>/filtered/manifest.json\` + per-doc decisions with reasons (auditability is a requirement, not a nice-to-have).

### S4 — DISTILL
- **Input:** kept docs grouped by subtopic.
- **Process:** Per subtopic, one synthesis LLM call (\`synthesize_doc.md\`) with map-reduce if the docs exceed the context budget:
  - MAP: per-doc extraction (\`extract_content.md\`) -> structured notes: {key_claims[], data_points[], quotes[], caveats[]} each tagged with source url.
  - REDUCE: synthesize notes into ONE Markdown doc per subtopic.
- **Output document contract (strict):**
\`\`\`markdown
# <Subtopic Title>
> Generated: <date> | Sources: <n> | Run: <run_id>

## TL;DR
(5-8 bullets, each ends with [n] citation markers)

## <Themed sections derived from the must-answer questions>
(prose + bullets, every non-obvious claim carries [n])

## Open Questions & Contradictions
(where sources disagree — cite both sides)

## Sources
[1] <title> — <url> (accessed <date>)
...
\`\`\`
- Target length per doc: 800-2500 words. No filler. No hallucinated citations: every [n] must map to a harvested URL, enforced by a post-generation validator that regex-checks citation markers against the source list and fails the doc (with one retry) on any dangling citation.

### S5 — PUBLISH
- **Input:** distilled Markdown files.
- **Process:**
  - Write to \`output_dir\` from brief (default: a Google-Drive-synced folder path from config).
  - Generate \`_MANIFEST.md\`: corpus title, brief summary, doc list with one-line descriptions, total source count, generation date.
  - Optional \`--pdf\`: convert each .md via pandoc or weasyprint (verify availability at runtime; skip gracefully with a warning if absent).
  - Print exact NotebookLM import instructions (open notebook -> Add sources -> Google Drive / upload folder contents).
- **NotebookLM automation:** implement \`publishers/notebooklm.py\` ONLY if a supported API or stable automation path exists at build time. Check first; do not build a brittle browser-automation hack in v1.

---

## 5. Brief Schema (brief.yaml)

\`\`\`yaml
title: "Production RAG Evaluation"
objective: >
  Deep understanding of RAG eval for FDE interviews: metrics, frameworks,
  golden set construction, LLM-as-judge calibration.
subtopic_hints:            # optional; S1 may add more
  - "Faithfulness & answer relevance metrics"
  - "RAGAS and alternatives"
audience: "Senior AI engineer prepping for FDE interviews"
recency: "2023-01-01"      # ignore older content unless canonical
source_preferences:
  prefer: [engineering-blog, paper, official-docs]
  avoid: [seo-listicle, low-effort-tutorial]
domain_allowlist: []        # optional
domain_blocklist: ["medium.com/@*"]   # optional, glob-ish
limits:
  max_raw_docs: 300
  max_docs_per_subtopic: 12
output:
  dir: "~/GoogleDrive/research/prod-rag-evals"
  pdf: false
\`\`\`

---

## 6. Model-Agnosticism Requirements (non-negotiable)

1. All LLM calls go through \`LLMAdapter\` with exactly two methods:
   - \`complete(prompt: str, system: str | None) -> str\`
   - \`complete_json(prompt: str, schema: type[BaseModel], system: str | None) -> BaseModel\` (retries with validation-error feedback, max 3)
2. Default implementation uses \`litellm\` so one config string (\`model: "anthropic/claude-sonnet-4-5"\` or \`"openai/gpt-5"\` or \`"ollama/llama3.3"\`) switches providers. Verify current litellm API and model IDs at build time — do not hardcode from memory.
3. Two model tiers in config: \`model_fast\` (scoring, extraction) and \`model_smart\` (planning, synthesis).
4. ALL prompts live in \`llm/prompts/*.md\` as templates. No prompt strings in Python code. Prompts must be written defensively: explicit output format, explicit "if you cannot comply, output ERROR: <reason>", few-shot example where the format is non-trivial. Assume a weak model will run them.

---

## 7. Reliability Requirements

- \`state.json\` per run: \`{run_id, brief_hash, stage, completed_units[], failed_units[], started_at, updated_at}\`. Updated atomically (write temp file, rename).
- \`harvest resume <run_id>\` continues from the last incomplete unit.
- Per-unit try/except: one failed URL or one failed synthesis never kills the run; failures are recorded and reported in the final summary.
- Retries: network fetches 3x exponential backoff; LLM calls 3x with error feedback.
- Cost guard: track token usage per stage; abort with a clear message if projected cost exceeds \`max_cost_usd\` from config (default 5.00).
- Logging: structured lines to \`runs/<run_id>/run.log\` — \`[stage] [unit] [status] [detail]\`.

---

## 8. Scraper Integration Contract

The user will supply existing OSS scraper repos. Wrap each behind:

\`\`\`python
class Scraper(Protocol):
    name: str
    def search(self, query: str, limit: int) -> list[SearchResult]: ...
    def fetch(self, url: str) -> FetchedDoc | None: ...
\`\`\`

- Integration mode per repo: prefer \`pip install -e\` + import; fall back to subprocess with JSON over stdout if the repo is CLI-only.
- \`scrapers/registry.py\` maps names from config to adapters; the brief/config decides which scrapers run.
- Build ONE reference adapter against a simple built-in fetcher (httpx + trafilatura for extraction) so the system works end-to-end before any user repo is wired in. Trafilatura for main-content extraction; verify current API at build time.

---

## 9. Acceptance Criteria (test these before calling it done)

1. \`harvest run briefs/example.yaml --no-confirm\` completes end-to-end on the built-in fetcher and produces >= 3 subtopic .md files + _MANIFEST.md in the output dir.
2. Kill the process during S2; \`harvest resume <run_id>\` completes without re-fetching completed URLs (verify via log).
3. Change \`model_smart\` in config to a different provider; rerun S4 only (\`harvest rerun <run_id> --from distill\`); output regenerates with no code changes.
4. Every citation [n] in every output doc resolves to a URL in that doc's Sources section (run the validator across the corpus; zero dangling citations).
5. A doc scoring < 60 relevance appears in filtered/manifest.json with a drop reason.
6. Total run cost is printed at the end and respects max_cost_usd.

---

## 10. Future Integration into the Personal OS (design for, don't build)

- Keep \`core/\`, \`stages/\`, \`llm/\`, \`scrapers/\` free of CLI imports so they can later be called from a FastAPI service.
- v2 sketch: a \`POST /runs\` endpoint + polling \`GET /runs/<id>\` that the OS app (Next.js, this project) calls; the OS's FDE Prep tab gets a "Research" section that submits briefs and lists completed corpora with links to the Drive folder.
- Store run metadata in a SQLite file now (\`runs/index.db\`) so migrating run history into the OS's Postgres later is a data migration, not a redesign.

---

## 11. Build Order for Claude Code

1. Scaffold repo, pydantic schemas (Brief, QueryPlan, RawDoc, FilterDecision, RunState), config loading.
2. LLMAdapter + litellm impl + prompt loader. Unit test complete_json retry loop with a mocked adapter.
3. Built-in fetcher scraper (httpx + trafilatura) + registry.
4. Pipeline orchestrator + state checkpointing + resume. Test with no-op stages.
5. S1 plan -> S2 harvest -> S3 filter -> S4 distill -> S5 publish, in order, each runnable standalone via \`harvest rerun --from <stage>\`.
6. Citation validator + cost guard.
7. Wire in the user's OSS scraper repos as adapters (user provides repos at this step).
8. Run acceptance criteria §9.

**Instructions to Claude Code:** Work through §11 in order. After each numbered step, run the relevant tests before proceeding. Ask the user for their scraper repos at step 7, not before. Verify all third-party library APIs (litellm, trafilatura, typer) against current docs rather than memory.
`
