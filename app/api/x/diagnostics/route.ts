import { getRateLimitDiagnostics } from "@/lib/x-client"

export async function GET() {
  const diagnostics = getRateLimitDiagnostics()
  console.log("[v0] X Rate Limit Diagnostics:", JSON.stringify(diagnostics, null, 2))
  return Response.json({ rateLimits: diagnostics, timestamp: new Date().toISOString() })
}
