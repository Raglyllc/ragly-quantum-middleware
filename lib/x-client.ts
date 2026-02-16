import { TwitterApi } from "twitter-api-v2"

export function getXClient() {
  const appKey = process.env.X_API_KEY
  const appSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_API_ACCESS_TOKEN
  const accessSecret = process.env.X_API_ACCESS_TOKEN_SECRET

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing X API credentials. Please set X_API_KEY, X_API_SECRET, X_API_ACCESS_TOKEN, and X_API_ACCESS_TOKEN_SECRET.")
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  })
}
