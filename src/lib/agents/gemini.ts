const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY || ""
const CHAT_MODEL = process.env.AGENT_CHAT_MODEL || "gemini-1.5-flash"
const EMBED_MODEL = process.env.AGENT_EMBEDDING_MODEL || "text-embedding-004"

const responseCache = new Map<string, { text: string; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000
const MAX_CACHE = 200
const MAX_RETRIES = 3
const BASE_DELAY = 1000

export function geminiEnabled() {
  return !!GEMINI_KEY
}

function cacheKey(system: string, user: string, temp?: number): string {
  return `${system.slice(0, 80)}|||${user.slice(0, 200)}|||${temp ?? 0.4}`
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    responseCache.delete(key)
    return null
  }
  return entry.text
}

function setCache(key: string, text: string) {
  if (responseCache.size >= MAX_CACHE) {
    const oldest = responseCache.keys().next().value
    if (oldest) responseCache.delete(oldest)
  }
  responseCache.set(key, { text, ts: Date.now() })
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function generateContent(
  system: string,
  user: string,
  opts?: { temperature?: number; maxTokens?: number; cache?: boolean }
): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY tidak diatur")

  const temperature = opts?.temperature ?? 0.4
  const key = cacheKey(system, user, temperature)

  if (opts?.cache !== false) {
    const cached = getCached(key)
    if (cached) return cached
  }

  const userTokens = estimateTokens(system + user)
  if (userTokens > 28000) {
    const overflow = user.slice(0, system.length + (28000 * 4) - system.length)
    user = overflow + "\n\n[Konteks dipotong untuk memenuhi batas token]"
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: opts?.maxTokens ?? 2048,
            },
          }),
        }
      )

      if (res.status === 429) {
        const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 500
        await sleep(delay)
        continue
      }

      if (res.status === 503 || res.status === 500) {
        const delay = BASE_DELAY * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
      if (!text) throw new Error("Gemini mengembalikan respons kosong")

      const trimmed = text.trim()
      setCache(key, trimmed)
      return trimmed
    } catch (e: any) {
      lastError = e
      if (attempt < MAX_RETRIES && (e.message?.includes("429") || e.message?.includes("503") || e.message?.includes("500"))) {
        await sleep(BASE_DELAY * Math.pow(2, attempt))
        continue
      }
      throw e
    }
  }

  throw lastError || new Error("Gemini: semua retry gagal")
}

export async function generateContentWithHistory(
  system: string,
  history: { role: "user" | "model"; parts: string }[],
  newUserMessage: string,
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY tidak diatur")

  const temperature = opts?.temperature ?? 0.4
  const recentHistory = history.slice(-10)

  const contents = [
    ...recentHistory.map((h) => ({ role: h.role, parts: [{ text: h.parts }] })),
    { role: "user" as const, parts: [{ text: newUserMessage }] },
  ]

  const totalTokens = estimateTokens(system) + contents.reduce((s, c) => s + estimateTokens(c.parts[0].text), 0)
  if (totalTokens > 28000) {
    const diff = totalTokens - 26000
    const lastUser = contents[contents.length - 1]
    if (lastUser) {
      lastUser.parts[0] = { text: lastUser.parts[0].text.slice(0, Math.max(100, lastUser.parts[0].text.length - diff * 4)) }
    }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: opts?.maxTokens ?? 2048,
            },
          }),
        }
      )

      if (res.status === 429 || res.status === 503 || res.status === 500) {
        await sleep(BASE_DELAY * Math.pow(2, attempt))
        continue
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
      if (!text) throw new Error("Gemini mengembalikan respons kosong")
      return text.trim()
    } catch (e: any) {
      lastError = e
      // Hanya retry error transien (429/5xx). Error permanen (400/401/403,
      // respons kosong, JSON rusak) tidak akan membaik dengan retry.
      const msg = e?.message || ""
      if (attempt < MAX_RETRIES && (msg.includes("429") || msg.includes("503") || msg.includes("500"))) {
        await sleep(BASE_DELAY * Math.pow(2, attempt))
        continue
      }
      throw e
    }
  }
  throw lastError || new Error("Gemini: semua retry gagal")
}

export async function embedText(
  text: string,
  opts?: { taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" }
): Promise<number[]> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY tidak diatur")
  // Dokumen materi harus RETRIEVAL_DOCUMENT; query siswa RETRIEVAL_QUERY.
  // Sebelumnya keduanya QUERY → kualitas pencocokan semantik menurun.
  const taskType = opts?.taskType ?? "RETRIEVAL_QUERY"

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 9000) }] },
            taskType,
          }),
        }
      )

      if (res.status === 429 || res.status === 503) {
        await sleep(BASE_DELAY * Math.pow(2, attempt))
        continue
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Gemini embed ${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()
      const values = data?.embedding?.values
      if (!Array.isArray(values)) throw new Error("Embedding tidak valid")
      return values
    } catch (e: any) {
      lastError = e
      const msg = e?.message || ""
      if (attempt < MAX_RETRIES && (msg.includes("429") || msg.includes("503") || msg.includes("500"))) {
        await sleep(BASE_DELAY * Math.pow(2, attempt))
        continue
      }
      throw e
    }
  }
  throw lastError || new Error("Gemini embed: semua retry gagal")
}

export { estimateTokens }
