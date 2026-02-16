import { xFetch, getCachedUserId } from "@/lib/x-client"

// Server-Sent Events streaming to avoid connection timeouts on rate limits
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

        send("done", { success: true })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch mentions"
        console.error("X Mentions stream error:", message)
        send("error", { message })
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
