// OAuth 1.0a implementation using Web Crypto API (no Node.js crypto dependency)

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
  const bytes = new Uint8Array(signature)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function generateOAuthHeader(
  method: string,
  url: string,
  queryParams: Record<string, string> = {}
): Promise<string> {
  const consumerKey = (process.env.X_API_KEY || "").trim()
  const consumerSecret = (process.env.X_API_SECRET || "").trim()
  const accessToken = (process.env.X_API_ACCESS_TOKEN || "").trim()
  const accessTokenSecret = (process.env.X_API_ACCESS_TOKEN_SECRET || "").trim()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  }

  const allParams: Record<string, string> = { ...oauthParams, ...queryParams }
  const sortedParamString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&")

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParamString)}`
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`

  const signature = await hmacSha1Base64(signingKey, signatureBase)
  oauthParams.oauth_signature = signature

  const headerString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ")

  return `OAuth ${headerString}`
}

// Simple in-memory cache for GET requests to avoid rate limits
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 900_000 // 15 minutes

// Cache the user ID so we don't call /users/me on every request
let cachedUserId: string | null = null
let cachedUserIdTimestamp = 0
const USER_ID_TTL = 600_000 // 10 minutes

export async function getCachedUserId(): Promise<string> {
  if (cachedUserId && Date.now() - cachedUserIdTimestamp < USER_ID_TTL) {
    return cachedUserId
  }
  const data = await xFetch("https://api.twitter.com/2/users/me", "GET", undefined, true)
  cachedUserId = data.data.id
  cachedUserIdTimestamp = Date.now()
  return cachedUserId!
}

export async function xFetch(
  fullUrl: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  skipCache = false
) {
  // Return cached data for GET requests if available
  if (method === "GET" && !skipCache) {
    const cached = cache.get(fullUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
  }

  const urlObj = new URL(fullUrl)
  const baseUrl = `${urlObj.origin}${urlObj.pathname}`
  const queryParams: Record<string, string> = {}
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value
  })

  const authHeader = await generateOAuthHeader(method, baseUrl, queryParams)

  const headers: Record<string, string> = {
    Authorization: authHeader,
  }

  const options: RequestInit = { method, headers }

  if (body && method === "POST") {
    headers["Content-Type"] = "application/json"
    options.body = JSON.stringify(body)
  }

  const response = await fetch(fullUrl, options)

  // Handle rate limiting with exponential backoff retry
  if (response.status === 429) {
    const retryAfter = response.headers.get("x-rate-limit-reset")
    const resetTime = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : Date.now() + 60_000
    const waitMs = Math.max(resetTime - Date.now(), 1000)

    // If wait is short enough (under 30s), auto-retry once after waiting
    if (waitMs <= 30_000 && !skipCache) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      const retryAuthHeader = await generateOAuthHeader(method, baseUrl, queryParams)
      headers.Authorization = retryAuthHeader
      const retryResponse = await fetch(fullUrl, { ...options, headers })
      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        if (method === "GET") {
          cache.set(fullUrl, { data: retryData, timestamp: Date.now() })
        }
        return retryData
      }
    }

    const waitMins = Math.ceil(waitMs / 60_000)
    throw new Error(`Rate limited. Try again in ~${waitMins} minute${waitMins > 1 ? "s" : ""}.`)
  }

  // Handle OAuth permission errors
  if (response.status === 403) {
    const errorBody = await response.text()
    if (errorBody.includes("oauth1-permissions")) {
      throw new Error(
        "Your X app needs Read and Write permissions. Go to developer.x.com > your app > Settings > User authentication settings > Edit > change App permissions to 'Read and write', then regenerate your Access Token and Secret."
      )
    }
    throw new Error(`X API forbidden (403): ${errorBody}`)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`X API ${method} failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()

  // Cache successful GET responses
  if (method === "GET") {
    cache.set(fullUrl, { data, timestamp: Date.now() })
  }

  return data
}
