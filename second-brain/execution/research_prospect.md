# SCRIPT SPEC: research_prospect

> Status: **spec, not yet implemented.** The owner has open-source scraping repos that plug in here. Hand this spec plus those repos to Claude Code. Per the DOE rule, this collection step is deterministic and must be a script — the AI only interprets the results.

## Purpose

Given a company or person, deterministically collect the public signal the `lead_research.md` directive needs for Step 1.

## Interface

```
node execution/research_prospect.mjs --name "Acme Corp" [--url https://acme.com] [--linkedin <url>] --out .tmp/research/acme-corp.json
```

## Collection targets (in priority order)

1. Company site: title/meta, /about, /careers, tech hints (script tags, job posts mentioning stacks)
2. Job postings: any AI/automation/data roles = budget + pain signal
3. LinkedIn public presence: size, recent posts (via the owner's scraping repos — respect rate limits and ToS)
4. News/press: last 12 months
5. Tech stack detection: BuiltWith-style fingerprinting if available in the repos

## Output shape

```json
{
  "name": "",
  "collectedAt": "ISO date",
  "site": { "summary": "", "careersSignals": [], "techHints": [] },
  "jobs": [{ "title": "", "signals": [], "url": "" }],
  "linkedin": { "size": "", "recentThemes": [] },
  "news": [{ "date": "", "headline": "", "url": "" }],
  "raw": { }
}
```

## Rules

- Fail loudly per source (a missing LinkedIn page is data, not an error to hide)
- Never invent fields — empty array over guessed content
- Cache raw responses under `.tmp/research/raw/` for reproducibility
- API keys via `.env` only (`SCRAPER_API_KEY` etc.), referenced by name

## Env vars

| Var | Purpose |
|---|---|
| `[FILL per owner's scraping repos]` | |
