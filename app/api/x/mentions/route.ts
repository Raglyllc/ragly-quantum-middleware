import { xFetch, getCachedUserId } from "@/lib/x-client"

// Server-side response cache for mentions data
let cachedMentions: { data: unknown[]; includes: Record<string, unknown>; timestamp: number } | null = null
const MENTIONS_CACHE_TTL = 120_000 // 2 minutes

export async function GET() {
  // Return cached data immediately if fresh enough
  if (cachedMentions && Date.now() - cachedMentions.timestamp < MENTIONS_CACHE_TTL) {
    return Response.json(
      { data: cachedMentions.data, includes: cachedMentions.includes, cached: true },
      { headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=120" } }
    )
  }

  try {
    const userId = await getCachedUserId()

    const params = new URLSearchParams({
      max_results: "10",
      "tweet.fields": "created_at,public_metrics,text,author_id",
      expansions: "author_id",
      "user.fields": "name,username,profile_image_url",
    })

    const mentions = await xFetch(
      `https://api.twitter.com/2/users/${userId}/mentions?${params.toString()}`
    )

    const responseData = { data: mentions.data || [], includes: mentions.includes || {} }

    // Update server-side cache
    cachedMentions = { ...responseData, timestamp: Date.now() }

    return Response.json(responseData, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=120" },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch mentions"
    console.error("X Mentions error:", message)

    // On error, return stale cache if available
    if (cachedMentions) {
      return Response.json(
        { data: cachedMentions.data, includes: cachedMentions.includes, cached: true, stale: true },
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
