"use client"

import useSWR from "swr"
import { useTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { getDealChecklist, toggleChecklistItem } from "@/app/actions/funnel"
import type { ChecklistItem } from "@/lib/types"

export function DealChecklist({ dealId, stage }: { dealId: number; stage: string }) {
  const { data: items, mutate } = useSWR<ChecklistItem[]>(`checklist-${dealId}`, () => getDealChecklist(dealId))
  const [, startTransition] = useTransition()

  const grouped = new Map<string, ChecklistItem[]>()
  for (const item of items ?? []) {
    const list = grouped.get(item.stage) ?? []
    list.push(item)
    grouped.set(item.stage, list)
  }

  function toggle(item: ChecklistItem) {
    const next = (items ?? []).map((i) => (i.id === item.id ? { ...i, done: !item.done } : i))
    mutate(next, { revalidate: false })
    startTransition(async () => {
      await toggleChecklistItem(item.id, !item.done)
      mutate()
    })
  }

  if (!items) return <p className="text-xs text-muted-foreground">Loading playbook...</p>

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Stage Playbook</h3>
      {[...grouped.entries()].map(([stageName, stageItems]) => {
        const doneCount = stageItems.filter((i) => i.done).length
        const isCurrent = stageName === stage
        return (
          <div key={stageName} className={`rounded-md border p-3 ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold capitalize">{stageName}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {doneCount}/{stageItems.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {stageItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`chk-${item.id}`}
                    checked={item.done}
                    onCheckedChange={() => toggle(item)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`chk-${item.id}`}
                    className={`text-xs leading-relaxed ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {item.item}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
