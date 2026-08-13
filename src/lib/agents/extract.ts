import { inflateSync } from "zlib"

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "json", "log"])

function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function decodePdfEscape(s: string): string {
  return s
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\d{3}/g, (m) => String.fromCharCode(parseInt(m.slice(1), 8)))
}

function decodeHex(s: string): string {
  const hex = s.replace(/[\s]/g, "")
  const out: string[] = []
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out.push(String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)))
  }
  return out.join("")
}

function extractPdfText(buf: Buffer): string {
  const chunks: string[] = []
  const body = buf.toString("latin1")

  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let sm: RegExpExecArray | null
  while ((sm = streamRe.exec(body)) !== null) {
    let data: Buffer
    try {
      data = inflateSync(Buffer.from(sm[1], "latin1"))
    } catch {
      data = Buffer.from(sm[1], "latin1")
    }
    const str = data.toString("latin1")

    const tjArr = /\[([\s\S]*?)\]\s*TJ/g
    let am: RegExpExecArray | null
    while ((am = tjArr.exec(str)) !== null) {
      const items = am[1].match(/\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]*)>/g) || []
      chunks.push(
        items
          .map((p) => (p.startsWith("<") ? decodeHex(p.slice(1, -1)) : decodePdfEscape(p.slice(1, -1))))
          .join("")
      )
    }

    const tj = /\(((?:[^()\\]|\\.)*)\)\s*Tj|<([0-9a-fA-F\s]*)>\s*Tj/g
    let tm: RegExpExecArray | null
    while ((tm = tj.exec(str)) !== null) {
      if (tm[1] !== undefined) chunks.push(decodePdfEscape(tm[1]))
      else chunks.push(decodeHex(tm[2]))
    }
  }

  return cleanText(chunks.join(" "))
}

export function extractTextFromFile(filename: string, buf: Buffer): string | null {
  const ext = (filename.split(".").pop() || "").toLowerCase()

  if (TEXT_EXT.has(ext)) {
    return cleanText(buf.toString("utf8"))
  }
  if (ext === "pdf") {
    const text = extractPdfText(buf)
    return text || null
  }

  return null
}
