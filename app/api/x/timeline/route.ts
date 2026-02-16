import { getXClient } from "@/lib/x-client"

export async function GET() {
  try {
    const client = getXClient()
    const me = await client.v2.me()
    const userId = me.data.id

    const timeline = await client.v2.userTimeline(userId, {
      max_results: 10,
      "tweet.fields": ["created_at", "public_metrics", "text"],
      expansions: ["author_id"],
      "user.fields": ["name", "username", "profile_image_url"],
    })

    return Response.json({
      data: timeline.data?.data || [],
      includes: timeline.data?.includes || {},
      username: me.data.username,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch timeline"
    console.error("X Timeline error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
