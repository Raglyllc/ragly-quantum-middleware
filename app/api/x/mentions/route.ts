import { xFetch, getCachedUserId, getRateLimitDiagnostics } from "@/lib/x-client"

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Check for required credentials
      const missingCreds = []
      if (!process.env.X_API_KEY) missingCreds.push("X_API_KEY")
      if (!process.env.X_API_SECRET) missingCreds.push("X_API_SECRET")
      if (!process.env.X_ACCESS_TOKEN) missingCreds.push("X_ACCESS_TOKEN")
      if (!process.env.X_ACCESS_TOKEN_SECRET) missingCreds.push("X_ACCESS_TOKEN_SECRET")
      
      if (missingCreds.length > 0) {
        send("error", { message: `Missing X API credentials: ${missingCreds.join(", ")}. Add them in Settings > Vars.` })
        controller.close()
        return
      }

      try {
        send("status", { state: "connecting" })

        const userId = await getCachedUserId()
        send("status", { state: "fetching", userId })

        const params = new URLSearchParams({
          max_results: "10",
          "tweet.fields": "created_at,public_metrics,text,author_id",
          expansions: "author_id",
          "user.fields": "name,username,profile_image_url",
        })

        const mentions = await xFetch(
          `https://api.twitter.com/2/users/${userId}/mentions?${params.toString()}`
        )

        send("data", {
          data: mentions.data || [],
          includes: mentions.includes || {},
        })

        send("done", { success: true, rateLimits: getRateLimitDiagnostics() })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch mentions"
        console.error("[v0] X Mentions stream error:", message)
        send("error", { message, rateLimits: getRateLimitDiagnostics() })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
