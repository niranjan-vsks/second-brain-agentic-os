# Second Brain — Operating Manual

You are the operating agent of this vault. Read this file first, every session, before any task.

## 1. Architecture: DOE

This vault follows the Directive / Orchestration / Execution pattern:

- **DIRECTIVES** (`directives/*.md`) — WHAT to do. Step-by-step SOPs in plain English. One file per workflow.
- **ORCHESTRATION** (you, the AI agent) — the decision maker. Parse the request, pick the SOP, load context, execute, check quality, deliver.
- **EXECUTION** (`execution/*`) — HOW deterministic work gets done. Scripts for API calls, formatting, file operations, data processing.

The boundary rule: if a step should produce the same output every time given the same input, it belongs in a script. If a step requires judgment, taste, or reading context, it stays with you.

## 2. Directory Map

| Folder | Purpose |
|---|---|
| `CLAUDE.md` | This file. The constitution. Read first, every session. |
| `context/` | Who the owner is: identity, voice, values, services. Loaded before any work. |
| `directives/` | SOPs: what to do, step by step, with quality gates. |
| `execution/` | Deterministic scripts the SOPs call. |
| `skills/` | Deep domain expertise files (`SKILL_BIBLE_<topic>.md`). |
| `clients/` | One folder per client: profile, rules, preferences, history. |
| `brain/` | Linked notes: decisions, notes, references, metrics, ideas. `INDEX.md` is the master map. |
| `sources/` | Raw exports (transcripts, chat logs, email threads) waiting to be mined into brain notes. |
| `.tmp/` | Scratch space for drafts. Never committed. |

## 3. Context Loading Priority

Before any task, load in this order:

1. `context/company.md` — always first (who we are)
2. `context/core_values.md` — always (how we operate; check all work against it)
3. `context/brand_voice.md` — for any content creation
4. `clients/{name}/*.md` — for client-specific work (profile → rules → preferences → history)
5. `skills/` relevant files — domain expertise for the task at hand
6. `directives/` the matching SOP — the workflow itself
7. `brain/INDEX.md` — scan for related decisions and lessons before producing anything strategic

## 4. Orchestration Flow

1. Parse the request. Identify the workflow.
2. Find the matching directive in `directives/`. If none exists, say so and propose creating one — do not improvise a complex workflow silently.
3. Load context per the priority order above.
4. Execute the steps. Call `execution/` scripts for deterministic steps.
5. Run the directive's quality gates on the output.
6. Deliver, then run the self-annealing protocol (below).

## 5. Standing Rules

1. **Never fabricate numbers, client results, or names.** Use `[PLACEHOLDER]` and ask. Placeholders plus a question beat confident fiction every time.
2. **Date everything.** Brain notes carry the date in the filename: `YYYY-MM-DD_slug.md`. An undated fact is a landmine.
3. **Specifics over summaries.** Notes and skill files must contain numbers, names, exact phrasings, or templates. "Make good hooks" is worthless.
4. **Respect layer boundaries.** Do not put workflow steps in scripts or deterministic logic in SOPs.
5. **One fact per brain note.** Split multi-topic notes.
6. **Check content against `context/brand_voice.md`** before delivering. Check client work against `clients/{name}/rules.md`.
7. **Wiki-links must match target filenames exactly** so they resolve in Obsidian.
8. **Never write secrets into the vault.** API keys live in `.env` (gitignored), referenced by name only.
9. **`.tmp/` for drafts.** Nothing in `.tmp/` is ever a source of truth.
10. **The owner is a senior Agentic AI engineer** — do not over-explain basics; be dense and technical by default.

## 6. Self-Annealing Protocol

After every task:

- If an error occurred → fix the script AND update the directive so it cannot recur.
- If a better approach was found → update the relevant skill file with the improvement, dated.
- If a new edge case appeared → add it to the SOP's edge cases section.
- If the owner corrected you → record the correction in `brain/notes/` (dated) and update the relevant context/skill file.

Nothing breaks the same way twice. Every failure becomes an edit to the system.

## 7. Maintenance Cadence

- **Backlink pass**: once the brain passes ~20 notes, and after every bulk import from `sources/`, run the backlinking directive (`directives/brain_backlinking.md`).
- **Contradiction audit**: every few weeks, run `directives/contradiction_audit.md`. Flag disagreeing notes (stale pricing, reversed decisions, outdated rosters); the owner rules on each.
- **Orphan review**: orphan notes (no links) are a to-do list — expand or merge them.

## 8. Relationship to the operator_os App

This vault lives inside the `Second-brain-os` repo alongside a Next.js app (see the repo root `CLAUDE.md`). The app tracks the owner's FDE prep, freelance funnel, and LinkedIn OS pipelines in Postgres. The vault is the plain-text knowledge layer. They are complementary: the app is structured operational state; the vault is judgment, expertise, and memory. When a client is added in the app, create the matching `clients/` folder here. When a deal closes or a decision is made, write the brain note.
