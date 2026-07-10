# Contradiction Audit

## What this workflow is

Reads the brain looking for notes that disagree with each other — old pricing vs. new pricing, stale rosters, reversed decisions — flags them, and the owner rules on each. Run every few weeks. A brain that is never audited becomes a brain you cannot trust.

## Prerequisites

- Full `brain/` tree and `context/` files
- `clients/*/history.md` files

## Inputs

| Field | Required | Description |
|---|---|---|
| Scope | no | Default: everything. Narrow to a category if a specific import raised doubts. |

## Process

### Step 1: Sweep for conflicts [JUDGMENT]

Compare dated notes on the same topic. Newer note wins by default, but only the owner confirms. Check: pricing facts, service definitions, client statuses, decisions and their reversals, tech stack claims, metric snapshots.

### Step 2: Build the conflict table [SCRIPT]

| # | Note A (date) | Note B (date) | The conflict | Proposed ruling |

### Step 3: Owner rules on each [JUDGMENT]

Present the table. For each ruling: update the losing note with a dated deprecation line pointing at the winner (do not delete — history is evidence), or merge if both are partly right.

### Step 4: Propagate [JUDGMENT]

If a ruling changes `context/` facts (pricing, positioning), update those files too. Add a `brain/decisions/` note if the ruling itself was a decision.

## Quality gates

- [ ] No conflict resolved without an owner ruling
- [ ] Deprecated notes marked, never silently deleted
- [ ] Context files updated where rulings affect them
- [ ] Audit itself logged as a dated brain note (what was found, what was ruled)

## Edge cases

- Conflict between a brain note and the operator_os app's database → the app wins for operational state (deal stages, post statuses); the brain wins for reasoning and lessons
- A contradiction reveals an undocumented decision → write the missing decision note as part of the audit

## Self-annealing log

- 2026-07-07: Directive created from the blueprint's maintenance protocol.
