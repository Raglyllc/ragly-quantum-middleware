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

interface StreamState {
  tweets: Tweet[]
  users: Record<string, UserData>
  loading: boolean
  status: string
  error: string | null
  lastFetched: Date | null
}

export function useXStream(endpoint: string) {
  const [state, setState] = useState<StreamState>({
    tweets: [],
    users: {},
    loading: false,
    status: "",
    error: null,
    lastFetched: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async () => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, loading: true, error: null, status: "Connecting..." }))

    try {
      const res = await globalThis.fetch(endpoint, { signal: controller.signal })

      if (!res.ok || !res.body) {
        // Fallback: try to parse as JSON (non-streaming)
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

        // Parse SSE events from buffer
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
                setState((prev) => ({
                  ...prev,
                  tweets: data.data || [],
                  users: { ...prev.users, ...userMap },
                  status: "Complete",
                  lastFetched: new Date(),
                }))
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
  }, [endpoint])

  return { ...state, refresh: fetch_ }
}
