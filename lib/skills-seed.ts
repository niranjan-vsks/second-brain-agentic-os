import "server-only"
// Curated skill pack — distilled from the "100+ Agent Marketing & Sales Agents"
// guide (new_agents/*.pdf) and ENRICHED for operator_os's actual context:
// solo Agentic-AI freelancer in India (₹50k–₹5L deals, WhatsApp-reachable SMB
// decision makers), FDE job hunt, LinkedIn personal brand, YouTube ads.
//
// Deliberate curation, not a 1:1 port: the guide's 100 "agents" are prompt
// templates; ~60 overlap agents we already run or roles we don't have (CS
// team, paid-media team). What survives is craft that measurably upgrades our
// FIVE real agents. Each skill maps to targetAgents so injection is automatic.

import type { ParsedSkill } from "@/lib/skills"

export const CURATED_PACK: (ParsedSkill & { slugHint: string })[] = [
  // ---- leadgen_qualify ------------------------------------------------------
  {
    slugHint: "icp-scoring-discipline",
    name: "ICP Scoring Discipline",
    description: "Hard scoring rules that stop score inflation and force evidence-based qualification.",
    tags: "sales,leadgen,icp",
    targetAgents: "leadgen_qualify",
    content: `Score each prospect 0-100 against the ICP with these hard rules:
- NEVER score above 80 without a verified buying trigger (recent event: new branch opening, hiring spree, bad-review cluster, festival season demand, competitor adopting AI, funding/expansion news).
- Output a PROCEED / SKIP recommendation with the score — a number without a decision is useless.
- Rationale must cite 2-3 concrete observed facts (no website, outdated site, manual booking flow, WhatsApp-only ordering, high review volume with slow replies). Mark anything unverifiable as VERIFY, never assume it.
- Deal-size sanity: estimate what this business could plausibly pay against the ₹50k-₹5L band. A prospect that can't fund the floor is a SKIP regardless of fit score.
- Reachability gate: prefer prospects where the decision maker is directly reachable (owner-operated, phone/WhatsApp listed). A perfect-fit prospect nobody can reach scores max 60.`,
  },
  {
    slugHint: "buying-trigger-detection",
    name: "Buying Trigger Detection",
    description: "Catalog of buying signals that mark an account hot, adapted to Indian SMB freelance prospecting.",
    tags: "sales,leadgen,signals",
    targetAgents: "leadgen_qualify",
    content: `Treat these as buying triggers that raise priority and justify scores above 80:
- Job postings for roles the owner's automation could replace or assist (receptionist, telecaller, data entry, social media manager).
- Recent Google reviews mentioning slow response, missed calls, or booking friction — direct pitch ammo for voice agents / chatbots.
- New branch/location opening (expansion = budget + operational strain).
- Competitor in the same locality visibly using online booking, WhatsApp automation, or a chatbot.
- Seasonal demand windows (wedding season for boutiques/salons, admissions season for coaching institutes, festival retail spikes).
When a trigger is present, name it explicitly in the rationale and reference it in the suggested pitch angle - trigger-led pitches convert several times better than generic capability pitches.`,
  },

  // ---- career_outreach ------------------------------------------------------
  {
    slugHint: "cold-email-craft",
    name: "Cold Email Craft",
    description: "First-touch email rules: trigger-led opener, one CTA, no filler.",
    tags: "sales,outreach,email",
    targetAgents: "career_outreach",
    content: `First-touch message rules:
- Lead with the trigger (their post, their product launch, the job posting, team growth) — never with yourself.
- 4-6 lines maximum. Subject line under 6 words, lowercase or sentence case, no clickbait.
- ONE call-to-action only. Never stack asks ("call or coffee or reply?" = no reply).
- Banned phrases: "I hope this finds you well", "I'm excited to", "quick question", any feature dump.
- Every follow-up must add a NEW angle (a relevant artifact, an insight about their stack, a specific idea) — never "just checking in" or repeating the same pitch.
- Follow-up cadence: day 3, day 7, day 14 — three touches then stop; graceful exit line on the last one.
- Objection replies: reframe, never defend. "We already have a solution" gets a differentiation angle in one paragraph; "no budget" gets a smaller first step or a graceful exit.`,
  },
  {
    slugHint: "linkedin-dm-rapport",
    name: "LinkedIn DM Rapport Rules",
    description: "Connection-request and DM sequencing that builds rapport before any ask.",
    tags: "outreach,linkedin,dm",
    targetAgents: "career_outreach",
    content: `LinkedIn connection + DM rules:
- Connection note under 300 characters, references something SPECIFIC they posted, built, or said. No pitch in the connection note. Ever.
- DM sequence: message 1-2 build rapport (their content, shared context, genuine question); the ask comes only in message 3 and is small (opinion, pointer, 15-min chat) — not a meeting demand.
- For hiring-manager outreach: reference the specific role and one concrete, relevant thing you shipped that maps to their JD. One line of credibility, not a resume dump.
- Multithread: when a target account matters, identify 2-3 people (hiring manager, team lead, recruiter) and vary the angle per person — never copy-paste the same message to multiple people at one company.`,
  },

  // ---- linkedin_post --------------------------------------------------------
  {
    slugHint: "scroll-stopping-hooks",
    name: "Scroll-Stopping Hook Rules",
    description: "Hook-first writing discipline: the first line earns the rest of the post.",
    tags: "content,linkedin,hooks",
    targetAgents: "linkedin_post",
    content: `Hook discipline for every post:
- The first line must work as a STANDALONE sentence — assume nobody clicks "see more" unless line 1 forces it.
- Banned openers: "I'm excited to share", "Thrilled to announce", "In today's world", "As an engineer", rhetorical throat-clearing.
- Strong hook patterns: contrarian claim ("Most RAG pipelines fail before retrieval"), specific number + tension ("3 lines of code cut our eval cost 80%"), before/after gap, uncomfortable question, short war story opener ("The client's voice agent hung up on their biggest customer.").
- Generate the hook LAST: draft the body first, extract its sharpest claim, promote that to line 1.
- Open with the insight, not the context. Backstory (if needed) comes after the point is made.
- End with either ONE question that invites replies or a clean closing line — never both, never three hashtags of filler.`,
  },
  {
    slugHint: "content-repurposing-map",
    name: "Content Repurposing Map",
    description: "One asset → five formats; every long-form piece becomes a content week.",
    tags: "content,repurposing",
    targetAgents: "linkedin_post",
    content: `When drafting from a substantial source (project write-up, YouTube script, deep insight), think in repurposing units:
- 1 long-form piece yields: 1 narrative post (story arc), 1 tactical post (numbered steps/checklist), 1 contrarian take (what everyone gets wrong), 1 metric post (result + how), 1 carousel outline (slide 1 hook / slides 2-7 one point each / final slide CTA).
- Never publish two posts from the same source back-to-back — space them across the week and vary the angle.
- Each derivative must stand fully alone: no "as I said in my last post".
- Carousel format when the content is a list or framework: headline + max 3 lines per slide, built for mobile.`,
  },

  // ---- ads_creative ---------------------------------------------------------
  {
    slugHint: "ad-variant-discipline",
    name: "Ad Variant Discipline",
    description: "Every ad concept ships as testable variants with a single variable changed.",
    tags: "ads,paid,testing",
    targetAgents: "ads_creative",
    content: `Ad creative rules:
- Produce variants, not one-offs: same offer, vary ONE variable at a time (hook, angle, or CTA) so results are attributable.
- Angle rotation across variants: pain-led (the cost of the current mess), outcome-led (the after state, with a number), social-proof-led (who already did this), curiosity-led (open loop the video closes).
- First 2 seconds of any video ad = the hook; assume sound-off viewing; the visual must carry the claim.
- One CTA per creative. CTA verbs: "Book", "Get", "See" — never "Learn more" if a stronger action fits.
- Retargeting sequences differ by what the viewer already saw: pricing-page visitors get objection-handling creative; cold audiences get pain/outcome creative. Never show cold creative to warm audiences.`,
  },

  // ---- youtube_script -------------------------------------------------------
  {
    slugHint: "short-form-video-structure",
    name: "Short-Form Video Structure",
    description: "Hook/body/CTA timing contract for shorts-length scripts.",
    tags: "video,youtube,scripting",
    targetAgents: "youtube_script",
    content: `Short-form script contract:
- Hook: 0-3 seconds, one line, states the payoff or the tension ("This voice agent books appointments while the salon owner sleeps").
- Body: 15-40 seconds, ONE idea only. Cut every sentence that serves a second idea.
- CTA: final 3-5 seconds, single action, spoken + on-screen.
- Write line-by-line with visual directions per line (what's on screen while this line is spoken) — the script IS the shot list.
- No intro ("hey guys, today we're..."), no outro filler. Cold open on the hook, hard stop after the CTA.
- Retention pattern: re-hook every ~8 seconds with a visual change, number, or mini-reveal.`,
  },

  // ---- cross-cutting (multiple agents) --------------------------------------
  {
    slugHint: "proof-first-messaging",
    name: "Proof-First Messaging",
    description: "Claims ranked by evidence; metric-led headlines; honesty as a conversion tactic.",
    tags: "messaging,positioning,honesty",
    targetAgents: "linkedin_post,career_outreach,ads_creative",
    content: `Messaging hierarchy — always prefer the strongest available proof tier:
1. Specific metric you achieved ("cut response time from 4h to 40s")
2. Concrete shipped artifact ("voice agent handling 200 calls/week in production")
3. Credible process insight (what you learned building X)
4. Informed opinion (weakest — use only with a sharp angle)
- Lead headlines/hooks with tier 1-2 whenever one exists. Never dress tier 4 as tier 1 — audiences and hiring managers both smell inflation, and the honesty IS the differentiator.
- Numbers beat adjectives: "3 clients, 6 weeks" outperforms "many happy clients quickly".
- Every claim must be traceable to something real in the operator's history — if it isn't in the source material, don't write it (this reinforces, never overrides, the fabrication rules).`,
  },
  {
    slugHint: "exec-summary-compression",
    name: "Executive Summary Compression",
    description: "Any data dump → one-page summary: key insight first, then evidence, then actions.",
    tags: "analysis,reporting",
    targetAgents: "career_outreach,leadgen_qualify",
    content: `When summarizing research, evaluations, or run results:
- Line 1 = the single most decision-relevant insight, stated as a conclusion, not a topic ("Company X is hiring aggressively for exactly your stack" not "Hiring analysis").
- Then max 3 supporting evidence bullets, each with its source.
- Then recommended actions, ranked by estimated impact, each with a concrete next step.
- Kill hedging language ("it seems", "possibly", "might be worth considering") — state confidence explicitly instead: HIGH/MEDIUM/LOW next to each claim.`,
  },
]
