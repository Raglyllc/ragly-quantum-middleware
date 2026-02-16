import { NextResponse } from "next/server"
import { generateOAuthHeader } from "@/lib/x-auth"

export async function GET(request: Request) {
  try {
    const apiKey = process.env.X_API_KEY
    const accessToken = process.env.X_API_ACCESS_TOKEN
    if (!apiKey || !accessToken) {
      return NextResponse.json({ error: "X API credentials not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const maxResults = searchParams.get("max_results") || "10"

    // Step 1: Get authenticated user ID using OAuth 1.0a
    const meUrl = "https://api.twitter.com/2/users/me"
    const meAuthHeader = await generateOAuthHeader({
      method: "GET",
      url: meUrl,
    })

    const meRes = await fetch(meUrl, {
      headers: { Authorization: meAuthHeader },
    })
    if (!meRes.ok) {
      const errText = await meRes.text()
      return NextResponse.json({ error: `Failed to get user: ${errText}` }, { status: meRes.status })
    }
    const meData = await meRes.json()
    const userId = meData.data.id

    // Step 2: Get user's tweets using OAuth 1.0a
    const timelineUrl = `https://api.twitter.com/2/users/${userId}/tweets`
    const queryParams: Record<string, string> = {
      max_results: maxResults,
      "tweet.fields": "created_at,public_metrics,text",
      expansions: "author_id",
      "user.fields": "name,username,profile_image_url",
    }

    const timelineAuthHeader = await generateOAuthHeader({
      method: "GET",
      url: timelineUrl,
      params: queryParams,
    })

    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")

    const timelineRes = await fetch(`${timelineUrl}?${queryString}`, {
      headers: { Authorization: timelineAuthHeader },
    })

    if (!timelineRes.ok) {
      const errText = await timelineRes.text()
      return NextResponse.json({ error: `Failed to fetch timeline: ${errText}` }, { status: timelineRes.status })
    }

    const timelineData = await timelineRes.json()
    return NextResponse.json(timelineData)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
