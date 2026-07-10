# Brain Backlinking Pass

## What this workflow is

Wires the brain together with wiki-links so Obsidian's graph and backlinks panels work. Run once the brain passes ~20 notes, then after every bulk import from `sources/`. This is the blueprint's refined prompt, encoded as a directive.

## Prerequisites

- The full `brain/` tree
- `brain/INDEX.md` up to date

## Inputs

| Field | Required | Description |
|---|---|---|
| Scope | no | Default: all of `brain/`. Can be limited to one category after a targeted import. |

## Process

### Step 1: Read the index, then the notes [JUDGMENT]

### Step 2: Add links [JUDGMENT]

Go through every note in `brain/` and add `[[wikilinks]]` connecting notes that genuinely share a client, a decision, a project, a person, or a lesson.

Rules (verbatim from the blueprint — do not loosen):

- Link text must match the target note's filename exactly, so the link resolves in Obsidian.
- Only add a link where following it would teach the reader something real. Relationships, not keyword matches.
- Most notes should end up with 2 to 5 links. If a note honestly connects to nothing, leave it alone and report it instead of forcing a link.
- Add links only. Do not rewrite, trim, or improve any other content.

### Step 3: Report [JUDGMENT]

How many links added, which notes are orphans, and the three most surprising connections found.

## Quality gates

- [ ] Git diff shows ONLY added links — no other content changes
- [ ] Every added link resolves (target filename exists)
- [ ] No note exceeded ~5 links without genuine cause
- [ ] Orphan list reported, not force-linked

## Edge cases

- Two notes contradict each other → do not link them silently; flag for the contradiction audit
- A note is really 3 facts → report it for splitting (one fact per note rule); do not split during a link pass

## Self-annealing log

- 2026-07-07: Directive created from the blueprint's refined backlinking prompt.
