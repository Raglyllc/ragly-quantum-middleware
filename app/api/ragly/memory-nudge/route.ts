import { retrieve, generate, seedSampleData } from "@/lib/ragly-sdk"

export async function POST(request: Request) {
  try {
    const { currentReadingSnippet, userId } = await request.json() as {
      currentReadingSnippet: string
      userId: string
    }

    if (!currentReadingSnippet || !userId) {
      return Response.json(
        { error: "Missing required fields: currentReadingSnippet, userId" },
        { status: 400 }
      )
    }

    // Ensure sample data exists for demo
    seedSampleData(userId)

    // Search user's private vault (PDFs, Notes, Kindle)
    const memories = retrieve({
      query: currentReadingSnippet,
      namespace: `user_${userId}_vault`,
      top_k: 2
    })

    if (memories.length === 0) {
      return Response.json({
        nudge: null,
        message: "No relevant memories found in your vault.",
        memories: []
      })
    }

    // Generate a 'Nudge' connecting current reading to past knowledge
    const nudgePrompt = `
    The user is currently reading: "${currentReadingSnippet}"
    They have these past notes: ${JSON.stringify(memories.map(m => ({ text: m.text, source: m.metadata.source, date: m.metadata.date })))}
    
    Briefly explain the connection between their current reading and their past knowledge.
    Format: "This reminds you of [Topic] from [Date/Source]."
    Keep it concise (1-2 sentences).
    `

    const nudge = await generate(nudgePrompt)

    return Response.json({
      nudge,
      memories: memories.map(m => ({
        text: m.text,
        source: m.metadata.source,
        date: m.metadata.date,
        score: m.score
      }))
    })
  } catch (error) {
    console.error("Memory nudge error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate memory nudge" },
      { status: 500 }
    )
  }
}
