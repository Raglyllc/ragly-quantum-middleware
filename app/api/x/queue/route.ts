// In-memory approval queue (server-side only)
// In production, this should be backed by a database

export interface QueuedTweet {
  id: string
  text: string
  createdAt: string
  status: "pending" | "approved" | "rejected"
  approvedBy?: string
  approvedAt?: string
  postedTweetId?: string
}

// Shared in-memory store
const queue: QueuedTweet[] = []

export async function GET() {
  return Response.json({ queue })
}

export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as { text: string }

    if (!text || text.trim().length === 0) {
      return Response.json({ error: "Tweet text is required" }, { status: 400 })
    }

    if (text.length > 280) {
      return Response.json({ error: "Tweet exceeds 280 characters" }, { status: 400 })
    }

    const queuedTweet: QueuedTweet = {
      id: `qt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      status: "pending",
    }

    queue.push(queuedTweet)

    return Response.json({ data: queuedTweet })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to queue tweet"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action } = (await request.json()) as {
      id: string
      action: "approve" | "reject"
    }

    const tweet = queue.find((t) => t.id === id)
    if (!tweet) {
      return Response.json({ error: "Queued tweet not found" }, { status: 404 })
    }

    if (tweet.status !== "pending") {
      return Response.json({ error: `Tweet already ${tweet.status}` }, { status: 400 })
    }

    if (action === "approve") {
      // Post the tweet via X API
      const { xFetch } = await import("@/lib/x-client")
      const result = await xFetch("https://api.twitter.com/2/tweets", "POST", { text: tweet.text })

      tweet.status = "approved"
      tweet.approvedBy = "@ahayahsharif"
      tweet.approvedAt = new Date().toISOString()
      tweet.postedTweetId = result.data?.id

      return Response.json({ data: tweet, posted: true })
    }

    tweet.status = "rejected"
    tweet.approvedBy = "@ahayahsharif"
    tweet.approvedAt = new Date().toISOString()

    return Response.json({ data: tweet, posted: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process approval"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id: string }
    const index = queue.findIndex((t) => t.id === id)

    if (index === -1) {
      return Response.json({ error: "Queued tweet not found" }, { status: 404 })
    }

    queue.splice(index, 1)
    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete queued tweet"
    return Response.json({ error: message }, { status: 500 })
  }
}
