import { searchWithMetadata, seedSampleData } from "@/lib/ragly-sdk"

export async function POST(request: Request) {
  try {
    const { query, collection = "dev_docs" } = await request.json() as {
      query: string
      collection?: string
    }

    if (!query) {
      return Response.json(
        { error: "Missing required field: query" },
        { status: 400 }
      )
    }

    // Ensure sample data exists for demo
    seedSampleData("demo_user")

    // Get raw scores from the RAGLY vector engine
    const results = searchWithMetadata(query, collection)

    // Build debug report
    const debugReport = {
      query,
      collection,
      results: results.map((item, idx) => ({
        rank: idx + 1,
        status: item.status,
        statusLabel: item.score > 0.8 ? "STRONG" : "WEAK (Check Indexing)",
        score: Math.round(item.score * 1000) / 1000,
        content: item.text,
        contentPreview: item.text.slice(0, 100) + (item.text.length > 100 ? "..." : ""),
        source: item.metadata.source
      })),
      suggestion: results.length === 0 
        ? "No results found. Query may be too specific or collection is empty."
        : results[0].score < 0.5 
          ? "Query is too vague or index lacks coverage. Consider adding more documents or rephrasing."
          : results[0].score < 0.8
            ? "Moderate relevance. Results may need review for accuracy."
            : "Strong retrieval. Top results are highly relevant."
    }

    return Response.json(debugReport)
  } catch (error) {
    console.error("Debug retrieval error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to debug retrieval" },
      { status: 500 }
    )
  }
}
