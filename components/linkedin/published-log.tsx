"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { updateMetrics, deletePost } from "@/app/actions/linkedin"
import { claimStatusLabel } from "@/components/linkedin/claim-status"
import { ChartBar, Trash2 } from "lucide-react"
import type { LinkedinPost } from "@/lib/types"

export function PublishedLog({ posts }: { posts: LinkedinPost[] }) {
  const posted = posts.filter((p) => p.status === "posted")
  const rejected = posts.filter((p) => p.status === "rejected")

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Engagement metrics are manual entry in V1 — no scraping, ever. Empty means not logged.
      </p>
      <div className="flex flex-col gap-2">
        {posted.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing published yet.
          </p>
        )}
        {posted.map((p) => (
          <PostedRow key={p.id} post={p} />
        ))}
      </div>
      {rejected.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Rejected ({rejected.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {rejected.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {claimStatusLabel(p.claimStatus)}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{p.content.slice(0, 120)}</span>
                <DeleteButton postId={p.id} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function PostedRow({ post }: { post: LinkedinPost }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [m, setM] = useState({
    likeCount: post.likeCount?.toString() ?? "",
    commentCount: post.commentCount?.toString() ?? "",
    shareCount: post.shareCount?.toString() ?? "",
    impressionCount: post.impressionCount?.toString() ?? "",
  })

  function handleSave() {
    startTransition(async () => {
      await updateMetrics(post.id, {
        likeCount: Number(m.likeCount) || 0,
        commentCount: Number(m.commentCount) || 0,
        shareCount: Number(m.shareCount) || 0,
        impressionCount: Number(m.impressionCount) || 0,
      })
      setOpen(false)
    })
  }

  const hasMetrics = post.likeCount !== null

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge className="font-mono text-[10px] uppercase">{claimStatusLabel(post.claimStatus)}</Badge>
        {post.postedAt && (
          <span className="font-mono text-[10px] text-muted-foreground">
            posted {new Date(post.postedAt).toLocaleString()}
          </span>
        )}
        {post.linkedinPostId && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {post.linkedinPostId}
          </Badge>
        )}
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex gap-4 font-mono text-xs text-muted-foreground">
          {hasMetrics ? (
            <>
              <span>{post.likeCount} likes</span>
              <span>{post.commentCount} comments</span>
              <span>{post.shareCount} shares</span>
              <span>{post.impressionCount} impressions</span>
            </>
          ) : (
            <span>No metrics logged</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
              <ChartBar className="size-4" aria-hidden="true" />
              Log Metrics
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Metrics Entry</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["likeCount", "Likes"],
                    ["commentCount", "Comments"],
                    ["shareCount", "Shares"],
                    ["impressionCount", "Impressions"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={`${key}-${post.id}`}>{label}</Label>
                    <Input
                      id={`${key}-${post.id}`}
                      type="number"
                      min="0"
                      value={m[key]}
                      onChange={(e) => setM({ ...m, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleSave} disabled={isPending} className="mt-2">
                {isPending ? "Saving..." : "Save Metrics"}
              </Button>
            </DialogContent>
          </Dialog>
          <DeleteButton postId={post.id} />
        </div>
      </footer>
    </article>
  )
}

function DeleteButton({ postId }: { postId: number }) {
  const [isPending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => startTransition(() => deletePost(postId))}
      aria-label="Delete post"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  )
}
