interface OAuthParams {
  method: string
  url: string
  params?: Record<string, string>
  body?: Record<string, string>
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let nonce = ""
  const randomValues = new Uint8Array(32)
  crypto.getRandomValues(randomValues)
  for (const val of randomValues) {
    nonce += chars[val % chars.length]
  }
  return nonce
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(signature)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export async function generateOAuthHeader({ method, url, params = {}, body = {} }: OAuthParams): Promise<string> {
  const apiKey = process.env.X_API_KEY || ""
  const apiSecret = process.env.X_API_SECRET || ""
  const accessToken = process.env.X_API_ACCESS_TOKEN || ""
  const accessTokenSecret = process.env.X_API_ACCESS_TOKEN_SECRET || ""

  console.log("[v0] OAuth env check - API_KEY exists:", !!apiKey, "length:", apiKey.length)
  console.log("[v0] OAuth env check - API_SECRET exists:", !!apiSecret, "length:", apiSecret.length)
  console.log("[v0] OAuth env check - ACCESS_TOKEN exists:", !!accessToken, "length:", accessToken.length)
  console.log("[v0] OAuth env check - ACCESS_TOKEN_SECRET exists:", !!accessTokenSecret, "length:", accessTokenSecret.length)
  console.log("[v0] OAuth request - method:", method, "url:", url)
  console.log("[v0] OAuth request - params:", JSON.stringify(params))

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  }

  // Combine all params for signature base string
  const allParams: Record<string, string> = { ...oauthParams, ...params, ...body }
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join("&")

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`

  console.log("[v0] OAuth signature base:", signatureBase)
  console.log("[v0] OAuth signing key length:", signingKey.length)

  const signature = await hmacSha1(signingKey, signatureBase)
  oauthParams.oauth_signature = signature

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(", ")

  const result = `OAuth ${authHeader}`
  console.log("[v0] OAuth header:", result.substring(0, 80) + "...")
  return result
}
