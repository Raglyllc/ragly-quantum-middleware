const CACHE_PREFIX = "ragly-api-cache:"
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export function getCachedResponse<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CachedEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function setCachedResponse<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  try {
    const entry: CachedEntry<T> = { data, timestamp: Date.now(), ttl }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearApiCache(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
