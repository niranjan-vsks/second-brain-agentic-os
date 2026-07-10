"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STAGES, BUILD_TYPES, type StageId } from "@/lib/constants"
import { createDeal, moveDealStage, deleteDeal, updateDeal } from "@/app/actions/funnel"
import { DealChecklist } from "@/components/freelance/deal-checklist"
import { Plus, ChevronRight, ChevronLeft, Trash2 } from "lucide-react"
import type { Deal } from "@/lib/types"

export function PipelineBoard({ deals }: { deals: Deal[] }) {
  const [isPending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", client: "", buildType: "custom", value: "" })

  function handleCreate() {
    if (!form.name.trim()) return
    startTransition(async () => {
      await createDeal({
        name: form.name.trim(),
        client: form.client.trim(),
        buildType: form.buildType,
        value: Number(form.value) || 0,
        notes: "",
      })
      setForm({ name: "", client: "", buildType: "custom", value: "" })
      setAddOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Lead → Discovery → Proposal → Build → Test → Handoff → Retention
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" aria-hidden="true" />
            New Deal
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Deal</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="deal-name">Deal name</Label>
                <Input
                  id="deal-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Support ticket triage agent"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deal-client">Client</Label>
                <Input
                  id="deal-client"
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Build type</Label>
                  <Select value={form.buildType} onValueChange={(v) => setForm({ ...form, buildType: v ?? "" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILD_TYPES.map((bt) => (
                        <SelectItem key={bt.id} value={bt.id}>
                          {bt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deal-value">Value (USD)</Label>
                  <Input
                    id="deal-value"
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="5000"
                  />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={isPending || !form.name.trim()}>
                {isPending ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.id)
          return (
            <div key={stage.id} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card/50 p-2">
              <div className="flex items-center justify-between px-1 py-1">
                <span className="font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {stage.label}
                </span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {stageDeals.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                {stageDeals.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground/60">Empty</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({ deal }: { deal: Deal }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [nextAction, setNextAction] = useState(deal.nextAction)
  const stageIndex = STAGES.findIndex((s) => s.id === deal.stage)
  const buildLabel = BUILD_TYPES.find((b) => b.id === deal.buildType)?.label ?? deal.buildType

  function move(dir: 1 | -1) {
    const target = STAGES[stageIndex + dir]
    if (!target) return
    startTransition(() => moveDealStage(deal.id, target.id as StageId))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
          />
        }
      >
        <span className="text-sm font-medium leading-tight text-pretty">{deal.name}</span>
        <span className="text-xs text-muted-foreground">{deal.client || "No client"}</span>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-[10px]">
            {buildLabel}
          </Badge>
          {deal.value > 0 && <span className="font-mono text-xs text-primary">${deal.value.toLocaleString()}</span>}
        </div>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{STAGES[stageIndex]?.label}</Badge>
            <Badge variant="outline">{buildLabel}</Badge>
            {deal.value > 0 && <span className="font-mono text-sm text-primary">${deal.value.toLocaleString()}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => move(-1)} disabled={isPending || stageIndex === 0} className="gap-1">
              <ChevronLeft className="size-4" aria-hidden="true" />
              {STAGES[stageIndex - 1]?.label ?? "—"}
            </Button>
            <Button size="sm" onClick={() => move(1)} disabled={isPending || stageIndex === STAGES.length - 1} className="gap-1">
              {STAGES[stageIndex + 1]?.label ?? "—"}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`next-action-${deal.id}`}>Next action</Label>
            <div className="flex gap-2">
              <Input
                id={`next-action-${deal.id}`}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Send follow-up by Friday"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(() => updateDeal(deal.id, { nextAction }))}
              >
                Save
              </Button>
            </div>
          </div>

          <DealChecklist dealId={deal.id} stage={deal.stage} />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 self-start text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteDeal(deal.id)
                setOpen(false)
              })
            }
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete deal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
