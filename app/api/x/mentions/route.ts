import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const bearerToken = process.env.X_BEARER_TOKEN
    if (!bearerToken) {
      return NextResponse.json({ error: "X_BEARER_TOKEN is not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const maxResults = searchParams.get("max_results") || "10"

    // Get authenticated user ID
    const meRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
    if (!meRes.ok) {
      const errText = await meRes.text()
      return NextResponse.json({ error: `Failed to get user: ${errText}` }, { status: meRes.status })
    }
    const meData = await meRes.json()
    const userId = meData.data.id

    // Get mentions
    const mentionsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/mentions?max_results=${maxResults}&tweet.fields=created_at,public_metrics,text,author_id&expansions=author_id&user.fields=name,username,profile_image_url`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    )

    if (!mentionsRes.ok) {
      const errText = await mentionsRes.text()
      return NextResponse.json({ error: `Failed to fetch mentions: ${errText}` }, { status: mentionsRes.status })
    }

    const mentionsData = await mentionsRes.json()
    return NextResponse.json(mentionsData)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
