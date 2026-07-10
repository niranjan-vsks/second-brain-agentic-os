"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createLead, updateLead, deleteLead } from "@/app/actions/funnel"
import { Plus, Trash2, Clock } from "lucide-react"
import type { Lead } from "@/lib/types"

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Cold Email" },
  { id: "referral", label: "Referral" },
  { id: "upwork", label: "Upwork" },
  { id: "twitter", label: "X / Twitter" },
  { id: "inbound", label: "Inbound" },
]

const LEAD_STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "call-booked", label: "Call Booked" },
  { id: "converted", label: "Converted to Deal" },
  { id: "dead", label: "Dead" },
]

export function OutreachTracker({ leads }: { leads: Lead[] }) {
  const [isPending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", company: "", channel: "linkedin", notes: "" })

  function handleCreate() {
    if (!form.name.trim()) return
    startTransition(async () => {
      await createLead({ name: form.name.trim(), company: form.company.trim(), channel: form.channel, notes: form.notes })
      setForm({ name: "", company: "", channel: "linkedin", notes: "" })
      setAddOpen(false)
    })
  }

  const active = leads.filter((l) => !["converted", "dead"].includes(l.status))
  const closed = leads.filter((l) => ["converted", "dead"].includes(l.status))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Cadence: Day 0 outreach → Day 3 value-add → Day 7 bump → Day 14 breakup
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" aria-hidden="true" />
            New Lead
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Lead</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lead-name">Name</Label>
                  <Input id="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input id="lead-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lead-notes">Notes / angle</Label>
                <Textarea
                  id="lead-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Specific pain observed, referral context..."
                />
              </div>
              <Button onClick={handleCreate} disabled={isPending || !form.name.trim()}>
                {isPending ? "Adding..." : "Add Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2">
        {active.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No active leads. Top of funnel is the bottleneck — add leads and work the cadence.
          </p>
        )}
        {active.map((lead) => (
          <LeadRow key={lead.id} lead={lead} />
        ))}
      </div>

      {closed.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Closed ({closed.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {closed.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function LeadRow({ lead }: { lead: Lead }) {
  const [isPending, startTransition] = useTransition()
  const overdue = lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date()
  const channelLabel = CHANNELS.find((c) => c.id === lead.channel)?.label ?? lead.channel

  function setStatus(status: string) {
    startTransition(() => updateLead(lead.id, { status, lastTouch: new Date() }))
  }

  function setFollowUp(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    startTransition(() => updateLead(lead.id, { nextFollowUp: d, lastTouch: new Date() }))
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{lead.name}</span>
          {lead.company && <span className="text-xs text-muted-foreground">{lead.company}</span>}
          <Badge variant="outline" className="font-mono text-[10px]">
            {channelLabel}
          </Badge>
          {overdue && (
            <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
              <Clock className="size-3" aria-hidden="true" />
              OVERDUE
            </Badge>
          )}
        </div>
        {lead.notes && <p className="mt-1 truncate text-xs text-muted-foreground">{lead.notes}</p>}
        {lead.nextFollowUp && (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            Follow up: {new Date(lead.nextFollowUp).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Select value={lead.status} onValueChange={(v) => setStatus(v ?? "")} disabled={isPending}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {[3, 7, 14].map((d) => (
            <Button key={d} variant="outline" size="sm" className="h-8 px-2 font-mono text-[10px]" disabled={isPending} onClick={() => setFollowUp(d)}>
              +{d}d
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => startTransition(() => deleteLead(lead.id))}
          aria-label={`Delete lead ${lead.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
