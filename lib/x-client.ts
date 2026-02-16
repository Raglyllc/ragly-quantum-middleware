import { TwitterApi } from "twitter-api-v2"

export function getXClient() {
  const appKey = process.env.X_API_KEY
  const appSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_API_ACCESS_TOKEN
  const accessSecret = process.env.X_API_ACCESS_TOKEN_SECRET
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET

  console.log("[v0] X env check - API_KEY:", appKey ? `${appKey.substring(0, 5)}...` : "MISSING")
  console.log("[v0] X env check - API_SECRET:", appSecret ? `${appSecret.substring(0, 5)}...` : "MISSING")
  console.log("[v0] X env check - ACCESS_TOKEN:", accessToken ? `${accessToken.substring(0, 5)}...` : "MISSING")
  console.log("[v0] X env check - ACCESS_SECRET:", accessSecret ? `${accessSecret.substring(0, 5)}...` : "MISSING")
  console.log("[v0] X env check - CLIENT_ID:", clientId ? `${clientId.substring(0, 5)}...` : "MISSING")
  console.log("[v0] X env check - CLIENT_SECRET:", clientSecret ? `${clientSecret.substring(0, 5)}...` : "MISSING")

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing X API credentials. Please set X_API_KEY, X_API_SECRET, X_API_ACCESS_TOKEN, and X_API_ACCESS_TOKEN_SECRET.")
  }

  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  })

  console.log("[v0] X client created successfully")
  return client
}
