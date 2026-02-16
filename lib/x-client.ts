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

  console.log("[v0] OAuth creds - consumerKey:", consumerKey.length, "chars, starts:", consumerKey.substring(0, 8))
  console.log("[v0] OAuth creds - consumerSecret:", consumerSecret.length, "chars")
  console.log("[v0] OAuth creds - accessToken:", accessToken.length, "chars, starts:", accessToken.substring(0, 12))
  console.log("[v0] OAuth creds - accessTokenSecret:", accessTokenSecret.length, "chars")

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  }

  // Combine oauth params and query params for signature base
  const allParams: Record<string, string> = { ...oauthParams, ...queryParams }
  const sortedParamString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&")

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParamString)}`
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`

  console.log("[v0] OAuth signatureBase:", signatureBase)
  console.log("[v0] OAuth signingKey length:", signingKey.length)

  const signature = await hmacSha1Base64(signingKey, signatureBase)
  console.log("[v0] OAuth signature:", signature)
  oauthParams.oauth_signature = signature

  const headerString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ")

  return `OAuth ${headerString}`
}

export async function xFetch(fullUrl: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>) {
  // Split URL and query params for signature
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

  console.log("[v0] xFetch:", method, fullUrl)
  const response = await fetch(fullUrl, options)

  if (!response.ok) {
    const errorBody = await response.text()
    console.log("[v0] xFetch error response:", response.status, errorBody)
    throw new Error(`X API ${method} failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  console.log("[v0] xFetch success:", method, fullUrl)
  return data
}
