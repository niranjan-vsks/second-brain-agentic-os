"use client"

import { useState } from "react"
import { RESEARCH_AGENT_PRD } from "@/lib/prd"
import { Button } from "@/components/ui/button"
import { Copy, Check, Download } from "lucide-react"

export function PrdView() {
  const [copied, setCopied] = useState(false)

  async function copyPrd() {
    await navigator.clipboard.writeText(RESEARCH_AGENT_PRD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadPrd() {
    const blob = new Blob([RESEARCH_AGENT_PRD], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "research-agent-prd.md"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Research Agent PRD (for Claude Code)</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Molecular-detail spec for the focused research agent that harvests the web, organizes findings into
            Markdown/PDF, and syncs to NotebookLM. Copy it and paste it into Claude Code as the build brief. Your own
            scraping repos plug in at the Harvester layer (Section 4.2).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={downloadPrd} className="gap-1.5 bg-transparent">
            <Download className="size-4" aria-hidden="true" />
            Download .md
          </Button>
          <Button size="sm" onClick={copyPrd} className="gap-1.5">
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy PRD"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed text-foreground">
          {RESEARCH_AGENT_PRD}
        </pre>
      </div>
    </div>
  )
}
