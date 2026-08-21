import { generateContent, geminiEnabled } from "./gemini"

export type AgentIntent = "tutor" | "assessor" | "recommender" | "adaptive" | "mastery" | "analytics" | "warning" | "explain" | "greeting" | "unknown"

export interface DetectedIntent {
  primary: AgentIntent
  secondary: AgentIntent | null
  mentionedMateri: string | null
  confidence: number
  rewrittenQuery: string
}

interface ChatMessage {
  role: "user" | "model"
  content: string
}

const RULE_PATTERNS: [RegExp, AgentIntent][] = [
  [/\b(latihan|kuis|quiz|buatkan soal|buat soal|soal latihan|kerjakan latihan|ujian)\b/i, "assessor"],
  [/\b(rekomendasi|saran belajar|materi apa|belajar apa|sebaiknya saya|apa yang harus|rekomendasikan)\b/i, "recommender"],
  [/\b(jalur belajar|learning path|atur jalur|susun jalur|adaptive|path belajar|rencana belajar|kurikulum)\b/i, "adaptive"],
  [/\b(penguasaan|kompetensi|mastery|seberapa kuat|kuasai|skor mastery|level belajar|capaian)\b/i, "mastery"],
  [/\b(analitik|statistik|grafik|analytics|data belajar|ringkasan belajar|progres belajar|perkembangan)\b/i, "analytics"],
  [/\b(peringatan|warning|at risk|bermasalah|tidak aktif|nilai turun|motivasi rendah|early warning|stres|kesulitan)\b/i, "warning"],
  // HANYA untuk menjelaskan keputusan AI — bukan pertanyaan konten umum.
  // Pola generik seperti "mengapa/penjelasan" menyebabkan pertanyaan materi
  // salah route ke explain agent (bug audit C2).
  [/((kenapa|mengapa|apa alasan)[^?]{0,40}(direkomendasikan|dipilih|dipakai|muncul))|(jelaskan (alasan|keputusan)|(alasan|penjelasan) (rekomendasi|jawaban|sistem ai))/i, "explain"],
]

const GREETING_PATTERN = /^(hai|halo|hi|hey|selamat|hello|pagi|siang|sore|malam|permisi|permintaan|mohon)[\s!.,]*$/i
const NEGATION_PATTERN = /\b(tidak|bukan|jangan|gak|nggak|ga|ngga|skip|lewati)\b/i

function ruleBasedDetect(query: string): { primary: AgentIntent; confidence: number } {
  const t = query.toLowerCase().trim()
  if (GREETING_PATTERN.test(t)) return { primary: "greeting", confidence: 0.95 }

  let best: AgentIntent = "tutor"
  let bestConfidence = 0.3

  for (const [pattern, intent] of [RULE_PATTERNS[0], ...RULE_PATTERNS.slice(1)] as [RegExp, AgentIntent][]) {
    const m = pattern.exec(t)
    if (m) {
      // Cek negasi pada teks SEBELUM match (bukan karakter pertama query — bug lama)
      const before = t.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0)
      if (!NEGATION_PATTERN.test(before)) {
        // Deterministik — Math.random() membuat confidence tidak bisa diuji/dilacak.
        // explain lebih spesifik dari recommender/tutor → prioritas lebih tinggi.
        const conf = intent === "explain" ? 0.85 : 0.75
        if (conf > bestConfidence) {
          best = intent
          bestConfidence = conf
        }
      }
    }
  }

  return { primary: best, confidence: bestConfidence }
}

export async function detectIntent(
  query: string,
  opts?: { history?: ChatMessage[]; materis?: { id: string; judul: string }[] }
): Promise<DetectedIntent> {
  const ruleResult = ruleBasedDetect(query)

  if (!geminiEnabled()) {
    return {
      primary: ruleResult.primary,
      secondary: null,
      mentionedMateri: extractMateriMentionLocal(query, opts?.materis || []),
      confidence: ruleResult.confidence,
      rewrittenQuery: query,
    }
  }

  try {
    const materiList = opts?.materis?.slice(0, 20).map((m) => `- "${m.judul}" (id: ${m.id})`).join("\n") || "(tidak ada materi terdaftar)"

    const historyContext = opts?.history?.slice(-6).map((m) =>
      `${m.role === "user" ? "Siswa" : "AI"}: ${m.content.slice(0, 200)}`
    ).join("\n") || "(percakapan baru)"

    const prompt = `Analisis pesan siswa dalam konteks pembelajaran. Tentukan:
1. primaryIntent: satu dari [tutor, assessor, recommender, adaptive, mastery, analytics, warning, explain, greeting]
2. secondaryIntent: intent sekunder jika ada (atau null)
3. mentionedMateri: ID materi yang spesifik disebutkan siswa (salin persis id dari daftar di bawah; jika tidak ada yang disebut, null)
4. confidence: 0-1
5. rewrittenQuery: perjelas/standardisasi query siswa (typo fix, singkatan diperpanjang)

Pola dasar:
- tutor: tanya penjelasan konsep, definisi, "apa itu", "jelaskan", "bagaimana caranya"
- assessor: minta latihan, soal, quiz, ujian, "tes aku", "ujian tentang"
- recommender: minta saran materi, "belajar apa", "rekomendasikan"
- adaptive: minta jalur/rencana belajar, "learning path", "atur jalur"
- mastery: tanya penguasaan/level, "seberapa kuat", "kompetensiku"
- analytics: tanya statistik/grafik perkembangan
- warning: tanya peringatan/risiko, "nilai turun", "tidak aktif"
- explain: tanya alasan/penjelasan keputusan AI
- greeting: sapaan singkat tanpa instruksi belajar spesifik

Jika ada negasi (tidak/bukan/jangan), JANGAN arahkan ke intent yang dinegasi.

Daftar materi:
${materiList}

Riwayat percakapan:
${historyContext}

Pesan siswa: "${query}"

Keluarkan HANYA JSON valid: {"primaryIntent":"...","secondaryIntent":null,"mentionedMateri":null,"confidence":0.8,"rewrittenQuery":"..."}`

    const raw = await generateContent(
      "Kamu adalah Orchestrator Agent yang mengklasifikasi niat siswa dalam sistem e-learning. Selalu jawab dengan JSON valid.",
      prompt,
      { temperature: 0.1, cache: false }
    )

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON")

    const parsed = JSON.parse(jsonMatch[0])
    const validIntents: AgentIntent[] = ["tutor", "assessor", "recommender", "adaptive", "mastery", "analytics", "warning", "explain", "greeting"]

    const primary = validIntents.includes(parsed.primaryIntent) ? parsed.primaryIntent : ruleResult.primary
    const secondary = parsed.secondaryIntent && validIntents.includes(parsed.secondaryIntent) ? parsed.secondaryIntent : null

    // Validasi kontrak: mentionedMateri HARUS id yang ada di daftar.
    // Jika LLM mengembalikan judul/teks lain, jatuh ke deteksi lokal (berbasis id).
    const validIds = new Set((opts?.materis || []).map((m) => m.id))
    const llmMateri = typeof parsed.mentionedMateri === "string" && validIds.has(parsed.mentionedMateri)
      ? parsed.mentionedMateri
      : null

    return {
      primary,
      secondary,
      mentionedMateri: llmMateri || extractMateriMentionLocal(query, opts?.materis || []),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : ruleResult.confidence,
      rewrittenQuery: typeof parsed.rewrittenQuery === "string" && parsed.rewrittenQuery.length > 5 ? parsed.rewrittenQuery : query,
    }
  } catch {
    return {
      primary: ruleResult.primary,
      secondary: null,
      mentionedMateri: extractMateriMentionLocal(query, opts?.materis || []),
      confidence: ruleResult.confidence,
      rewrittenQuery: query,
    }
  }
}

function extractMateriMentionLocal(query: string, materis: { id: string; judul: string }[]): string | null {
  const t = query.toLowerCase()
  let bestMatch: string | null = null
  let bestLen = 0

  for (const m of materis) {
    if (!m.judul) continue
    const judul = m.judul.toLowerCase()
    if (t.includes(judul) && judul.length > bestLen) {
      bestMatch = m.id
      bestLen = judul.length
    }
  }

  if (bestMatch) return bestMatch

  for (const m of materis) {
    if (!m.judul) continue
    const words = m.judul.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    const matched = words.filter((w) => t.includes(w))
    if (matched.length >= Math.ceil(words.length * 0.6) && matched.length > bestLen) {
      bestMatch = m.id
      bestLen = matched.length
    }
  }

  return bestMatch
}

export function extractMateriMention(query: string, materis: { id: string; judul: string }[]): string | null {
  return extractMateriMentionLocal(query, materis)
}

export function buildConversationHistory(
  messages: { role: string; konten: string }[]
): ChatMessage[] {
  return messages.slice(-10).map((m) => ({
    role: m.role === "siswa" ? "user" : "model",
    content: m.konten.slice(0, 500),
  }))
}
