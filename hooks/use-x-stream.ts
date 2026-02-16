"use client"

import { useState, useCallback, useRef } from "react"

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

interface CachedData {
  tweets: Tweet[]
  users: Record<string, UserData>
  timestamp: number
}

interface StreamState {
  tweets: Tweet[]
  users: Record<string, UserData>
  loading: boolean
  status: string
  error: string | null
  lastFetched: Date | null
  fromCache: boolean
}

const CLIENT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCacheKey(endpoint: string) {
  return `x-stream-cache:${endpoint}`
}

function readCache(endpoint: string): CachedData | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(endpoint))
    if (!raw) return null
    const cached: CachedData = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CLIENT_CACHE_TTL) {
      sessionStorage.removeItem(getCacheKey(endpoint))
      return null
    }
    return cached
  } catch {
    return null
  }
}

function writeCache(endpoint: string, tweets: Tweet[], users: Record<string, UserData>) {
  try {
    const data: CachedData = { tweets, users, timestamp: Date.now() }
    sessionStorage.setItem(getCacheKey(endpoint), JSON.stringify(data))
  } catch {
    // sessionStorage full or unavailable
  }
}

export function useXStream(endpoint: string) {
  const [state, setState] = useState<StreamState>(() => {
    // Initialize from local cache if available
    const cached = readCache(endpoint)
    if (cached) {
      return {
        tweets: cached.tweets,
        users: cached.users,
        loading: false,
        status: "",
        error: null,
        lastFetched: new Date(cached.timestamp),
        fromCache: true,
      }
    }
    return {
      tweets: [],
      users: {},
      loading: false,
      status: "",
      error: null,
      lastFetched: null,
      fromCache: false,
    }
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async (force = false) => {
    // If we have fresh cached data and not forcing, skip the fetch
    if (!force) {
      const cached = readCache(endpoint)
      if (cached && state.tweets.length > 0) return
    }

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, loading: true, error: null, status: "Connecting...", fromCache: false }))

    try {
      const res = await globalThis.fetch(endpoint, { signal: controller.signal })

      if (!res.ok || !res.body) {
        const text = await res.text()
        try {
          const json = JSON.parse(text)
          throw new Error(json.error || json.message || `Request failed (${res.status})`)
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(`Request failed (${res.status}): ${text}`)
          throw e
        }
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let currentEvent = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (currentEvent === "status") {
                setState((prev) => ({
                  ...prev,
                  status: data.state === "connecting" ? "Connecting..." : "Fetching tweets...",
                }))
              } else if (currentEvent === "data") {
                const userMap: Record<string, UserData> = {}
                if (data.includes?.users) {
                  for (const u of data.includes.users) userMap[u.id] = u
                }
                const newTweets = data.data || []
                setState((prev) => {
                  const mergedUsers = { ...prev.users, ...userMap }
                  // Write to local cache
                  writeCache(endpoint, newTweets, mergedUsers)
                  return {
                    ...prev,
                    tweets: newTweets,
                    users: mergedUsers,
                    status: "Complete",
                    lastFetched: new Date(),
                    fromCache: false,
                  }
                })
              } else if (currentEvent === "error") {
                setState((prev) => ({ ...prev, error: data.message, status: "" }))
              } else if (currentEvent === "done") {
                setState((prev) => ({ ...prev, status: "" }))
              }
            } catch {
              // skip malformed JSON
            }
            currentEvent = ""
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Stream failed",
        status: "",
      }))
    } finally {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [endpoint, state.tweets.length])

  // Force refresh bypasses cache
  const forceRefresh = useCallback(() => fetch_(true), [fetch_])

  return { ...state, refresh: fetch_, forceRefresh }
}
