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

// ─── Per-endpoint rate limit tracking ───
// Tracks remaining calls and reset times per X API endpoint path
interface RateLimitInfo {
  remaining: number
  limit: number
  resetAt: number // epoch ms
}

const rateLimits = new Map<string, RateLimitInfo>()

function getEndpointKey(url: string): string {
  // Normalize: /2/users/me, /2/users/:id/tweets, /2/users/:id/mentions, /2/tweets
  try {
    const path = new URL(url).pathname
    return path.replace(/\/\d{5,}/, "/:id")
  } catch {
    return url
  }
}

function updateRateLimits(url: string, headers: Headers) {
  const key = getEndpointKey(url)
  const remaining = headers.get("x-rate-limit-remaining")
  const limit = headers.get("x-rate-limit-limit")
  const reset = headers.get("x-rate-limit-reset")

  if (remaining !== null && reset !== null) {
    rateLimits.set(key, {
      remaining: Number.parseInt(remaining, 10),
      limit: limit ? Number.parseInt(limit, 10) : 0,
      resetAt: Number.parseInt(reset, 10) * 1000,
    })
    console.log(`[v0] Rate limit [${key}]: ${remaining}/${limit || "?"} remaining, resets ${new Date(Number.parseInt(reset, 10) * 1000).toLocaleTimeString()}`)
  }
}

function isRateLimited(url: string): { limited: boolean; waitMs: number } {
  const key = getEndpointKey(url)
  const info = rateLimits.get(key)
  if (!info) return { limited: false, waitMs: 0 }
  if (info.remaining <= 0 && Date.now() < info.resetAt) {
    return { limited: true, waitMs: info.resetAt - Date.now() }
  }
  // Clear stale entries
  if (Date.now() >= info.resetAt) {
    rateLimits.delete(key)
  }
  return { limited: false, waitMs: 0 }
}

// ─── Response cache ───
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 900_000 // 15 minutes

// ─── Request queue to prevent parallel bursts ───
let lastRequestTime = 0
const MIN_REQUEST_GAP = 1100 // 1.1 seconds between requests to X API

async function throttle() {
  const now = Date.now()
  const gap = now - lastRequestTime
  if (gap < MIN_REQUEST_GAP) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP - gap))
  }
  lastRequestTime = Date.now()
}

// ─── User ID cache ───
let cachedUserId: string | null = null
let cachedUserIdTimestamp = 0
const USER_ID_TTL = 3_600_000 // 1 hour

export async function getCachedUserId(): Promise<string> {
  if (cachedUserId && Date.now() - cachedUserIdTimestamp < USER_ID_TTL) {
    return cachedUserId
  }
  const data = await xFetch("https://api.twitter.com/2/users/me", "GET", undefined, true)
  cachedUserId = data.data.id
  cachedUserIdTimestamp = Date.now()
  return cachedUserId!
}

// ─── Get diagnostics for debugging ───
export function getRateLimitDiagnostics(): Record<string, RateLimitInfo & { waitSec: number }> {
  const result: Record<string, RateLimitInfo & { waitSec: number }> = {}
  for (const [key, info] of rateLimits.entries()) {
    result[key] = { ...info, waitSec: Math.max(0, Math.ceil((info.resetAt - Date.now()) / 1000)) }
  }
  return result
}

export async function xFetch(
  fullUrl: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  skipCache = false
) {
  // 1. Return cached data for GET requests if available
  if (method === "GET" && !skipCache) {
    const cached = cache.get(fullUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[v0] Cache HIT: ${getEndpointKey(fullUrl)}`)
      return cached.data
    }
  }

  // 2. Check if this endpoint is rate-limited before making the call
  const { limited, waitMs } = isRateLimited(fullUrl)
  if (limited) {
    const waitMins = Math.ceil(waitMs / 60_000)
    console.log(`[v0] BLOCKED by rate limit: ${getEndpointKey(fullUrl)}, wait ${waitMins}min`)
    throw new Error(`Rate limited on ${getEndpointKey(fullUrl)}. Try again in ~${waitMins} minute${waitMins > 1 ? "s" : ""}.`)
  }

  // 3. Throttle to prevent burst requests
  await throttle()

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

  console.log(`[v0] xFetch: ${method} ${getEndpointKey(fullUrl)}`)
  const response = await fetch(fullUrl, options)

  // ALWAYS log rate limit headers from every response
  updateRateLimits(fullUrl, response.headers)

  // Handle rate limiting
  if (response.status === 429) {
    const resetHeader = response.headers.get("x-rate-limit-reset")
    const resetAt = resetHeader ? Number.parseInt(resetHeader, 10) * 1000 : Date.now() + 60_000
    const waitMsCalc = Math.max(resetAt - Date.now(), 1000)
    const waitMins = Math.ceil(waitMsCalc / 60_000)

    // Record the rate limit so we don't retry immediately
    rateLimits.set(getEndpointKey(fullUrl), {
      remaining: 0,
      limit: 0,
      resetAt,
    })

    console.log(`[v0] 429 on ${getEndpointKey(fullUrl)}: reset in ${waitMins}min at ${new Date(resetAt).toLocaleTimeString()}`)
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
