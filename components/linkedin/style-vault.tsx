"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  addWritingSample,
  deleteWritingSample,
  addVoicePreference,
  toggleVoicePreference,
  deleteVoicePreference,
} from "@/app/actions/linkedin"
import { Plus, Trash2 } from "lucide-react"
import type { WritingSample, VoicePreference } from "@/lib/types"

export function StyleVault({ samples, preferences }: { samples: WritingSample[]; preferences: VoicePreference[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SamplesPanel samples={samples} />
      <PreferencesPanel preferences={preferences} />
    </div>
  )
}

function SamplesPanel({ samples }: { samples: WritingSample[] }) {
  const [isPending, startTransition] = useTransition()
  const [text, setText] = useState("")
  const [tag, setTag] = useState("")

  function handleAdd() {
    if (!text.trim()) return
    startTransition(async () => {
      await addWritingSample(text.trim(), tag.trim())
      setText("")
      setTag("")
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-mono text-[11px] tracking-widest text-muted-foreground">WRITING SAMPLES</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw style examples the Draft Composer mimics. The 5 most recent are sent with every draft.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <Label htmlFor="sample-text">New sample</Label>
        <Textarea
          id="sample-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a post you wrote that sounds like you..."
          className="min-h-24"
        />
        <div className="flex gap-2">
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag (optional)" aria-label="Sample tag" />
          <Button size="sm" className="gap-1.5" onClick={handleAdd} disabled={isPending || !text.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {samples.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No samples yet. Add 3-5 posts that sound like you.
          </p>
        )}
        {samples.map((s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              {s.tag && (
                <Badge variant="outline" className="mb-1 font-mono text-[10px]">
                  {s.tag}
                </Badge>
              )}
              <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{s.sampleText}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={() => startTransition(() => deleteWritingSample(s.id))}
              aria-label="Delete sample"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

function PreferencesPanel({ preferences }: { preferences: VoicePreference[] }) {
  const [isPending, startTransition] = useTransition()
  const [text, setText] = useState("")

  function handleAdd() {
    if (!text.trim()) return
    startTransition(async () => {
      await addVoicePreference(text.trim(), "manual")
      setText("")
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-mono text-[11px] tracking-widest text-muted-foreground">HOUSE RULES (VOICE PREFERENCES)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Durable rules every future draft and tweak follows. Saved deliberately — never auto-inferred.
        </p>
      </div>
      <div className="flex gap-2 rounded-lg border border-border bg-card p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "Avoid semicolons", "Never open with a question"'
          aria-label="New house rule"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleAdd()
          }}
        />
        <Button size="sm" className="gap-1.5" onClick={handleAdd} disabled={isPending || !text.trim()}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {preferences.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No house rules yet. Save them from review-queue chat or add manually.
          </p>
        )}
        {preferences.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Switch
              checked={p.active}
              onCheckedChange={(checked) => startTransition(() => toggleVoicePreference(p.id, checked))}
              aria-label={`Toggle rule: ${p.preferenceText}`}
            />
            <span className={`min-w-0 flex-1 text-sm ${p.active ? "" : "text-muted-foreground line-through"}`}>
              {p.preferenceText}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {p.source === "chat_feedback" ? "from chat" : "manual"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={() => startTransition(() => deleteVoicePreference(p.id))}
              aria-label="Delete rule"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
