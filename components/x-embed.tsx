"use client"

import { useState, useEffect, useCallback } from "react"
import {
  TwitterIcon,
  RefreshIcon,
  HeartIcon,
  RetweetIcon,
  ReplyIcon,
} from "@/components/icons"
import { getCachedResponse, setCachedResponse } from "@/lib/api-cache"

const TIMELINE_CACHE_KEY = "x-timeline"
const TIMELINE_CLIENT_TTL = 3 * 60 * 1000 // 3 minutes client-side cache

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

export function XEmbed({
  onDraftReply,
}: {
  onDraftReply?: (tweetText: string, author: string) => void
}) {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [users, setUsers] = useState<Record<string, UserData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchTimeline = useCallback(async (bypassCache = false) => {
    // Check client-side cache first
    if (!bypassCache) {
      const cached = getCachedResponse<{ tweets: Tweet[]; users: Record<string, UserData> }>(TIMELINE_CACHE_KEY)
      if (cached) {
        setTweets(cached.tweets)
        setUsers(cached.users)
        setLastFetched(new Date())
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/x/timeline")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load timeline")
      const fetchedTweets = data.data || []
      setTweets(fetchedTweets)
      const userMap: Record<string, UserData> = {}
      if (data.includes?.users) {
        for (const u of data.includes.users) userMap[u.id] = u
      }
      setUsers(userMap)
      setLastFetched(new Date())

      // Save to client-side cache
      setCachedResponse(TIMELINE_CACHE_KEY, { tweets: fetchedTweets, users: userMap }, TIMELINE_CLIENT_TTL)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline")
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch once on mount
  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "now"
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const formatLastFetched = () => {
    if (!lastFetched) return ""
    return lastFetched.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      {/* Profile Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/30 via-secondary/20 to-primary/10" />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-8">
            <div className="w-16 h-16 rounded-full border-4 border-card bg-muted flex items-center justify-center">
              <TwitterIcon />
            </div>
            <div className="flex items-center gap-2 mt-2">
              {lastFetched && (
                <span className="text-xs text-muted-foreground">
                  Updated {formatLastFetched()}
                </span>
              )}
              <button
                onClick={() => fetchTimeline(true)}
                disabled={loading}
                className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Refresh timeline"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>

          <div className="mt-2">
            <h3 className="text-lg font-bold text-foreground">ahayahsharif</h3>
            <p className="text-sm text-muted-foreground">@ahayahsharif</p>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live Feed
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Tweet Feed */}
      <div className="max-h-96 overflow-y-auto">
        {error && (
          <div className="m-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && tweets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading tweets...</span>
          </div>
        ) : tweets.length === 0 && !error ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No tweets to display.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tweets.map((tweet) => {
              const author = tweet.author_id ? users[tweet.author_id] : null
              const authorUsername = author?.username || "ahayahsharif"

              return (
                <div key={tweet.id} className="p-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {author?.name?.charAt(0) || "A"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {author?.name || "ahayahsharif"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          @{authorUsername}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(tweet.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap break-words">
                        {tweet.text}
                      </p>
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
            })}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="border-t border-border p-3 flex items-center justify-center">
        <a
          href="https://x.com/ahayahsharif"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <TwitterIcon /> View full profile on X
        </a>
      </div>
    </div>
  )
}
