import { getXClient } from "@/lib/x-client"

export async function GET() {
  try {
    const client = getXClient()

    const me = await client.v2.me()
    const userId = me.data.id

    const mentions = await client.v2.userMentionTimeline(userId, {
      max_results: 10,
      "tweet.fields": ["created_at", "public_metrics", "text", "author_id"],
      expansions: ["author_id"],
      "user.fields": ["name", "username", "profile_image_url"],
    })

    return Response.json({
      data: mentions.data?.data || [],
      includes: mentions.data?.includes || {},
      username: me.data.username,
    })
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code: number }).code : 0
    if (code === 401 || code === 403) {
      return Response.json({
        error: "free_tier",
        message: "Mentions access requires X API Basic plan or higher. Posting tweets is available on the Free tier.",
      }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : "Failed to fetch mentions"
    return Response.json({ error: message }, { status: 500 })
  }
}
