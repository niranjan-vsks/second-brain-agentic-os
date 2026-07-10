"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { diffWords } from "diff"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  saveManualEdit,
  rejectPost,
  approvePost,
  getRevisions,
  getChatMessages,
} from "@/app/actions/linkedin"
import { tweakDraft } from "@/app/actions/linkedin-agents"
import { addVoicePreference } from "@/app/actions/linkedin"
import { claimStatusLabel } from "@/components/linkedin/claim-status"
import { Send, Check, X, CalendarClock, BookmarkPlus, History } from "lucide-react"
import type { LinkedinPost, DraftRevision, PostChatMessage } from "@/lib/types"

export function ReviewQueue({ posts }: { posts: LinkedinPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Review queue is empty. Draft something from the Trend Feed.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Every post is reviewed individually. No bulk approval — read the draft, check the diff, then approve.
      </p>
      {posts.map((post) => (
        <ReviewCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function ReviewCard({ post }: { post: LinkedinPost }) {
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(post.content)
  const [chatInput, setChatInput] = useState("")
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState("")
  const [compareA, setCompareA] = useState<number | null>(null)
  const [compareB, setCompareB] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { data: revisions, mutate: mutateRevs } = useSWR<DraftRevision[]>(`revisions-${post.id}`, () =>
    getRevisions(post.id),
  )
  const { data: chat, mutate: mutateChat } = useSWR<PostChatMessage[]>(`chat-${post.id}`, () =>
    getChatMessages(post.id),
  )

  const dirty = draft !== post.content

  function handleSaveEdit() {
    startTransition(async () => {
      await saveManualEdit(post.id, draft)
      mutateRevs()
    })
  }

  function handleTweak() {
    const instruction = chatInput.trim()
    if (!instruction) return
    setChatInput("")
    setFeedback("Tweak Agent working...")
    startTransition(async () => {
      try {
        const r = await tweakDraft(post.id, instruction)
        setFeedback(r.declined ? `Agent declined: ${r.message}` : null)
        mutateChat()
        mutateRevs()
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Tweak failed")
      }
    })
  }

  function handleApprove(mode: "now" | "schedule") {
    startTransition(async () => {
      const r = await approvePost(post.id, mode, mode === "schedule" ? scheduleAt : undefined)
      if (r && "error" in r && r.error === "missing_credentials") {
        setFeedback("LinkedIn credentials missing — post kept as approved. See notifications.")
      }
      setScheduleOpen(false)
    })
  }

  function saveHouseRule(text: string) {
    startTransition(async () => {
      await addVoicePreference(text, "chat_feedback")
      setFeedback("Saved as house rule — applies to all future drafts and tweaks.")
    })
  }

  const revA = revisions?.find((r) => r.revisionNumber === compareA)
  const revB = revisions?.find((r) => r.revisionNumber === compareB)

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge className="font-mono text-[10px] uppercase">{claimStatusLabel(post.claimStatus)}</Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          rev {revisions?.length ?? 1}
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground">
          drafted {new Date(post.createdAt).toLocaleString()}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: editable draft + revision history/diff */}
        <div className="flex flex-col gap-3">
          <Label htmlFor={`draft-${post.id}`} className="font-mono text-[11px] tracking-widest text-muted-foreground">
            CURRENT DRAFT (EDITABLE)
          </Label>
          <Textarea
            id={`draft-${post.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-48 font-sans text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveEdit} disabled={isPending || !dirty}>
              Save Edit
            </Button>
            {revisions && revisions.length > 1 && (
              <div className="flex items-center gap-1.5">
                <History className="size-4 text-muted-foreground" aria-hidden="true" />
                <Select value={compareA?.toString() ?? ""} onValueChange={(v) => setCompareA(Number(v))}>
                  <SelectTrigger className="h-8 w-24 font-mono text-xs">
                    <SelectValue placeholder="rev A" />
                  </SelectTrigger>
                  <SelectContent>
                    {revisions.map((r) => (
                      <SelectItem key={r.id} value={r.revisionNumber.toString()}>
                        rev {r.revisionNumber} ({r.editedBy})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">vs</span>
                <Select value={compareB?.toString() ?? ""} onValueChange={(v) => setCompareB(Number(v))}>
                  <SelectTrigger className="h-8 w-24 font-mono text-xs">
                    <SelectValue placeholder="rev B" />
                  </SelectTrigger>
                  <SelectContent>
                    {revisions.map((r) => (
                      <SelectItem key={r.id} value={r.revisionNumber.toString()}>
                        rev {r.revisionNumber} ({r.editedBy})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {revA && revB && (
            <div className="rounded-md border border-border bg-background p-3 text-sm leading-relaxed" aria-label="Diff view (read-only)">
              <DiffView a={revA.content} b={revB.content} />
            </div>
          )}
        </div>

        {/* Right: chat tweak panel */}
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">TWEAK CHAT</span>
          <div className="flex max-h-64 min-h-32 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-background p-3">
            {(!chat || chat.length === 0) && (
              <p className="text-xs text-muted-foreground">
                {'Ask for tweaks: "make the hook punchier", "cut 40 words", "swap the CTA"...'}
              </p>
            )}
            {chat?.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <div
                  className={`max-w-[90%] rounded-md px-3 py-2 text-xs leading-relaxed ${
                    m.role === "owner" ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "owner" && (
                  <button
                    type="button"
                    onClick={() => saveHouseRule(m.content)}
                    className="flex items-center gap-1 self-end font-mono text-[10px] text-muted-foreground hover:text-primary"
                    disabled={isPending}
                  >
                    <BookmarkPlus className="size-3" aria-hidden="true" />
                    Save as house rule
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Tweak instruction..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleTweak()
              }}
              aria-label="Tweak instruction"
            />
            <Button size="sm" onClick={handleTweak} disabled={isPending || !chatInput.trim()} aria-label="Send tweak">
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {feedback && <p className="font-mono text-xs text-muted-foreground">{feedback}</p>}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => startTransition(() => rejectPost(post.id))}
          disabled={isPending}
        >
          <X className="size-4" aria-hidden="true" />
          Reject
        </Button>
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setScheduleOpen(true)} disabled={isPending || dirty}>
            <CalendarClock className="size-4" aria-hidden="true" />
            Approve &amp; Schedule
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve &amp; Schedule</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`schedule-${post.id}`}>Publish at</Label>
                <Input
                  id={`schedule-${post.id}`}
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
              <Button onClick={() => handleApprove("schedule")} disabled={isPending || !scheduleAt}>
                {isPending ? "Scheduling..." : "Confirm Schedule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="sm" className="gap-1.5" onClick={() => handleApprove("now")} disabled={isPending || dirty}>
          <Check className="size-4" aria-hidden="true" />
          Approve &amp; Post Now
        </Button>
        {dirty && <span className="w-full text-right font-mono text-[10px] text-muted-foreground">Save your edit before approving</span>}
      </footer>
    </article>
  )
}

function DiffView({ a, b }: { a: string; b: string }) {
  const parts = diffWords(a, b)
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <ins key={i} className="rounded-sm bg-primary/20 text-primary no-underline">
              {part.value}
            </ins>
          )
        }
        if (part.removed) {
          return (
            <del key={i} className="rounded-sm bg-destructive/20 text-destructive">
              {part.value}
            </del>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </p>
  )
}
