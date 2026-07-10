export const CLAIM_STATUSES = [
  { id: "shipped", label: "Shipped — live in production" },
  { id: "piloting", label: "Piloting — running with real users, not GA" },
  { id: "building", label: "Building — in active development" },
  { id: "concept", label: "Concept — idea / design stage" },
  { id: "insight", label: "Insight — lesson or observation" },
  { id: "commentary", label: "Commentary — reacting to news/trends" },
] as const

export function claimStatusLabel(id: string) {
  return CLAIM_STATUSES.find((c) => c.id === id)?.label.split(" — ")[0] ?? id
}
