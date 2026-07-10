"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getChatHistory, askOs, askJarvis } from "@/app/actions/chat"
import { Send, Loader2, Database, Mic, MicOff, Sparkles } from "lucide-react"

// Minimal typing for the Web Speech API (not in lib.dom for all TS configs).
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function OsChat() {
  const { data: history, mutate } = useSWR("os-chat-history", () => getChatHistory())
  const [input, setInput] = useState("")
  const [jarvisMode, setJarvisMode] = useState(true)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history])

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null)
  }, [])

  const submit = useCallback(
    (raw?: string) => {
      const q = (raw ?? input).trim()
      if (!q || isPending) return
      setInput("")
      startTransition(async () => {
        if (jarvisMode) await askJarvis(q)
        else await askOs(q)
        mutate()
      })
    },
    [input, isPending, jarvisMode, mutate],
  )

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const rec = getSpeechRecognition()
    if (!rec) return
    recognitionRef.current = rec
    rec.lang = "en-IN"
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ""
      if (transcript.trim()) submit(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }, [listening, submit])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {jarvisMode ? (
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Database className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-mono text-xs text-muted-foreground">
                {jarvisMode
                  ? "Jarvis — data queries, Google Calendar, and autopay management via tools."
                  : "Ask OS — read-only SQL over your own data, audited."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="jarvis-mode" className="font-mono text-xs text-muted-foreground">
                Jarvis
              </Label>
              <Switch id="jarvis-mode" checked={jarvisMode} onCheckedChange={setJarvisMode} />
            </div>
          </div>
          <div className="flex max-h-[28rem] min-h-48 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {(!history || history.length === 0) && (
              <p className="m-auto max-w-md text-center font-mono text-xs leading-relaxed text-muted-foreground">
                {jarvisMode
                  ? 'Try: "What\'s on my calendar this week?" or "Add a call with Rohan tomorrow 3pm" or "Which autopays charge this month?"'
                  : 'Try: "How many videos are pending review?" or "What\'s my total pipeline value?"'}
              </p>
            )}
            {history?.map((m) => (
              <div
                key={m.id}
                className={`flex max-w-[85%] flex-col gap-1 rounded-md p-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-card border border-border"
                }`}
              >
                <span className="whitespace-pre-wrap">{m.content}</span>
                {m.sqlExecuted && (
                  <details>
                    <summary className="cursor-pointer font-mono text-[10px] opacity-70">SQL executed</summary>
                    <code className="mt-1 block whitespace-pre-wrap font-mono text-[10px] opacity-80">{m.sqlExecuted}</code>
                  </details>
                )}
              </div>
            ))}
            {isPending && (
              <div className="flex items-center gap-2 self-start rounded-md border border-border bg-card p-2.5">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  {jarvisMode ? "Jarvis working…" : "Querying…"}
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
              }}
              placeholder={jarvisMode ? "Ask Jarvis — data, calendar, autopays…" : "Ask about your pipeline, prep, posts, videos…"}
              aria-label="Ask your OS a question"
            />
            {speechSupported && (
              <Button
                onClick={toggleVoice}
                variant={listening ? "destructive" : "outline"}
                size="icon"
                aria-label={listening ? "Stop listening" : "Speak to Jarvis"}
                disabled={isPending}
              >
                {listening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
              </Button>
            )}
            <Button onClick={() => submit()} disabled={isPending || !input.trim()} size="icon" aria-label="Send">
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {listening
              ? "Listening… speak your command."
              : "Voice input uses your browser's speech recognition (works best in Chrome). Also available via Telegram — /api/telegram/webhook."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
