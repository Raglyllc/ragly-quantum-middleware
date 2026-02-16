import { xFetch, getCachedUserId } from "@/lib/x-client"

export async function GET() {
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

    return Response.json({
      data: timeline.data || [],
      includes: timeline.includes || {},
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch timeline"
    console.error("X Timeline error:", message)

    if (message.includes("401") || message.includes("403")) {
      return Response.json({
        error: "auth_error",
        message: "Authentication failed. Please verify your X API credentials.",
      }, { status: 401 })
    }

    return Response.json({ error: message }, { status: 500 })
  }
}
