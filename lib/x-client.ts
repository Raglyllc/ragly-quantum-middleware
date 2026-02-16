import OAuth from "oauth-1.0a"
import crypto from "node:crypto"

function getOAuthClient() {
  const consumerKey = process.env.X_API_KEY
  const consumerSecret = process.env.X_API_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing X_API_KEY or X_API_SECRET")
  }

  return new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64")
    },
  })
}

function getToken() {
  const key = process.env.X_API_ACCESS_TOKEN
  const secret = process.env.X_API_ACCESS_TOKEN_SECRET

  if (!key || !secret) {
    throw new Error("Missing X_API_ACCESS_TOKEN or X_API_ACCESS_TOKEN_SECRET")
  }

  return { key, secret }
}

export async function xFetch(url: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>) {
  const oauth = getOAuthClient()
  const token = getToken()

  const requestData: OAuth.RequestOptions = { url, method }

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token))

  const headers: Record<string, string> = {
    ...authHeader,
    "Content-Type": "application/json",
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body && method === "POST") {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`X API ${method} ${url} failed (${response.status}): ${errorBody}`)
  }

  return response.json()
}
