const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY || ""
const CHAT_MODEL = process.env.AGENT_CHAT_MODEL || "gemini-1.5-flash"
const EMBED_MODEL = process.env.AGENT_EMBEDDING_MODEL || "text-embedding-004"

export function geminiEnabled() {
  return !!GEMINI_KEY
}

export async function generateContent(system: string, user: string, opts?: { temperature?: number }): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY tidak diatur")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: opts?.temperature ?? 0.4 },
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
  if (!text) throw new Error("Gemini mengembalikan respons kosong")
  return text.trim()
}

export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY tidak diatur")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 9000) }] } }),
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Gemini embed ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const values = data?.embedding?.values
  if (!Array.isArray(values)) throw new Error("Embedding tidak valid")
  return values
}
