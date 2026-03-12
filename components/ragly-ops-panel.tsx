"use client"

import { useState } from "react"
import { XIcon } from "@/components/icons"

interface MemoryNudgeResult {
  nudge: string | null
  message?: string
  memories: Array<{
    text: string
    source?: string
    date?: string
    score: number
  }>
}

interface DebugResult {
  query: string
  collection: string
  results: Array<{
    rank: number
    status: "STRONG" | "WEAK"
    statusLabel: string
    score: number
    content: string
    contentPreview: string
    source?: string
  }>
  suggestion: string
}

interface ComplianceResult {
  status: "PASS" | "FLAG"
  report: string
  policies_checked: Array<{
    text: string
    source?: string
    relevance_score: number
  }>
  flags: string[]
  draft_length: number
}

type ActiveTab = "memory" | "debug" | "compliance"

export function RaglyOpsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("memory")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memory Nudge state
  const [readingSnippet, setReadingSnippet] = useState("")
  const [memoryResult, setMemoryResult] = useState<MemoryNudgeResult | null>(null)

  // Debug Retrieval state
  const [debugQuery, setDebugQuery] = useState("")
  const [debugCollection, setDebugCollection] = useState("dev_docs")
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)

  // Compliance Check state
  const [draftText, setDraftText] = useState("")
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null)

  const handleMemoryNudge = async () => {
    if (!readingSnippet.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ragly/memory-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentReadingSnippet: readingSnippet,
          userId: "demo_user"
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMemoryResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get memory nudge")
    } finally {
      setLoading(false)
    }
  }

  const handleDebugRetrieval = async () => {
    if (!debugQuery.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ragly/debug-retrieval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: debugQuery,
          collection: debugCollection
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDebugResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to debug retrieval")
    } finally {
      setLoading(false)
    }
  }

  const handleComplianceCheck = async () => {
    if (!draftText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ragly/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComplianceResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run compliance check")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div>
            <h2 className="text-lg font-semibold text-foreground">RAGLY Ops</h2>
            <p className="text-xs text-muted-foreground">Vector retrieval, memory nudges, and compliance</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["memory", "debug", "compliance"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary bg-muted/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
            >
              {tab === "memory" ? "Memory Nudge" : tab === "debug" ? "Debug Retrieval" : "Compliance Check"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Memory Nudge Tab */}
          {activeTab === "memory" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Reading Snippet
                </label>
                <textarea
                  value={readingSnippet}
                  onChange={(e) => setReadingSnippet(e.target.value)}
                  placeholder="Paste what you're currently reading..."
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none min-h-24 text-sm"
                />
              </div>
              <button
                onClick={handleMemoryNudge}
                disabled={loading || !readingSnippet.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Searching memories..." : "Surface Memory Connection"}
              </button>

              {memoryResult && (
                <div className="space-y-3 mt-4">
                  {memoryResult.nudge ? (
                    <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                      <p className="text-sm font-medium text-primary mb-1">Memory Nudge</p>
                      <p className="text-foreground">{memoryResult.nudge}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted border border-border rounded-lg">
                      <p className="text-muted-foreground">{memoryResult.message}</p>
                    </div>
                  )}
                  {memoryResult.memories.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Related Memories</p>
                      <div className="space-y-2">
                        {memoryResult.memories.map((m, i) => (
                          <div key={i} className="p-3 bg-muted/50 border border-border rounded-lg text-sm">
                            <p className="text-foreground">{m.text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              {m.source && <span>{m.source}</span>}
                              {m.date && <span>| {m.date}</span>}
                              <span className="ml-auto">Score: {(m.score * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Debug Retrieval Tab */}
          {activeTab === "debug" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Search Query
                </label>
                <input
                  type="text"
                  value={debugQuery}
                  onChange={(e) => setDebugQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Collection
                </label>
                <select
                  value={debugCollection}
                  onChange={(e) => setDebugCollection(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:border-primary text-sm"
                >
                  <option value="dev_docs">dev_docs</option>
                  <option value="company_handbook_2026">company_handbook_2026</option>
                </select>
              </div>
              <button
                onClick={handleDebugRetrieval}
                disabled={loading || !debugQuery.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Debugging..." : "Debug Retrieval"}
              </button>

              {debugResult && (
                <div className="space-y-3 mt-4">
                  <div className="p-3 bg-muted border border-border rounded-lg">
                    <p className="text-xs font-mono text-muted-foreground mb-1">
                      --- RAGLY-Ops Debugger: &apos;{debugResult.query}&apos; ---
                    </p>
                    <p className="text-sm text-foreground">{debugResult.suggestion}</p>
                  </div>
                  <div className="space-y-2">
                    {debugResult.results.map((r) => (
                      <div key={r.rank} className="p-3 bg-muted/50 border border-border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            r.status === "STRONG" 
                              ? "bg-green-500/20 text-green-600" 
                              : "bg-yellow-500/20 text-yellow-600"
                          }`}>
                            {r.statusLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">Score: {r.score}</span>
                        </div>
                        <p className="text-sm text-foreground">{r.contentPreview}</p>
                        {r.source && (
                          <p className="text-xs text-muted-foreground mt-1">{r.source}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compliance Check Tab */}
          {activeTab === "compliance" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Draft Text
                </label>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Paste your draft content for compliance review..."
                  className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none min-h-32 text-sm"
                />
              </div>
              <button
                onClick={handleComplianceCheck}
                disabled={loading || !draftText.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Checking compliance..." : "Run Compliance Check"}
              </button>

              {complianceResult && (
                <div className="space-y-3 mt-4">
                  <div className={`p-4 rounded-lg border ${
                    complianceResult.status === "PASS"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-destructive/10 border-destructive/30"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-bold ${
                        complianceResult.status === "PASS" ? "text-green-600" : "text-destructive"
                      }`}>
                        {complianceResult.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {complianceResult.draft_length} characters checked
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{complianceResult.report}</p>
                  </div>

                  {complianceResult.flags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-destructive mb-2">Flags Raised</p>
                      <ul className="space-y-1">
                        {complianceResult.flags.map((flag, i) => (
                          <li key={i} className="text-sm text-destructive bg-destructive/10 px-3 py-1.5 rounded">
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Policies Checked</p>
                    <div className="space-y-2">
                      {complianceResult.policies_checked.map((p, i) => (
                        <div key={i} className="p-2 bg-muted/50 border border-border rounded text-xs">
                          <p className="text-foreground">{p.text}</p>
                          <p className="text-muted-foreground mt-1">
                            {p.source} | Relevance: {(p.relevance_score * 100).toFixed(1)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
