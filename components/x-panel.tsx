"use client"

import { useState } from "react"
import { TwitterIcon, SendIcon, XIcon } from "@/components/icons"

type TabType = "compose" | "timeline" | "mentions"

export function XPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("compose")
  const [composeText, setComposeText] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [timelineStatus, setTimelineStatus] = useState<"idle" | "loading" | "free_tier" | "error">("idle")
  const [mentionsStatus, setMentionsStatus] = useState<"idle" | "loading" | "free_tier" | "error">("idle")

  const checkTimeline = async () => {
    setTimelineStatus("loading")
    setError(null)
    try {
      const res = await fetch("/api/x/timeline")
      const data = await res.json()
      if (data.error === "free_tier") {
        setTimelineStatus("free_tier")
      } else if (!res.ok) {
        throw new Error(data.error)
      }
    } catch {
      setTimelineStatus("error")
    }
  }

  const checkMentions = async () => {
    setMentionsStatus("loading")
    setError(null)
    try {
      const res = await fetch("/api/x/mentions")
      const data = await res.json()
      if (data.error === "free_tier") {
        setMentionsStatus("free_tier")
      } else if (!res.ok) {
        throw new Error(data.error)
      }
    } catch {
      setMentionsStatus("error")
    }
  }

  const handlePost = async () => {
    if (!composeText.trim() || isPosting) return
    setIsPosting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/x/tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: composeText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess("Tweet posted successfully!")
      setComposeText("")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post tweet")
    } finally {
      setIsPosting(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setError(null)
    if (tab === "timeline" && timelineStatus === "idle") checkTimeline()
    if (tab === "mentions" && mentionsStatus === "idle") checkMentions()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TwitterIcon />
          <span className="font-semibold text-foreground">@ahayahsharif</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close X panel"
        >
          <XIcon />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["compose", "timeline", "mentions"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="m-3 p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm text-primary">
            {success}
          </div>
        )}

        {/* Compose Tab */}
        {activeTab === "compose" && (
          <div className="p-4">
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <TwitterIcon />
                </div>
                <span className="text-sm font-medium text-foreground">@ahayahsharif</span>
              </div>
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="What's happening?"
                className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none min-h-32 text-sm"
                maxLength={280}
                disabled={isPosting}
              />
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${composeText.length > 260 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {composeText.length}/280
                </span>
                <button
                  onClick={handlePost}
                  disabled={!composeText.trim() || isPosting || composeText.length > 280}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPosting ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <SendIcon />
                  )}
                  Post
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <FreeTierNotice
            status={timelineStatus}
            label="Timeline"
            onRetry={checkTimeline}
          />
        )}

        {/* Mentions Tab */}
        {activeTab === "mentions" && (
          <FreeTierNotice
            status={mentionsStatus}
            label="Mentions"
            onRetry={checkMentions}
          />
        )}
      </div>
    </div>
  )
}

function FreeTierNotice({
  status,
  label,
  onRetry,
}: {
  status: "idle" | "loading" | "free_tier" | "error"
  label: string
  onRetry: () => void
}) {
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === "free_tier") {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <TwitterIcon />
        </div>
        <h3 className="text-foreground font-semibold mb-2">{label} Unavailable</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Reading {label.toLowerCase()} requires the X API Basic plan ($100/mo) or higher. Your current Free tier supports posting tweets - use the Compose tab to post!
        </p>
        <a
          href="https://developer.x.com/en/portal/products"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Upgrade API Access
        </a>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive mb-3">Failed to load {label.toLowerCase()}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground hover:border-primary transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}
