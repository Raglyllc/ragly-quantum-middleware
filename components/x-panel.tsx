"use client"

import { useState, useEffect } from "react"
import { TwitterIcon, RefreshIcon, SendIcon, HeartIcon, RetweetIcon, XIcon } from "@/components/icons"

interface Tweet {
  id: string
  text: string
  created_at?: string
  public_metrics?: {
    like_count: number
    retweet_count: number
    reply_count: number
  }
  author_id?: string
}

interface TweetUser {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

type TabType = "timeline" | "mentions" | "compose"

export function XPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("timeline")
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [mentions, setMentions] = useState<Tweet[]>([])
  const [users, setUsers] = useState<Record<string, TweetUser>>({})
  const [composeText, setComposeText] = useState("")
  const [isLoadingTweets, setIsLoadingTweets] = useState(false)
  const [isLoadingMentions, setIsLoadingMentions] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && tweets.length === 0) {
      fetchTimeline()
    }
  }, [isOpen])

  const fetchTimeline = async () => {
    setIsLoadingTweets(true)
    setError(null)
    try {
      const res = await fetch("/api/x/timeline?max_results=10")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTweets(data.data || [])
      if (data.includes?.users) {
        const userMap: Record<string, TweetUser> = {}
        for (const user of data.includes.users) {
          userMap[user.id] = user
        }
        setUsers((prev) => ({ ...prev, ...userMap }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline")
    } finally {
      setIsLoadingTweets(false)
    }
  }

  const fetchMentions = async () => {
    setIsLoadingMentions(true)
    setError(null)
    try {
      const res = await fetch("/api/x/mentions?max_results=10")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMentions(data.data || [])
      if (data.includes?.users) {
        const userMap: Record<string, TweetUser> = {}
        for (const user of data.includes.users) {
          userMap[user.id] = user
        }
        setUsers((prev) => ({ ...prev, ...userMap }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mentions")
    } finally {
      setIsLoadingMentions(false)
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
    if (tab === "mentions" && mentions.length === 0) {
      fetchMentions()
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d`
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
        {(["timeline", "mentions", "compose"] as TabType[]).map((tab) => (
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

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-muted-foreground">Your Tweets</span>
              <button
                onClick={fetchTimeline}
                disabled={isLoadingTweets}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Refresh timeline"
              >
                <RefreshIcon />
              </button>
            </div>
            {isLoadingTweets ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tweets.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">No tweets found</p>
            ) : (
              tweets.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} user={users[tweet.author_id || ""]} formatDate={formatDate} />
              ))
            )}
          </div>
        )}

        {/* Mentions Tab */}
        {activeTab === "mentions" && (
          <div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-muted-foreground">Mentions</span>
              <button
                onClick={fetchMentions}
                disabled={isLoadingMentions}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Refresh mentions"
              >
                <RefreshIcon />
              </button>
            </div>
            {isLoadingMentions ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : mentions.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">No mentions found</p>
            ) : (
              mentions.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} user={users[tweet.author_id || ""]} formatDate={formatDate} />
              ))
            )}
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
      </div>
    </div>
  )
}

function TweetCard({
  tweet,
  user,
  formatDate,
}: {
  tweet: Tweet
  user?: TweetUser
  formatDate: (d?: string) => string
}) {
  return (
    <div className="px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground font-bold">
          {user?.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">{user?.name || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">@{user?.username || "unknown"}</span>
            <span className="text-xs text-muted-foreground">{formatDate(tweet.created_at)}</span>
          </div>
          <p className="text-sm text-card-foreground leading-relaxed break-words">{tweet.text}</p>
          {tweet.public_metrics && (
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <HeartIcon />
                {tweet.public_metrics.like_count}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <RetweetIcon />
                {tweet.public_metrics.retweet_count}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
