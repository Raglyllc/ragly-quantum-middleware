import { retrieve, generate, seedSampleData } from "@/lib/ragly-sdk"

export async function POST(request: Request) {
  try {
    const { draftText } = await request.json() as {
      draftText: string
    }

    if (!draftText) {
      return Response.json(
        { error: "Missing required field: draftText" },
        { status: 400 }
      )
    }

    // Ensure sample data exists for demo
    seedSampleData("demo_user")

    // 1. Search RAGLY for relevant internal policies
    const policyContext = retrieve({
      query: draftText,
      collection: "company_handbook_2026",
      top_k: 3
    })

    // 2. Prompt for "Shadow" auditing
    const auditPrompt = `
    Compare the following DRAFT against the COMPANY POLICIES.
    Flag any contradictions, legal risks, or brand voice violations.

    DRAFT: ${draftText}
    
    POLICIES: ${JSON.stringify(policyContext.map(p => ({ policy: p.text, source: p.metadata.source })))}
    
    Respond in this exact format:
    - If no issues: Return exactly "PASS" followed by a brief explanation.
    - If issues found: Return "FLAG: [issue category]" followed by the specific concern and recommendation.
    
    Be specific about which policy is violated and why.
    `

    const report = await generate(auditPrompt)

    // Parse the result
    const isPassing = report.trim().startsWith("PASS")
    const flags = !isPassing ? report.match(/FLAG:\s*([^\n]+)/g) || [] : []

    return Response.json({
      status: isPassing ? "PASS" : "FLAG",
      report,
      policies_checked: policyContext.map(p => ({
        text: p.text,
        source: p.metadata.source,
        relevance_score: Math.round(p.score * 1000) / 1000
      })),
      flags: flags.map(f => f.replace("FLAG:", "").trim()),
      draft_length: draftText.length
    })
  } catch (error) {
    console.error("Compliance check error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to run compliance check" },
      { status: 500 }
    )
  }
}
