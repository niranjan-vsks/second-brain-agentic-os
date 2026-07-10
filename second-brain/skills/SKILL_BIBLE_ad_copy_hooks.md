# SKILL BIBLE: Ad Copy Hooks & Frameworks

> Source: "10 Claude Code Skills for Meta Ads" (HeyOz). Frameworks extracted and already wired into `app/actions/ads.ts` (Ad Creative Studio). The full Meta-API skills (fatigue scan, budget rebalance, CAPI setup, audience audit, weekly report) require META_ACCESS_TOKEN and live in the source PDF — implement as `/commands` in Claude Code when the owner runs Meta campaigns.

## Frameworks (apply per creative type)

**PAS (Problem/Agitate/Solution)** — direct-response default.
Name the problem → make it emotionally painful → introduce the solution.
Body skeleton: "Every day you [problem], you're [negative consequence]. It doesn't have to be this way. [Product] [solves it]."

**BAB (Before/After/Bridge)** — UGC and transformation content.
Painful current state → ideal future state → product as the bridge.
Body skeleton: "Before [product]: [painful state]. After: [desired state]. The bridge: [how]."

**AIDA** — colder audiences.
Pattern-interrupt headline → specific proof → desire statement → CTA with urgency.

**Pattern Interrupts** — hooks only.
Open with "Stop.", "Wait.", "Don't [expected action].", a bare number, or a rhetorical question.

**Social Proof** — testimonial creative.
Lead with credibility: customer count, transformation testimonial, authority endorsement.

**Curiosity Gap** — awareness content.
"The [unexpected thing] about [familiar topic]" / "Why [common belief] is wrong."

## Variation axes (when generating N variants)
- Emotional intensity: subtle vs. strong
- Specificity: hard numbers vs. general claims
- POV: second / first / third person
- Hook trigger: pain avoidance / aspiration / curiosity / social proof

## Constraints (Meta placements)
primary_text ≤ 125 chars visible, headline ≤ 40, description ≤ 30.

## Testing doctrine
Run 5-10 hooks in a small ABO test for 3-4 days before scaling winners. Fatigue signals: hook rate drops below floor, CTR WoW decline > 15%, frequency > 4.0, CPM WoW +30%.

## Cross-references
- [[2026-07-07_reference-service-lines-and-bottlenecks]] — ad creatives are a deliverable in the freelance funnel
- App integration: `ad_creatives` table + Ad Studio sub-tab (Freelance Funnel)
