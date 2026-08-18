const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150
const MIN_CHUNK = 100

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u00A0/g, " ")
    .trim()
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line) || /^[A-Z][A-Z\s]{3,}$/.test(line) || /^\d+[\.\)]\s/.test(line)
}

function isListStart(line: string): boolean {
  return /^[-•*]\s/.test(line) || /^\d+[\.\)]\s/.test(line)
}

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = cleanText(text)
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const lines = clean.split("\n")
  const chunks: string[] = []
  let current = ""
  let currentLines: string[] = []

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed.length >= MIN_CHUNK) {
      chunks.push(trimmed)
    }
    current = ""
    currentLines = []
  }

  const addOverlap = () => {
    if (chunks.length === 0) return ""
    const lastChunk = chunks[chunks.length - 1]
    const words = lastChunk.split(/\s+/)
    let overlapText = ""
    let charCount = 0
    for (let i = words.length - 1; i >= 0 && charCount < overlap; i--) {
      overlapText = words[i] + (overlapText ? " " + overlapText : "")
      charCount += words[i].length + 1
    }
    return overlapText
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      if (current.length + 2 <= size) {
        current += "\n\n"
        currentLines.push("")
      } else {
        flush()
      }
      continue
    }

    const isSectionBreak = isHeading(trimmedLine)

    if (isSectionBreak && current.length > MIN_CHUNK) {
      flush()
    }

    if (current.length + trimmedLine.length + 1 > size && current.length > MIN_CHUNK) {
      flush()
      const overlapText = addOverlap()
      if (overlapText) {
        current = overlapText + " "
        currentLines = [overlapText]
      }
    }

    if (trimmedLine.length > size) {
      const sentences = trimmedLine.split(/(?<=[.!?。])\s+/)
      for (const sentence of sentences) {
        if (current.length + sentence.length + 1 > size && current.length > MIN_CHUNK) {
          flush()
          const overlapText = addOverlap()
          if (overlapText) {
            current = overlapText + " "
            currentLines = [overlapText]
          }
        }
        current += (current && !current.endsWith(" ") ? " " : "") + sentence
        currentLines.push(sentence)
      }
    } else {
      current += (current && !current.endsWith("\n") ? "\n" : "") + trimmedLine
      currentLines.push(trimmedLine)
    }
  }

  flush()
  return chunks
}

export function chunkTextBySection(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = cleanText(text)
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const lines = clean.split("\n")
  const sections: string[][] = []
  let currentSection: string[] = []

  for (const line of lines) {
    if (isHeading(line.trim()) && currentSection.length > 0) {
      sections.push(currentSection)
      currentSection = []
    }
    currentSection.push(line)
  }
  if (currentSection.length > 0) sections.push(currentSection)

  if (sections.length <= 1) return chunkText(text, size, overlap)

  const chunks: string[] = []
  for (const section of sections) {
    const sectionText = section.join("\n").trim()
    if (sectionText.length <= size) {
      if (sectionText.length >= MIN_CHUNK) chunks.push(sectionText)
    } else {
      chunks.push(...chunkText(sectionText, size, overlap))
    }
  }

  return chunks
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
