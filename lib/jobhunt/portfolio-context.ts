// Portfolio map fed to the Emissary (Node 4) so its cold-email "how to use my
// portfolio" 2-3 liner deep-links to the sections matching the target role.
// Distilled from new_agents/fde_portfolio_context.md. Internal reference.

export const PORTFOLIO_SITE = "https://niranjanvsks.xyz"
export const PORTFOLIO_RESUME = "https://niranjanvsks.xyz/Niranjan_VSKS_FDE_RN.pdf"

export const PORTFOLIO_CONTEXT = `PORTFOLIO (Niranjan VSKS — Senior Agentic AI Engineer / Forward Deployed Engineer)
Live interactive 3D site: ${PORTFOLIO_SITE} (globe hero, mind-map at /map, on-site "ask_niranjan" chatbot at /chat). Résumé: ${PORTFOLIO_RESUME}.

AUDIENCE -> DEEP LINKS (recommend 2-3 that match the target role/JD):
- Forward Deployed Engineer: /forward-deployed · /projects/loop-copilot · /experience
- Agentic AI / multi-agent: /projects/wealthos · /projects/codebase-intelligence-system · /system-design
- RAG / LLM engineer: /forward-deployed/production-rag-pipeline · /projects/qe-platform · /projects/hpe-rag-chatbot
- Applied AI product: /projects/loop-copilot · /projects/saarthi · /dashboard
- Platform / LLMOps: /forward-deployed/llmops · /forward-deployed/llm-observability · /projects/qe-platform
- Fintech AI: /projects/wealthos · /projects/saarthi · /projects/mphasis-ml-risk
- Conversational / voice AI: /projects/saarthi · /projects/hpe-rag-chatbot · /projects/global-census-chatbot
- Generalist / unsure: / (globe) · /map (mind map) · /chat (ask the bot)

FLAGSHIP PROJECTS (one-liners):
- Loop Copilot (/projects/loop-copilot): production AI CRM copilot for enterprise sales (D365), voice->CRM, event-sourced memory. Fortune 500 pilot, sole architect.
- AI QE Platform (/projects/qe-platform): agentic QE, GraphRAG on Neo4j, multi-cloud, cut manual QA ~85-90%.
- WealthOS (/projects/wealthos): 21-agent analyst council, code-enforced veto gate, five-ring risk.
- Agentic Codebase Intelligence (/projects/codebase-intelligence-system): multi-agent codebase audit, knowledge graph, MCP, auto-files to Jira.
- Saarthi (/projects/saarthi): voice-first 10-language financial copilot, SEBI/DPDP compliant.

COPY GUARDRAILS: deep-link, never just "browse". Keep the portfolio mention to 2-3 lines — its job is to earn one click. Never inflate the numbers above. Always offer the on-site chatbot as the low-effort path. When unsure which projects fit, mention the Coforge/agentic use-cases FIRST in the list (they are strong across the board), without saying "only" these.`
