export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export interface ChunkLike {
  id: string
  text: string
  embedding: number[]
  materiId: string
  mataPelajaranId: string
  index: number
}

const SYNONYM_MAP: Record<string, string[]> = {
  "ai": ["kecerdasan buatan", "artificial intelligence", "machine learning"],
  "ml": ["machine learning", "pembelajaran mesin"],
  "database": ["basis data", "db", "sql"],
  "algoritma": ["algorithm", "prosedur", "metode"],
  "variabel": ["variable", "peubah", "data"],
  "fungsi": ["function", "method", "metode"],
  "array": ["list", "daftar", "tabel"],
  "loop": ["perulangan", "iterasi", "pengulangan"],
  "input": ["masukan", "inputan"],
  "output": ["keluaran", "hasil"],
  "error": ["kesalahan", "bug", "exception"],
  "class": ["kelas", "objek"],
  "function": ["fungsi", "method", "prosedur"],
  "boolean": ["logika", "true false", "benar salah"],
  "integer": ["bulat", "angka", "bilangan bulat"],
  "string": ["teks", "text", "karakter"],
  "float": ["desimal", "pecahan", "bilangan desimal"],
}

function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/)
  const expanded = new Set(words)

  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, "")
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (clean === key || synonyms.includes(clean)) {
        expanded.add(key)
        synonyms.forEach((s) => expanded.add(s))
      }
    }
  }

  return [...expanded]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function bm25Score(queryTokens: string[], docTokens: string[], docLen: number, avgDocLen: number, docFreqs: Map<string, number>, totalDocs: number): number {
  const k1 = 1.5
  const b = 0.75
  let score = 0

  const docTokenCounts = new Map<string, number>()
  for (const t of docTokens) {
    docTokenCounts.set(t, (docTokenCounts.get(t) || 0) + 1)
  }

  for (const qt of queryTokens) {
    const tf = docTokenCounts.get(qt) || 0
    const df = docFreqs.get(qt) || 0
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1)
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
    score += idf * tfNorm
  }

  return score
}

export function retrieveTopK(chunks: ChunkLike[], queryEmbedding: number[], k = 5, minScore = 0.25) {
  return chunks
    .map((c) => ({ chunk: c, skor: cosineSimilarity(queryEmbedding, c.embedding) }))
    .filter((r) => r.skor >= minScore)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, k)
}

export function keywordOverlap(a: string, b: string): number {
  const wa = new Set(tokenize(a))
  const wb = tokenize(b)
  if (!wb.length) return 0
  let hit = 0
  for (const w of wb) {
    if (wa.has(w)) hit++
  }
  return hit / wb.length
}

export function retrieveTopKKeyword(chunks: ChunkLike[], query: string, k = 5): { chunk: ChunkLike; skor: number }[] {
  const expandedTerms = expandQuery(query)
  const queryTokens = tokenize(query)
  const allQueryTokens = [...new Set([...queryTokens, ...expandedTerms.flatMap(tokenize)])]

  const totalDocs = chunks.length
  const docFreqs = new Map<string, number>()
  const docTokenLists: string[][] = []
  let totalLen = 0

  for (const c of chunks) {
    const tokens = tokenize(c.text)
    docTokenLists.push(tokens)
    totalLen += tokens.length
    const seen = new Set<string>()
    for (const t of tokens) {
      if (!seen.has(t)) {
        seen.add(t)
        docFreqs.set(t, (docFreqs.get(t) || 0) + 1)
      }
    }
  }

  const avgDocLen = totalDocs > 0 ? totalLen / totalDocs : 1

  const results = chunks.map((c, i) => {
    const bm25 = bm25Score(allQueryTokens, docTokenLists[i], docTokenLists[i].length, avgDocLen, docFreqs, totalDocs)
    const keywordScore = keywordOverlap(c.text, query)
    const synonymBoost = expandedTerms.some((t) => tokenize(c.text).some((ct) => t.includes(ct) || ct.includes(t))) ? 0.15 : 0
    const combinedScore = bm25 * 0.5 + keywordScore * 0.35 + synonymBoost + 0.15
    return { chunk: c, skor: combinedScore }
  })

  const sorted = results
    .filter((r) => r.skor > 0.05)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, k)

  if (sorted.length === 0 && chunks.length > 0) {
    const recencySorted = [...chunks].sort((a, b) => b.index - a.index)
    return recencySorted.slice(0, Math.min(3, k)).map((c) => ({ chunk: c, skor: 0.05 }))
  }

  return sorted
}

export function retrieveHybrid(
  chunks: ChunkLike[],
  query: string,
  queryEmbedding: number[] | null,
  k = 5,
  alpha = 0.6
): { chunk: ChunkLike; skor: number }[] {
  const keywordResults = retrieveTopKKeyword(chunks, query, k * 2)

  if (!queryEmbedding) return keywordResults.slice(0, k)

  const semanticResults = retrieveTopK(chunks, queryEmbedding, k * 2, 0.15)

  const scores = new Map<string, number>()
  const maxKw = Math.max(...keywordResults.map((r) => r.skor), 0.001)
  const maxSem = Math.max(...semanticResults.map((r) => r.skor), 0.001)

  for (const r of keywordResults) {
    const normalized = r.skor / maxKw
    scores.set(r.chunk.id, (scores.get(r.chunk.id) || 0) + normalized * (1 - alpha))
  }

  for (const r of semanticResults) {
    const normalized = r.skor / maxSem
    scores.set(r.chunk.id, (scores.get(r.chunk.id) || 0) + normalized * alpha)
  }

  const results: { chunk: ChunkLike; skor: number }[] = []
  for (const [id, skor] of scores) {
    const chunk = chunks.find((c) => c.id === id)
    if (chunk) results.push({ chunk, skor })
  }

  return results.sort((a, b) => b.skor - a.skor).slice(0, k)
}
