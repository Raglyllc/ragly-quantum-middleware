import { xFetch, getCachedUserId } from "@/lib/x-client"

// Server-side response cache for timeline data
let cachedTimeline: { data: unknown[]; includes: Record<string, unknown>; timestamp: number } | null = null
const TIMELINE_CACHE_TTL = 120_000 // 2 minutes — serve cached while revalidating

export async function GET() {
  // Return cached data immediately if fresh enough
  if (cachedTimeline && Date.now() - cachedTimeline.timestamp < TIMELINE_CACHE_TTL) {
    return Response.json(
      { data: cachedTimeline.data, includes: cachedTimeline.includes, cached: true },
      { headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=120" } }
    )
  }

  try {
    const userId = await getCachedUserId()

    const params = new URLSearchParams({
      max_results: "10",
      "tweet.fields": "created_at,public_metrics,text",
      expansions: "author_id",
      "user.fields": "name,username,profile_image_url",
    })

    const timeline = await xFetch(
      `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`
    )

    const responseData = { data: timeline.data || [], includes: timeline.includes || {} }

    // Update server-side cache
    cachedTimeline = { ...responseData, timestamp: Date.now() }

    return Response.json(responseData, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=120" },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch timeline"
    console.error("X Timeline error:", message)

    // On error, return stale cache if available
    if (cachedTimeline) {
      return Response.json(
        { data: cachedTimeline.data, includes: cachedTimeline.includes, cached: true, stale: true },
        { headers: { "X-Cache": "STALE" } }
      )
    }

    if (message.includes("401") || message.includes("403")) {
      return Response.json({
        error: "auth_error",
        message: "Authentication failed. Please verify your X API credentials.",
      }, { status: 401 })
    }

    return Response.json({ error: message }, { status: 500 })
  }
}
