import { getXClient } from "@/lib/x-client"

export async function GET() {
  try {
    console.log("[v0] Timeline route hit")
    console.log("[v0] X_API_KEY present:", !!process.env.X_API_KEY)
    console.log("[v0] X_API_SECRET present:", !!process.env.X_API_SECRET)
    console.log("[v0] X_API_ACCESS_TOKEN present:", !!process.env.X_API_ACCESS_TOKEN)
    console.log("[v0] X_API_ACCESS_TOKEN_SECRET present:", !!process.env.X_API_ACCESS_TOKEN_SECRET)
    
    const client = getXClient()
    console.log("[v0] Client created, calling v2.me()")
    const me = await client.v2.me()
    console.log("[v0] Got user:", JSON.stringify(me.data))
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
    console.error("[v0] X Timeline full error:", error)
    if (error && typeof error === "object" && "data" in error) {
      console.error("[v0] X error data:", JSON.stringify((error as { data: unknown }).data))
    }
    if (error && typeof error === "object" && "code" in error) {
      console.error("[v0] X error code:", (error as { code: unknown }).code)
    }
    if (error && typeof error === "object" && "headers" in error) {
      console.error("[v0] X error headers:", JSON.stringify((error as { headers: unknown }).headers))
    }
    const message = error instanceof Error ? error.message : "Failed to fetch timeline"
    console.error("[v0] X Timeline error message:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
