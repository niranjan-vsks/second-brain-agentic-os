// --- Freelance funnel stages -------------------------------------------------

export const STAGES = [
  { id: "lead", label: "Lead" },
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "handoff", label: "Handoff" },
  { id: "retention", label: "Retention" },
] as const

export type StageId = (typeof STAGES)[number]["id"]

export const BUILD_TYPES = [
  { id: "rag", label: "RAG / Knowledge Base" },
  { id: "voice", label: "Voice Agent" },
  { id: "mcp", label: "MCP Server" },
  { id: "automation", label: "n8n / Make Automation" },
  { id: "custom", label: "Custom Agent (Code)" },
] as const

// --- Stage playbooks: the SOP checklist seeded onto every deal per stage -----

export const STAGE_PLAYBOOKS: Record<StageId, string[]> = {
  lead: [
    "Qualify: does the client have budget + a real recurring pain?",
    "Identify the business metric this automation moves",
    "Send discovery call booking link within 24h",
    "Log source channel and referral path",
  ],
  discovery: [
    "Run discovery call: current workflow, volume, failure cost, tools in use",
    "Map the human process step-by-step before proposing AI",
    "Identify data sources, APIs, and access constraints",
    "Define success metric with a number (e.g. 80% deflection, <2min handling)",
    "Confirm decision maker and timeline",
  ],
  proposal: [
    "Write scope: in-scope, out-of-scope, assumptions, dependencies",
    "Price on value (cost of pain), not hours",
    "Include phased delivery: MVP milestone + iteration cycles",
    "Add acceptance criteria that map to the success metric",
    "Send proposal within 48h of discovery; set follow-up date",
  ],
  build: [
    "Set up repo, environments, and secrets management first",
    "Build evaluation harness BEFORE the agent (golden test set)",
    "Start with the thinnest end-to-end slice, then iterate",
    "Weekly async update to client: shipped / next / blocked",
    "Reuse assets from the library; save new patterns back to it",
  ],
  test: [
    "Run golden test set; record pass rate and failure modes",
    "Adversarial testing: malformed inputs, edge cases, prompt injection",
    "Load/latency check at expected production volume",
    "Client UAT session with real data; capture sign-off in writing",
    "Set up monitoring, logging, and cost alerts",
  ],
  handoff: [
    "Deliver handoff doc: architecture, credentials map, runbooks, limits",
    "Record a walkthrough video (Loom) of the system",
    "Train client team on operation + escalation paths",
    "Agree maintenance/retainer terms in writing",
    "Ask for testimonial + referral while goodwill is peak",
  ],
  retention: [
    "30-day check-in: usage metrics vs promised success metric",
    "Propose next automation from the pain list gathered in discovery",
    "Quarterly system health review (model drift, cost, new capabilities)",
    "Log case study data for outreach material",
  ],
}

// --- Artifact templates -------------------------------------------------------

export const ARTIFACT_TEMPLATES: { id: string; label: string; template: string }[] = [
  {
    id: "discovery-doc",
    label: "Discovery Doc",
    template: `# Discovery Notes — {client}

## Business Context
- What the business does:
- Team size / who touches this workflow:

## Current Workflow (human process, step by step)
1.
2.
3.

## Pain Quantification
- Volume (per day/week):
- Time cost per unit:
- Error/failure cost:
- Who feels the pain most:

## Data & Systems
- Data sources:
- APIs / tools in use:
- Access constraints / compliance:

## Success Metric
- Target number:
- How it will be measured:

## Decision & Timeline
- Decision maker:
- Budget signal:
- Target go-live:`,
  },
  {
    id: "proposal",
    label: "Proposal",
    template: `# Proposal — {title}
**Prepared for:** {client}

## Problem
[One paragraph: the pain, its cost, and why now.]

## Proposed Solution
[What we will build, in the client's language. No jargon.]

## Scope
**In scope:**
-

**Out of scope:**
-

**Assumptions & dependencies:**
-

## Delivery Plan
| Phase | Deliverable | Acceptance Criteria |
|-------|-------------|---------------------|
| 1. MVP | | |
| 2. Iteration | | |
| 3. Production | | |

## Success Metric
[The number we agreed to move, and how it's measured.]

## Investment
- Phase 1:
- Phase 2:
- Ongoing maintenance (optional):

## Terms
- 50% to start, 50% on acceptance
- Validity: 14 days`,
  },
  {
    id: "test-plan",
    label: "Test Plan",
    template: `# Test Plan — {title}

## Golden Test Set
| # | Input | Expected Output | Pass/Fail |
|---|-------|-----------------|-----------|
| 1 | | | |

## Adversarial Cases
- Malformed / empty inputs:
- Out-of-domain queries:
- Prompt injection attempts:
- PII handling:

## Performance
- Expected volume:
- Latency target (p95):
- Cost per interaction target:

## UAT
- Client testers:
- Real-data scenarios:
- Sign-off criteria:`,
  },
  {
    id: "handoff-doc",
    label: "Handoff Doc",
    template: `# Handoff Document — {title}
**Client:** {client}

## System Overview
[Architecture diagram description + one-paragraph summary.]

## Components
| Component | Where it lives | Credentials owner |
|-----------|----------------|-------------------|
| | | |

## Runbooks
### Daily operation
-

### When something breaks
1. Check:
2. If X, do Y:
3. Escalate to:

## Known Limits
-

## Costs
- Monthly estimate:
- Cost drivers:

## Maintenance Terms
- What's covered:
- Response time:
- What triggers new scope:`,
  },
  {
    id: "outreach-message",
    label: "Outreach Message",
    template: `# Outreach — {client}

## Angle
[Specific observation about their business/pain — never generic.]

## Message (v1)
Hi {client},

[1 line: specific observation showing you did homework.]
[1 line: the measurable outcome you deliver, with proof point.]
[1 line: low-friction ask — 15 min call or a loom you'll send.]

## Follow-up cadence
- Day 3: value-add follow-up (share relevant case/insight)
- Day 7: short bump
- Day 14: breakup message`,
  },
]

// --- FDE syllabus seed ---------------------------------------------------------

export const SYLLABUS_TRACKS = [
  { id: "system-design", label: "System Design" },
  { id: "lld", label: "LLD / Coding" },
  { id: "ai-deployment", label: "AI Deployment & Infra" },
  { id: "prod-rag", label: "Production RAG" },
  { id: "finetuning", label: "Finetuning & Evals" },
  { id: "fde-craft", label: "FDE Craft & Behavioral" },
] as const

export type TrackId = (typeof SYLLABUS_TRACKS)[number]["id"]

// priority: 1 = critical for 1-2 month aggressive timeline, 2 = important, 3 = nice-to-have
export const SYLLABUS_SEED: { track: TrackId; title: string; description: string; priority: number }[] = [
  // System Design
  { track: "system-design", title: "Scalable LLM serving architecture", description: "Load balancing, autoscaling GPU inference, batching, KV-cache, vLLM/TGI tradeoffs", priority: 1 },
  { track: "system-design", title: "Design a multi-tenant RAG platform", description: "Tenant isolation, index-per-tenant vs shared index, metadata filtering, cost attribution", priority: 1 },
  { track: "system-design", title: "Agent orchestration at scale", description: "Queues, durable execution, retries, human-in-the-loop checkpoints, state management", priority: 1 },
  { track: "system-design", title: "Streaming pipelines & event-driven design", description: "Kafka/queues, exactly-once semantics, backpressure, CDC for keeping indexes fresh", priority: 2 },
  { track: "system-design", title: "Classic distributed systems fundamentals", description: "CAP, consistency models, sharding, caching layers, rate limiting — rapid review", priority: 2 },
  // LLD
  { track: "lld", title: "API & SDK design for AI services", description: "Streaming APIs, idempotency, pagination, versioning, error contracts", priority: 1 },
  { track: "lld", title: "Design patterns in agent codebases", description: "Strategy/adapter for model-agnostic layers, dependency injection, tool registries", priority: 2 },
  { track: "lld", title: "Concurrency & async patterns", description: "Python asyncio / TS promises, worker pools, cancellation, timeout hierarchies", priority: 2 },
  { track: "lld", title: "Coding drills: medium DSA under time pressure", description: "Keep sharp on arrays, graphs, heaps — FDE loops often include one coding round", priority: 3 },
  // AI Deployment
  { track: "ai-deployment", title: "Model deployment options end-to-end", description: "Managed APIs vs self-hosted, quantization (GGUF/AWQ), serverless GPU, on-prem constraints", priority: 1 },
  { track: "ai-deployment", title: "Observability for LLM systems", description: "Tracing (OTel), token/cost dashboards, drift detection, feedback loops", priority: 1 },
  { track: "ai-deployment", title: "Security & compliance for enterprise AI", description: "PII redaction, prompt injection defense, VPC deployment, SOC2/HIPAA talking points", priority: 1 },
  { track: "ai-deployment", title: "CI/CD for AI systems", description: "Eval gates in pipelines, canary deploys for prompts/models, rollback strategies", priority: 2 },
  // Production RAG
  { track: "prod-rag", title: "Chunking & indexing strategies", description: "Semantic vs structural chunking, hierarchical indexes, late chunking, table/doc handling", priority: 1 },
  { track: "prod-rag", title: "Retrieval quality: hybrid search + reranking", description: "BM25 + dense fusion, rerankers, query rewriting, HyDE, metadata filters", priority: 1 },
  { track: "prod-rag", title: "RAG evaluation", description: "Faithfulness, answer relevance, context precision/recall; RAGAS-style pipelines, golden sets", priority: 1 },
  { track: "prod-rag", title: "Advanced RAG: agentic & graph", description: "Agentic retrieval loops, GraphRAG, multi-hop reasoning, when NOT to use them", priority: 2 },
  // Finetuning
  { track: "finetuning", title: "When to finetune vs prompt vs RAG", description: "Decision framework with cost/latency/quality tradeoffs — a classic FDE interview question", priority: 1 },
  { track: "finetuning", title: "LoRA/QLoRA practical workflow", description: "Data prep, hyperparams that matter, evaluation before/after, serving adapters", priority: 2 },
  { track: "finetuning", title: "Eval design & LLM-as-judge", description: "Building eval sets, judge calibration, pairwise vs rubric scoring, statistical significance", priority: 1 },
  { track: "finetuning", title: "Preference tuning overview", description: "DPO/RLHF at a conversational depth — enough to discuss tradeoffs credibly", priority: 3 },
  // FDE craft
  { track: "fde-craft", title: "Discovery & scoping with enterprise clients", description: "Extracting requirements, managing stakeholders, saying no, defining success metrics", priority: 1 },
  { track: "fde-craft", title: "War stories: prepare 5 STAR narratives", description: "Production incident, ambiguous scope, difficult stakeholder, big win, failure + learning", priority: 1 },
  { track: "fde-craft", title: "Live demo & whiteboard practice", description: "Practice explaining an architecture you built, out loud, in 10 minutes flat", priority: 1 },
  { track: "fde-craft", title: "Company-specific research playbook", description: "For each target company: product, FDE team structure, public case studies, likely stack", priority: 2 },
]

export const DRILL_SEED: { track: TrackId; question: string; difficulty: string }[] = [
  { track: "system-design", question: "Design a multi-tenant RAG platform serving 200 enterprise customers with strict data isolation. Cover indexing, retrieval, cost attribution, and noisy-neighbor mitigation.", difficulty: "hard" },
  { track: "system-design", question: "Design the serving infrastructure for a customer-facing AI agent handling 10k concurrent conversations. Cover model routing, fallbacks, latency budgets, and cost controls.", difficulty: "hard" },
  { track: "system-design", question: "A client's document pipeline must keep a vector index fresh within 5 minutes of source changes across 12 SaaS tools. Design the ingestion architecture.", difficulty: "medium" },
  { track: "prod-rag", question: "Your RAG system has 90% retrieval recall but users report wrong answers. Walk through your debugging methodology step by step.", difficulty: "medium" },
  { track: "prod-rag", question: "Design an evaluation pipeline for a legal-document RAG system where hallucination is unacceptable. What metrics, what gates, what human review?", difficulty: "hard" },
  { track: "ai-deployment", question: "A healthcare client requires fully on-prem deployment with no external API calls. Walk through your model selection, serving stack, and monitoring approach.", difficulty: "hard" },
  { track: "ai-deployment", question: "Production agent costs jumped 4x overnight. Describe your investigation process and the guardrails you'd add.", difficulty: "medium" },
  { track: "finetuning", question: "A client insists on finetuning for their support bot. Their data: 3k tickets. Argue for/against, and describe what you'd actually do.", difficulty: "medium" },
  { track: "lld", question: "Design the class structure for a model-agnostic agent framework: tool registry, provider adapters, retry/timeout policy, streaming. Sketch interfaces.", difficulty: "medium" },
  { track: "fde-craft", question: "In a discovery call, the client says 'we want an AI agent like ChatGPT for everything.' Walk through how you scope this to a shippable first project.", difficulty: "medium" },
]
