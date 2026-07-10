"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { reschedulePost, bulkSchedule, processDuePosts } from "@/app/actions/linkedin"
import { claimStatusLabel } from "@/components/linkedin/claim-status"
import { ChevronLeft, ChevronRight, CalendarRange, Zap } from "lucide-react"
import type { LinkedinPost } from "@/lib/types"

// Displays ONLY approved and scheduled posts. pending_review never appears here.
export function PostCalendar({ posts }: { posts: LinkedinPost[] }) {
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState<number[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkStart, setBulkStart] = useState("")
  const [bulkGap, setBulkGap] = useState("3")
  const [feedback, setFeedback] = useState<string | null>(null)

  const unscheduled = posts.filter((p) => p.status === "approved" && !p.scheduledFor)
  const scheduled = posts.filter((p) => p.scheduledFor)

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay()

  function postsOnDay(day: number) {
    return scheduled.filter((p) => {
      const d = new Date(p.scheduledFor!)
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth() && d.getDate() === day
    })
  }

  function toggleSelect(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function handleBulkSchedule() {
    startTransition(async () => {
      try {
        await bulkSchedule(selected, bulkStart, Number(bulkGap))
        setSelected([])
        setBulkOpen(false)
        setFeedback(null)
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Bulk schedule failed")
      }
    })
  }

  function handleProcessDue() {
    startTransition(async () => {
      const r = await processDuePosts()
      setFeedback(r.processed > 0 ? `Published ${r.processed} due post(s).` : "No posts due yet.")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Only approved posts appear here. Bulk actions are scheduling conveniences — never approvals.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleProcessDue} disabled={isPending}>
          <Zap className="size-4" aria-hidden="true" />
          Publish Due Posts
        </Button>
      </div>
      {feedback && <p className="font-mono text-xs text-muted-foreground">{feedback}</p>}

      {/* Unscheduled approved posts: multi-select + bulk spread */}
      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
              APPROVED, AWAITING SLOT ({unscheduled.length})
            </span>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={selected.length === 0}
                onClick={() => setBulkOpen(true)}
              >
                <CalendarRange className="size-4" aria-hidden="true" />
                Bulk Schedule ({selected.length})
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Spread {selected.length} approved posts</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bulk-start">Start date</Label>
                    <Input id="bulk-start" type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bulk-gap">Days between posts</Label>
                    <Input id="bulk-gap" type="number" min="1" value={bulkGap} onChange={(e) => setBulkGap(e.target.value)} />
                  </div>
                  <Button onClick={handleBulkSchedule} disabled={isPending || !bulkStart}>
                    {isPending ? "Scheduling..." : "Assign Slots (9:00 AM each)"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {unscheduled.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={() => toggleSelect(p.id)}
                aria-label={`Select post ${p.id} for bulk scheduling`}
              />
              <Badge className="font-mono text-[10px] uppercase">{claimStatusLabel(p.claimStatus)}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{p.content.slice(0, 100)}</span>
              <SlotPicker postId={p.id} />
            </div>
          ))}
        </div>
      )}

      {/* Month grid */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="font-mono text-sm font-semibold">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-1 text-center font-mono text-[10px] text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayPosts = postsOnDay(day)
            return (
              <div key={day} className="flex min-h-16 flex-col gap-1 rounded-md border border-border/50 p-1">
                <span className="font-mono text-[10px] text-muted-foreground">{day}</span>
                {dayPosts.map((p) => (
                  <ScheduledChip key={p.id} post={p} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SlotPicker({ postId }: { postId: number }) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState("")
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-48 text-xs"
        aria-label="Schedule slot"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={isPending || !value}
        onClick={() => startTransition(() => reschedulePost(postId, value))}
      >
        Set
      </Button>
    </div>
  )
}

function ScheduledChip({ post }: { post: LinkedinPost }) {
  const [isPending, startTransition] = useTransition()
  const time = new Date(post.scheduledFor!).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return (
    <div className="group flex flex-col gap-0.5 rounded-sm bg-primary/15 p-1">
      <span className="line-clamp-2 text-[10px] leading-tight text-foreground">{post.content.slice(0, 60)}</span>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-primary">{time}</span>
        <button
          type="button"
          onClick={() => startTransition(() => reschedulePost(post.id, null))}
          className="font-mono text-[9px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          disabled={isPending}
        >
          unschedule
        </button>
      </div>
    </div>
  )
}
