import crypto from "crypto"

interface OAuthParams {
  method: string
  url: string
  params?: Record<string, string>
  body?: Record<string, string>
}

export function generateOAuthHeader({ method, url, params = {}, body = {} }: OAuthParams): string {
  const apiKey = process.env.X_API_KEY!
  const apiSecret = process.env.X_API_SECRET!
  const accessToken = process.env.X_API_ACCESS_TOKEN!
  const accessTokenSecret = process.env.X_API_ACCESS_TOKEN_SECRET!

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  }

  // Combine all params for signature base
  const allParams: Record<string, string> = { ...oauthParams, ...params, ...body }
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join("&")

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`
  const signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64")

  oauthParams.oauth_signature = signature

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ")

  return `OAuth ${authHeader}`
}
