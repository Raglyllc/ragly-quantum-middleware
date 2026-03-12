import { GoogleGenerativeAI } from "@google/generative-ai"

// ─── RAGLY SDK ───
// Topological reasoning infrastructure for vector retrieval and generation

// In-memory vector store for demonstration
// In production, this would connect to a proper vector DB (Pinecone, Weaviate, etc.)
interface VectorEntry {
  id: string
  text: string
  embedding: number[]
  metadata: {
    source?: string
    date?: string
    namespace?: string
    collection?: string
  }
}

const vectorStore: VectorEntry[] = []

// Simple cosine similarity for vector matching
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Generate a simple embedding using hash-based approach
// In production, use a proper embedding model (OpenAI, Cohere, etc.)
function simpleEmbed(text: string): number[] {
  const embedding = new Array(128).fill(0)
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "")
  const words = normalized.split(/\s+/)
  
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const idx = (word.charCodeAt(i) * (i + 1)) % 128
      embedding[idx] += 1 / words.length
    }
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding
}

// ─── SDK Methods ───

export interface RetrievalResult {
  id: string
  text: string
  score: number
  metadata: VectorEntry["metadata"]
}

export interface SearchWithMetadataResult extends RetrievalResult {
  status: "STRONG" | "WEAK"
}

/**
 * Retrieve relevant documents from a user's namespace or collection
 */
export function retrieve(options: {
  query: string
  namespace?: string
  collection?: string
  top_k?: number
}): RetrievalResult[] {
  const { query, namespace, collection, top_k = 3 } = options
  const queryEmbedding = simpleEmbed(query)
  
  // Filter by namespace/collection if specified
  const filtered = vectorStore.filter(entry => {
    if (namespace && entry.metadata.namespace !== namespace) return false
    if (collection && entry.metadata.collection !== collection) return false
    return true
  })
  
  // Score and sort
  const scored = filtered.map(entry => ({
    ...entry,
    score: cosineSimilarity(queryEmbedding, entry.embedding)
  }))
  
  scored.sort((a, b) => b.score - a.score)
  
  return scored.slice(0, top_k).map(({ id, text, score, metadata }) => ({
    id,
    text,
    score,
    metadata
  }))
}

/**
 * Search with full metadata for debugging retrieval quality
 */
export function searchWithMetadata(
  query: string,
  collection: string
): SearchWithMetadataResult[] {
  const results = retrieve({ query, collection, top_k: 5 })
  
  return results.map(r => ({
    ...r,
    status: r.score > 0.8 ? "STRONG" as const : "WEAK" as const
  }))
}

/**
 * Index a document into the vector store
 */
export function index(options: {
  text: string
  namespace?: string
  collection?: string
  source?: string
  date?: string
}): string {
  const { text, namespace, collection, source, date } = options
  const id = `vec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  
  vectorStore.push({
    id,
    text,
    embedding: simpleEmbed(text),
    metadata: {
      namespace,
      collection,
      source,
      date: date || new Date().toISOString()
    }
  })
  
  return id
}

/**
 * Generate text using the RAGLY topological reasoning system
 */
export async function generate(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }
  
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  
  const result = await model.generateContent(prompt)
  return result.response.text()
}

/**
 * Get all entries in a collection (for debugging)
 */
export function listCollection(collection: string): VectorEntry[] {
  return vectorStore.filter(e => e.metadata.collection === collection)
}

/**
 * Clear a collection
 */
export function clearCollection(collection: string): number {
  const before = vectorStore.length
  const toRemove = vectorStore.filter(e => e.metadata.collection === collection)
  for (const entry of toRemove) {
    const idx = vectorStore.indexOf(entry)
    if (idx > -1) vectorStore.splice(idx, 1)
  }
  return before - vectorStore.length
}

/**
 * Seed sample data for demonstrations
 */
export function seedSampleData(userId: string) {
  // Sample user vault data (PDFs, notes, Kindle highlights)
  const sampleVault = [
    {
      text: "The concept of 'double consciousness' from Du Bois relates to the internal conflict of subordinated identities in a dominant culture.",
      source: "The Souls of Black Folk - Kindle Highlight",
      date: "2024-08-15"
    },
    {
      text: "Topological data analysis reveals that complex systems often have hidden structures that persist across scale transformations.",
      source: "Notes on TDA for AI Systems",
      date: "2024-10-22"
    },
    {
      text: "The Hebrew concept of 'teshuvah' is not merely repentance but a return to one's original state of alignment with divine purpose.",
      source: "Torah Study Notes",
      date: "2024-11-03"
    },
    {
      text: "Frantz Fanon argued that decolonization is always a violent process because it fundamentally restructures the social order.",
      source: "The Wretched of the Earth - PDF Annotation",
      date: "2024-09-18"
    },
    {
      text: "Memory in distributed systems must account for eventual consistency - what appears lost may simply be in transit.",
      source: "Distributed Systems Architecture Notes",
      date: "2024-12-01"
    }
  ]
  
  for (const item of sampleVault) {
    index({
      text: item.text,
      namespace: `user_${userId}_vault`,
      source: item.source,
      date: item.date
    })
  }
  
  // Sample company handbook for compliance
  const companyPolicies = [
    {
      text: "All service guarantees must include disclaimers about maintenance windows and force majeure events. Never promise 100% uptime to any customer tier.",
      source: "SLA Policy v2.3"
    },
    {
      text: "Customer data retention follows the 90-day rule for inactive accounts. GDPR compliance requires explicit consent for any retention beyond this period.",
      source: "Data Governance Handbook"
    },
    {
      text: "Brand voice guidelines: Use confident but not absolute language. Avoid superlatives like 'best', 'only', 'guaranteed'. Preferred: 'industry-leading', 'designed for reliability'.",
      source: "Brand Style Guide"
    },
    {
      text: "Legal requires review of any external communication promising specific performance metrics, refund policies, or contractual commitments.",
      source: "Legal Review Requirements"
    }
  ]
  
  for (const policy of companyPolicies) {
    index({
      text: policy.text,
      collection: "company_handbook_2026",
      source: policy.source,
      date: "2026-01-01"
    })
  }
  
  // Sample dev docs for retrieval debugging
  const devDocs = [
    {
      text: "The RAGLY SDK provides retrieve(), generate(), and index() methods for building RAG applications.",
      source: "RAGLY SDK Reference"
    },
    {
      text: "Vector embeddings should be normalized before similarity search for consistent cosine similarity scores.",
      source: "Embedding Best Practices"
    },
    {
      text: "Rate limiting in the API follows a token bucket algorithm with 1000 requests per minute per API key.",
      source: "API Rate Limits"
    }
  ]
  
  for (const doc of devDocs) {
    index({
      text: doc.text,
      collection: "dev_docs",
      source: doc.source,
      date: "2026-01-15"
    })
  }
}
