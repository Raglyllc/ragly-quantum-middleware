import { getXClient } from "@/lib/x-client"

export async function POST(request: Request) {
  try {
    const { text, reply_to } = (await request.json()) as {
      text: string
      reply_to?: string
    }

    if (!text || text.trim().length === 0) {
      return Response.json({ error: "Tweet text is required" }, { status: 400 })
    }

    if (text.length > 280) {
      return Response.json({ error: "Tweet exceeds 280 characters" }, { status: 400 })
    }

    const client = getXClient()

    const tweetPayload: Record<string, unknown> = { text: text.trim() }
    if (reply_to) {
      tweetPayload.reply = { in_reply_to_tweet_id: reply_to }
    }

    const result = await client.v2.tweet(tweetPayload as any)

    return Response.json({
      data: {
        id: result.data.id,
        text: result.data.text,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to post tweet"
    console.error("X Tweet error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
