# Portfolio Context — for the cold-email outreach agent

Internal reference. Feed this to the agent that writes the "how to use my portfolio" 2-3 liner in each cold email. It has the full map of the site so it can point each hiring manager to the sections that match their role/company. Not for public use.

- **Live site:** https://niranjanvsks.xyz
- **Owner:** Niranjan VSKS — Senior Agentic AI Engineer / Forward Deployed Engineer.
- **One-liner:** an interactive, 3D portfolio where every section is a small piece of engineering. Visitors can explore visually (a 3D globe of sections, a mind-map of the whole body of work) and can ask an in-site AI chatbot about any of it.
- **Résumé (direct):** https://niranjanvsks.xyz/Niranjan_VSKS_FDE_RN.pdf

---

## How to reference it in an email

- Always give the base link (niranjanvsks.xyz) PLUS 2-3 **deep links** to the sections that fit that manager's role. Deep links convert better than "look around."
- Mention it is **interactive** (globe hero, mind map) and that they can **ask the on-site chatbot** ("ask_niranjan") questions instead of reading everything.
- Keep it to 2-3 lines. Tone: confident, low-friction, "here's the fastest path for you."
- The best default 3: one capability/experience page + one flagship project + the chatbot.

---

## Navigation model (how a visitor gets around)

- **Home (`/`)** — a 3D globe with terminal-style cards orbiting it; each card is a section. Click to enter.
- **Top search** — fuzzy search over every section, project, and skill (press `/`).
- **Mind Map (`/map`)** — the whole portfolio as one connected graph (opens with a brain animation, then a clickable node graph). Great "explore everything" entry point.
- **Guide (`/guide`)** — a built-in "how to use this site" page.
- **ask_niranjan chatbot (`/chat`, also on the landing avatar)** — answers questions grounded only in his real project write-ups.

---

## Section / page map (URL — what it is)

| URL | What it is |
|---|---|
| `/` | Home. 3D globe hero, section cards, the AI avatar + chatbot entry. |
| `/projects` | All projects, grouped Independent and Work. |
| `/experience` | Forward-Deployed track record + employer timeline (Coforge, HPE, Mphasis). |
| `/forward-deployed` | Hub of 9 "how I ship into enterprises" capability pages (below). |
| `/system-design` | Reference architectures with interactive, shape-coded node-and-edge diagrams + requirements/tradeoffs. |
| `/map` | Interactive mind-map of the whole system (projects, employers, skills, capabilities). |
| `/dashboard` | Headline metrics at a glance; every number links to its source. |
| `/skills` | The full stack (Generative & Agentic AI, enterprise/customer-facing, ML, engineering). |
| `/about` | The seven-year arc; how he works. |
| `/certifications`, `/education` | Credentials (BITSoM PG in Product Mgmt for GenAI, IIIT-B PG Diploma in ML/AI, B.Tech CSE). |
| `/contact` | Email, phone, LinkedIn, GitHub, résumé, booking. |
| `/chat` | Full-page ask_niranjan chatbot. |
| `/guide` | Usage tips for each section. |

### Forward-Deployed capability pages (`/forward-deployed/<slug>`)
`architecting-ai-solution` · `production-rag-pipeline` · `optimizing-rag-pipeline` · `llm-observability` · `token-optimization` · `cost-optimization` · `finetuning-rlhf-lora` · `guardrails-ai-safety` · `llmops`

---

## Projects catalog (URL — one-liner — what it demonstrates)

1. **Loop Copilot** — `/projects/loop-copilot` — Production AI CRM copilot for enterprise sales (D365/Dynamics), voice-call → structured CRM logging, event-sourced memory. *Sole architect/engineer; Fortune 500 pilot.* → applied AI product, sales-tech/CRM, full-stack AI, FDE.
2. **AI Quality Engineering Platform** — `/projects/qe-platform` — Agentic QE platform: GraphRAG on Neo4j, multi-tenant, deployed across AWS/Azure/GCP; cut manual QA effort ~85-90%. → enterprise/platform AI, RAG, agentic systems, multi-cloud.
3. **WealthOS** — `/projects/wealthos` — Autonomous multi-asset wealth platform: 21-agent analyst council, devil's-advocate stage, code-enforced veto gate, five-ring risk system. → multi-agent systems, agentic AI, autonomy/safety, fintech.
4. **Agentic Codebase Intelligence System** — `/projects/codebase-intelligence-system` — Multi-agent platform that audits large codebases: knowledge-graph engine, hybrid retrieval, MCP tools, auto-files findings to Jira. → agentic AI, dev-tools/code-intelligence, multi-agent orchestration.
5. **Voice-First Financial AI Copilot (Saarthi)** — `/projects/saarthi` — Voice-first, multilingual (10-language) financial copilot for India's gig workforce; SEBI/DPDP compliance as first-class design. → voice/conversational AI, fintech, RAG, compliance.
6. **Enterprise Knowledge Assistant (HPE)** — `/projects/hpe-rag-chatbot` — Migrated an enterprise conversational system from rule-based FAQ to RAG over ~1,700 docs; hybrid search; cut repeat escalations ~40%. → RAG, enterprise knowledge, conversational AI.
7. **National Census Digital Assistant (HPE)** — `/projects/global-census-chatbot` — Civic-scale assistant on Azure: RAG for guidance + deterministic state machines for registrations, guardrails, audited boundaries. → conversational AI, gov/civic, guardrails/compliance.
8. **Financial Risk & Fraud Intelligence (Mphasis)** — `/projects/mphasis-ml-risk` — Fraud-detection and risk-scoring models (XGBoost/LightGBM/RF), engineered feature pipelines; ~15% precision lift. → classical ML/data science, fintech, fraud/risk.

---

## Audience → sections routing (the customization key)

Pick the row that matches the hiring manager's role/JD; recommend those 2-3 links.

| If they hire for… | Point them to |
|---|---|
| **Forward Deployed Engineer** | `/forward-deployed` · `/projects/loop-copilot` · `/experience` |
| **Agentic AI / multi-agent** | `/projects/wealthos` · `/projects/codebase-intelligence-system` · `/system-design` |
| **RAG / LLM engineer** | `/forward-deployed/production-rag-pipeline` · `/projects/qe-platform` · `/projects/hpe-rag-chatbot` |
| **Applied AI product** | `/projects/loop-copilot` · `/projects/saarthi` · `/dashboard` |
| **Platform / infra / LLMOps** | `/forward-deployed/llmops` · `/forward-deployed/llm-observability` · `/projects/qe-platform` |
| **Fintech AI** | `/projects/wealthos` · `/projects/saarthi` · `/projects/mphasis-ml-risk` |
| **Conversational / voice AI** | `/projects/saarthi` · `/projects/hpe-rag-chatbot` · `/projects/global-census-chatbot` |
| **ML / Data Science** | `/projects/mphasis-ml-risk` · `/experience` · `/skills` |
| **Generalist / unsure** | `/` (globe) · `/map` (mind map) · `/chat` (ask the bot) |

---

## Ready-made 2-3 liner templates (agent can adapt)

- **FDE role:** "The site is interactive — start on the Forward Deployed section (niranjanvsks.xyz/forward-deployed) for how I ship into enterprises, then Loop Copilot (/projects/loop-copilot) for a production build I owned end to end. There's an on-site chatbot if you'd rather just ask it anything."
- **Agentic AI role:** "Worth 3 minutes: WealthOS (niranjanvsks.xyz/projects/wealthos) — a 21-agent decision system with a code-enforced veto gate — and the Codebase Intelligence project (/projects/codebase-intelligence-system). The Mind Map (/map) shows how it all connects."
- **RAG/LLM role:** "The Production RAG Pipeline page (niranjanvsks.xyz/forward-deployed/production-rag-pipeline) and the QE Platform project (/projects/qe-platform) cover the GraphRAG + multi-tenant work directly. You can also ask the site's chatbot for specifics."
- **Generalist:** "It's an interactive 3D portfolio — the Mind Map (niranjanvsks.xyz/map) is the fastest way to see everything, and you can ask the on-site chatbot anything about my work."

---

## Guardrails for the agent (copy tone)
- Deep-link, don't just say "browse."
- Never over-claim; the numbers above are the ones on the site, don't inflate them.
- Always offer the chatbot as the low-effort path.
- Keep the guide to 2-3 lines; the email's job is to earn one click.
