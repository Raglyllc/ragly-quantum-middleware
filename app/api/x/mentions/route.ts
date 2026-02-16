import { xFetch, getCachedUserId } from "@/lib/x-client"

export async function GET() {
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

    return Response.json({
      data: mentions.data || [],
      includes: mentions.includes || {},
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch mentions"
    console.error("X Mentions error:", message)

    if (message.includes("401") || message.includes("403")) {
      return Response.json({
        error: "auth_error",
        message: "Authentication failed. Please verify your X API credentials.",
      }, { status: 401 })
    }

    return Response.json({ error: message }, { status: 500 })
  }
}
