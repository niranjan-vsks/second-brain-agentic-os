"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getChatHistory, askOs, askJarvis } from "@/app/actions/chat"
import { Send, Loader2, Database, Mic, MicOff, Sparkles, Volume2, VolumeX, Radio } from "lucide-react"

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

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

// Pick a Jarvis-ish voice: prefer an English male / British voice, fall back to
// the first English voice, then the browser default.
function pickVoice(): SpeechSynthesisVoice | null {
  if (!hasSpeechSynthesis()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const byName = (needle: string) => voices.find((v) => v.name.toLowerCase().includes(needle))
  return (
    byName("daniel") || // macOS British male
    byName("google uk english male") ||
    voices.find((v) => v.lang === "en-GB") ||
    byName("david") || // Windows male
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0] ||
    null
  )
}

export function OsChat() {
  const { data: history, mutate } = useSWR("os-chat-history", () => getChatHistory())
  const [input, setInput] = useState("")
  const [jarvisMode, setJarvisMode] = useState(true)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(false)
  const [voiceOut, setVoiceOut] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Refs mirror state for use inside async callbacks / recognition handlers.
  const handsFreeRef = useRef(false)
  const voiceOutRef = useRef(false)
  const listeningRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history])

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null)
    setTtsSupported(hasSpeechSynthesis())
    // Voices load async in some browsers; trigger population.
    if (hasSpeechSynthesis()) window.speechSynthesis.getVoices()
  }, [])

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])
  useEffect(() => {
    voiceOutRef.current = voiceOut
  }, [voiceOut])
  useEffect(() => {
    listeningRef.current = listening
  }, [listening])

  const startListening = useCallback(() => {
    if (listeningRef.current) return
    const rec = getSpeechRecognition()
    if (!rec) return
    recognitionRef.current = rec
    rec.lang = "en-IN"
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ""
      if (transcript.trim()) submitRef.current(transcript)
    }
    rec.onend = () => {
      setListening(false)
      // Hands-free: keep the mic alive unless we're mid-request or speaking.
      if (handsFreeRef.current && !speakingRef.current && !pendingRef.current) {
        setTimeout(() => startListening(), 400)
      }
    }
    rec.onerror = () => setListening(false)
    setListening(true)
    rec.start()
  }, [])

  const stopListening = useCallback(() => {
    handsFreeRef.current = false
    setHandsFree(false)
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (!voiceOutRef.current || !hasSpeechSynthesis() || !text.trim()) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text.slice(0, 600)) // cap long answers
    const v = pickVoice()
    if (v) utter.voice = v
    utter.rate = 1.05
    utter.pitch = 1
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => {
      setSpeaking(false)
      // Hands-free: resume listening once Jarvis finishes speaking (avoids the
      // mic capturing the TTS output — the loop only reopens after onend).
      if (handsFreeRef.current) setTimeout(() => startListening(), 300)
    }
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
  }, [startListening])

  // Keep a speaking ref for the recognition onend guard.
  const speakingRef = useRef(false)
  useEffect(() => {
    speakingRef.current = speaking
  }, [speaking])
  const pendingRef = useRef(false)
  useEffect(() => {
    pendingRef.current = isPending
  }, [isPending])

  const submit = useCallback(
    (raw?: string) => {
      const q = (raw ?? input).trim()
      if (!q || isPending) return
      setInput("")
      // Stop the mic while we think — prevents echo capture and double-fires.
      recognitionRef.current?.stop()
      startTransition(async () => {
        const answer = jarvisMode ? await askJarvis(q) : await askOs(q)
        mutate()
        // Voice-out speaks then reopens the mic (via speak's onend) in hands-free.
        // If voice-out is off, reopen the mic directly here in hands-free.
        if (typeof answer === "string" && voiceOutRef.current) {
          speak(answer)
        } else if (handsFreeRef.current) {
          setTimeout(() => startListening(), 300)
        }
      })
    },
    [input, isPending, jarvisMode, mutate, speak, startListening],
  )

  // submitRef lets the recognition callback call the latest submit.
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    startListening()
  }, [listening, startListening])

  const toggleHandsFree = useCallback(() => {
    if (handsFree) {
      stopListening()
    } else {
      setHandsFree(true)
      handsFreeRef.current = true
      startListening()
    }
  }, [handsFree, startListening, stopListening])

  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {jarvisMode ? (
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Database className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-mono text-xs text-muted-foreground">
                {jarvisMode
                  ? "Jarvis — data, calendar, autopays, skills, automations, and browsing via tools."
                  : "Ask OS — read-only SQL over your own data, audited."}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {ttsSupported && (
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="voice-out" className="font-mono text-xs text-muted-foreground">
                    Voice
                  </Label>
                  <Switch id="voice-out" checked={voiceOut} onCheckedChange={setVoiceOut} aria-label="Jarvis speaks replies" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Label htmlFor="jarvis-mode" className="font-mono text-xs text-muted-foreground">
                  Jarvis
                </Label>
                <Switch id="jarvis-mode" checked={jarvisMode} onCheckedChange={setJarvisMode} />
              </div>
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
              placeholder={
                handsFree
                  ? "Hands-free on — just speak…"
                  : jarvisMode
                    ? "Ask Jarvis — data, calendar, autopays…"
                    : "Ask about your pipeline, prep, posts, videos…"
              }
              aria-label="Ask your OS a question"
            />
            {speaking && (
              <Button onClick={stopSpeaking} variant="outline" size="icon" aria-label="Stop speaking">
                <VolumeX className="size-4" aria-hidden="true" />
              </Button>
            )}
            {speechSupported && (
              <>
                <Button
                  onClick={toggleHandsFree}
                  variant={handsFree ? "default" : "outline"}
                  size="icon"
                  aria-label={handsFree ? "Turn off hands-free" : "Hands-free conversation"}
                  title="Hands-free conversation"
                >
                  <Radio className={`size-4 ${handsFree ? "animate-pulse" : ""}`} aria-hidden="true" />
                </Button>
                <Button
                  onClick={toggleVoice}
                  variant={listening && !handsFree ? "destructive" : "outline"}
                  size="icon"
                  aria-label={listening ? "Stop listening" : "Speak once"}
                  disabled={isPending || handsFree}
                >
                  {listening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
                </Button>
              </>
            )}
            <Button onClick={() => submit()} disabled={isPending || !input.trim()} size="icon" aria-label="Send">
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {handsFree
              ? speaking
                ? "Jarvis speaking… mic reopens when it finishes."
                : listening
                  ? "Listening… speak your command (hands-free)."
                  : "Hands-free on — mic cycling."
              : listening
                ? "Listening… speak your command."
                : voiceOut
                  ? "Voice replies on. Mic = speak once · Radio = hands-free conversation. Best in Chrome."
                  : "Mic = speak once · Radio = hands-free. Toggle Voice for spoken replies. Best in Chrome. Also via Telegram."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
