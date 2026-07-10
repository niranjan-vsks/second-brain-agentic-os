"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CompanyResearchNote } from "@/lib/types"
import { deepResearch } from "@/app/actions/career-agents"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Search } from "lucide-react"

export function ResearchPanel({ research }: { research: CompanyResearchNote[] }) {
  const router = useRouter()
  const [company, setCompany] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!company.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await deepResearch(company.trim())
      if (!res.ok) setError(res.error ?? "Research failed")
      setCompany("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          placeholder="Company name (e.g. Anthropic)"
          className="max-w-64"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) run()
          }}
        />
        <Button size="sm" onClick={run} disabled={busy || !company.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Deep Research
        </Button>
        <p className="text-xs text-muted-foreground">
          Auto-executes when a search provider is configured; otherwise generates a paste-into-Perplexity research
          prompt.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {research.length === 0 && <p className="text-sm text-muted-foreground py-4">No research notes yet.</p>}

      <div className="flex flex-col gap-3">
        {research.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{r.company}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground leading-relaxed max-h-96 overflow-y-auto">
                {r.researchNotes}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
