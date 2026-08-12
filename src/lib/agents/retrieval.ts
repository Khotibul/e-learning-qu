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

export function retrieveTopK(chunks: ChunkLike[], queryEmbedding: number[], k = 5, minScore = 0.25) {
  return chunks
    .map((c) => ({ chunk: c, skor: cosineSimilarity(queryEmbedding, c.embedding) }))
    .filter((r) => r.skor >= minScore)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, k)
}

export function keywordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().match(/[a-z0-9]+/g) || [])
  const wb = b.toLowerCase().match(/[a-z0-9]+/g) || []
  if (!wb.length) return 0
  let hit = 0
  for (const w of wb) {
    if (wa.has(w)) hit++
  }
  return hit / wb.length
}

export function retrieveTopKKeyword(chunks: ChunkLike[], query: string, k = 5): typeof retrieveTopK extends never ? never : { chunk: ChunkLike; skor: number }[] {
  const q = query.toLowerCase()
  return chunks
    .map((c) => ({ chunk: c, skor: keywordOverlap(c.text, q) }))
    .filter((r) => r.skor > 0)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, k)
}
