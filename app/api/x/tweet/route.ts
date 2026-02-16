import { NextResponse } from "next/server"
import { generateOAuthHeader } from "@/lib/x-auth"

export async function POST(request: Request) {
  try {
    const apiKey = process.env.X_API_KEY
    const accessToken = process.env.X_API_ACCESS_TOKEN
    if (!apiKey || !accessToken) {
      return NextResponse.json({ error: "X API credentials not configured" }, { status: 500 })
    }

    const { text, reply_to } = (await request.json()) as {
      text: string
      reply_to?: string
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Tweet text is required" }, { status: 400 })
    }

    if (text.length > 280) {
      return NextResponse.json({ error: "Tweet exceeds 280 characters" }, { status: 400 })
    }

    const url = "https://api.twitter.com/2/tweets"

    const bodyObj: Record<string, unknown> = { text }
    if (reply_to) {
      bodyObj.reply = { in_reply_to_tweet_id: reply_to }
    }

    const authHeader = await generateOAuthHeader({
      method: "POST",
      url,
    })

    const tweetRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyObj),
    })

    if (!tweetRes.ok) {
      const errText = await tweetRes.text()
      return NextResponse.json({ error: `Failed to post tweet: ${errText}` }, { status: tweetRes.status })
    }

    const tweetData = await tweetRes.json()
    return NextResponse.json(tweetData)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
