import { xFetch, getCachedUserId, getRateLimitDiagnostics } from "@/lib/x-client"

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send("status", { state: "connecting" })

        const userId = await getCachedUserId()
        send("status", { state: "fetching", userId })

        const params = new URLSearchParams({
          max_results: "10",
          "tweet.fields": "created_at,public_metrics,text",
          expansions: "author_id",
          "user.fields": "name,username,profile_image_url",
        })

        const timeline = await xFetch(
          `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`
        )

        send("data", {
          data: timeline.data || [],
          includes: timeline.includes || {},
        })

        send("done", { success: true, rateLimits: getRateLimitDiagnostics() })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch timeline"
        console.error("[v0] X Timeline stream error:", message)
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
