# Source Mining

## What this workflow is

Turns raw exports in `sources/` (call transcripts, Slack/Teams history, email threads, old proposals) into dated brain notes. This is how the brain gets deep without the owner writing history by hand. Run whenever new material lands in `sources/`.

## Prerequisites

- Raw files in `sources/` (any text format; convert first if needed)
- `brain/INDEX.md` (to avoid duplicating existing notes)

## Inputs

| Field | Required | Description |
|---|---|---|
| Source file(s) | yes | What to mine |
| Date context | yes | When the source material is from — every extracted note inherits a date |
| Client link | no | If the source is about a client, notes also feed `clients/{name}/history.md` |

## Process

### Step 1: Read and segment [JUDGMENT]

Identify the extractable facts: decisions made (with reasoning), lessons learned, durable reference facts, metric snapshots, ideas floated.

### Step 2: Extract into notes [JUDGMENT]

One fact per note. Filename: `YYYY-MM-DD_slug.md` using the source material's date, not today's. Route to the right category: decisions/, notes/, references/, metrics/, ideas/. Specifics only — numbers, names, exact phrasings. A note without specifics does not get written.

### Step 3: Update INDEX.md [SCRIPT]

One line per new note, under its category.

### Step 4: Client propagation [JUDGMENT]

If notes concern a client, add the dated entries to `clients/{name}/history.md` too.

### Step 5: Trigger the backlink pass [JUDGMENT]

After any bulk import, run `directives/brain_backlinking.md` on the new notes.

## Quality gates

- [ ] Every note dated from the source material's timeline
- [ ] One fact per note — no multi-topic notes
- [ ] Zero invented details; ambiguous facts get a `[verify]` marker
- [ ] INDEX.md updated in the same session
- [ ] Nothing sensitive extracted into a committed file (credentials, personal data → flag instead)

## Edge cases

- Source contradicts an existing note → extract anyway, flag the pair for the contradiction audit
- Source is too thin to yield specifics → report "no extractable facts" honestly rather than padding
- Duplicate of an existing note → skip, but add missing specifics to the existing note if the source has better numbers

## Self-annealing log

- 2026-07-07: Directive created from the blueprint's sources/ mining shortcut.
