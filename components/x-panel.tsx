"use client"

import { useState } from "react"
import {
  TwitterIcon,
  XIcon,
  RefreshIcon,
  HeartIcon,
  RetweetIcon,
  ReplyIcon,
  LoadingIcon,
} from "@/components/icons"

type TabType = "timeline" | "mentions"

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

interface UserData {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

export function XPanel({
  isOpen,
  onClose,
  onDraftReply,
}: {
  isOpen: boolean
  onClose: () => void
  onDraftReply?: (tweetText: string, author: string) => void
}) {
  const [activeTab, setActiveTab] = useState<TabType>("timeline")
  const [error, setError] = useState<string | null>(null)
  const [timelineTweets, setTimelineTweets] = useState<Tweet[]>([])
  const [mentionsTweets, setMentionsTweets] = useState<Tweet[]>([])
  const [users, setUsers] = useState<Record<string, UserData>>({})
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [mentionsLoading, setMentionsLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const fetchTimeline = async () => {
    setTimelineLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/x/timeline")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load timeline")
      if (data.unavailable) {
        setUnavailable(true)
        setTimelineTweets([])
        return
      }
      setUnavailable(false)
      setTimelineTweets(data.data || [])
      if (data.includes?.users) {
        const userMap: Record<string, UserData> = { ...users }
        for (const u of data.includes.users) userMap[u.id] = u
        setUsers(userMap)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline")
    } finally {
      setTimelineLoading(false)
    }
  }

  const fetchMentions = async () => {
    setMentionsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/x/mentions")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load mentions")
      if (data.unavailable) {
        setUnavailable(true)
        setMentionsTweets([])
        return
      }
      setUnavailable(false)
      setMentionsTweets(data.data || [])
      if (data.includes?.users) {
        const userMap: Record<string, UserData> = { ...users }
        for (const u of data.includes.users) userMap[u.id] = u
        setUsers(userMap)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mentions")
    } finally {
      setMentionsLoading(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setError(null)
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
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">
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
        {(["timeline", "mentions"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
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
        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Your Tweets</span>
              <button
                onClick={fetchTimeline}
                disabled={timelineLoading}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Refresh timeline"
              >
                <RefreshIcon />
              </button>
            </div>
            {timelineLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : unavailable ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <p>X integration is currently unavailable.</p>
                <a
                  href="https://x.com/ahayahsharif"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-1 inline-block"
                >
                  Visit @ahayahsharif on X
                </a>
              </div>
            ) : timelineTweets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Click the refresh button above to load your tweets.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {timelineTweets.map((tweet) => (
                  <TweetCard key={tweet.id} tweet={tweet} users={users} formatDate={formatDate} onDraftReply={onDraftReply} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mentions Tab */}
        {activeTab === "mentions" && (
          <div>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">Mentions</span>
              <button
                onClick={fetchMentions}
                disabled={mentionsLoading}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Refresh mentions"
              >
                <RefreshIcon />
              </button>
            </div>
            {mentionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : unavailable ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <p>X integration is currently unavailable.</p>
                <a
                  href="https://x.com/ahayahsharif"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-1 inline-block"
                >
                  Visit @ahayahsharif on X
                </a>
              </div>
            ) : mentionsTweets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Click the refresh button above to load mentions.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mentionsTweets.map((tweet) => (
                  <TweetCard key={tweet.id} tweet={tweet} users={users} formatDate={formatDate} onDraftReply={onDraftReply} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TweetCard({
  tweet,
  users,
  formatDate,
  onDraftReply,
}: {
  tweet: Tweet
  users: Record<string, UserData>
  formatDate: (d?: string) => string
  onDraftReply?: (tweetText: string, author: string) => void
}) {
  const author = tweet.author_id ? users[tweet.author_id] : null
  const authorUsername = author?.username || "unknown"

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
          {author?.name?.charAt(0) || "U"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{author?.name || "User"}</span>
            <span className="text-xs text-muted-foreground truncate">@{authorUsername}</span>
            <span className="text-xs text-muted-foreground">{formatDate(tweet.created_at)}</span>
          </div>
          <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap break-words">{tweet.text}</p>
          <div className="flex items-center gap-4 mt-2">
            {tweet.public_metrics && (
              <>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HeartIcon /> {tweet.public_metrics.like_count}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RetweetIcon /> {tweet.public_metrics.retweet_count}
                </span>
              </>
            )}
            {onDraftReply && (
              <button
                onClick={() => onDraftReply(tweet.text, authorUsername)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Draft AI reply"
              >
                <ReplyIcon /> AI Reply
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
