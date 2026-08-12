const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 120

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = cleanText(text)
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const chunks: string[] = []
  const sentences = clean.split(/(?<=[.!?。])\s+|\n+/)
  let current = ""

  const flush = () => {
    if (!current.trim()) return
    chunks.push(current.trim())
    current = ""
  }

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > size && current.length > 0) {
      flush()
      const lastChunk = chunks[chunks.length - 1]
      if (lastChunk) {
        current = lastChunk.slice(-overlap)
      }
    }
    if (sentence.length > size) {
      const parts = sentence.match(/.{1,size}/g) as string[]
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (current.length + part.length + 1 > size && current.length > 0) {
          flush()
          const lastChunk = chunks[chunks.length - 1]
          if (lastChunk) current = lastChunk.slice(-overlap)
        }
        current += (current ? " " : "") + part
      }
    } else {
      current += (current ? " " : "") + sentence
    }
  }
  flush()
  return chunks
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
