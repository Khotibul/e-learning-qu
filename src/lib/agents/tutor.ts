import { prisma } from "@/lib/prisma"
import { generateContent, generateContentWithHistory, geminiEnabled } from "./gemini"
import { retrieveHybrid, type ChunkLike } from "./retrieval"
import { embedText } from "./gemini"

export interface SumberRAG {
  materiId: string
  judul: string
  mapel: string
  excerpt: string
  skor: number
}

export interface TutorResult {
  agent: "tutor"
  jawaban: string
  sumber: SumberRAG[]
  fallback: boolean
  confidence: number
}

interface ChatMessage {
  role: "user" | "model"
  content: string
}

function getDifficultyLevel(masteryAvg: number): string {
  if (masteryAvg >= 80) return "lanjutan (siswa sudah menguasai dasar, berikan analisis mendalam)"
  if (masteryAvg >= 60) return "menengah (siswa memahami konsep dasar, tambahkan contoh aplikatif)"
  if (masteryAvg >= 40) return "dasar (siswa masih dalam tahap pemahaman, gunakan bahasa sederhana)"
  return "pemula (siswa baru belajar, jelaskan dari nol dengan contoh konkret)"
}

function buildAdaptiveSystemPrompt(masteryAvg: number, learningStyle: string, streakDays: number): string {
  const difficulty = getDifficultyLevel(masteryAvg)
  const styleHint = learningStyle === "VISUAL" ? "Gunakan analogi visual, diagram teks, dan perbandingan."
    : learningStyle === "AUDITORY" ? "Gunakan penjelasan naratif, langkah-langkah verbal, dan analogi sehari-hari."
    : learningStyle === "KINESTHETIC" ? "Berikan contoh praktis, latihan langkah demi langkah, dan simulasi."
    : "Gunakan pendekatan seimbang dengan contoh bervariasi."

  const motivationHint = streakDays > 7
    ? "Siswa sangat konsisten — berikan pujian dan tantangan lebih."
    : streakDays > 3
    ? "Siswa cukup aktif — berikan dorongan untuk mempertahankan."
    : "Siswa perlu motivasi tambahan — buat penjelasan menarik dan relevan dengan kehidupan sehari-hari."

  return `Kamu adalah Tutor AI (Agent Tutor) dalam sistem Multi-Agent Learning yang membantu siswa belajar.

KARAKTERISTIK SISWA SAAT INI:
- Level pemahaman: ${difficulty}
- Gaya belajar terdeteksi: ${learningStyle}
- ${motivationHint}

ATURAN MENJAWAB:
1. Jawablah dalam Bahasa Indonesia yang ramah, jelas, dan terstruktur.
2. Sesuaikan kedalaman jawaban dengan level pemahaman siswa.
3. Gunakan HANYA konteks dari materi yang diberikan (ditandai [S1], [S2], dst).
4. Jika konteks tidak memuat jawaban, katakan jujur bahwa materi belum tersedia.
5. Akhiri dengan pertanyaan follow-up untuk memastikan pemahaman.
6. Sebutkan sumber materi yang kamu gunakan.
7. ${styleHint}
8. Jika siswa menanyakan hal yang sama berulang, jelaskan dengan sudut pandang berbeda.

RESPONS MUST BE STRUCTURED:
- Gunakan heading/bold untuk sub-topik
- Gunakan numbering untuk langkah-langkah
- Gunakan bullet untuk poin-poin penting`
}

function extractRelevantSentences(text: string, query: string, maxSentences = 5): string[] {
  const queryTokens = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2))

  const sentences = text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500)

  const scored = sentences.map((s) => {
    const sLower = s.toLowerCase()
    let score = 0
    for (const token of queryTokens) {
      if (sLower.includes(token)) score += 1
    }
    if (s.includes(":") || s.includes("adalah") || s.includes("yaitu") || s.includes("definisi")) score += 0.5
    if (s.startsWith("###") || s.startsWith("**")) score += 0.3
    return { sentence: s, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map((s) => s.sentence)
}

function synthesizeAnswer(query: string, hasil: { chunk: any; skor: number }[]): string {
  const queryLower = query.toLowerCase()
  const isDefinition = /(apa itu|definisi|pengertian|arti|mean|makna)/.test(queryLower)
  const isHowTo = /(bagaimana|cara|langkah|proses|tutorial|tutorial)/.test(queryLower)
  const isWhy = /(mengapa|kenapa|alasan|sebab|karena)/.test(queryLower)
  const isList = /(sebutkan|jelaskan|macam|jenis|tipe|variasi)/.test(queryLower)

  const allRelevantSentences: { sentence: string; source: string; score: number }[] = []
  for (const h of hasil) {
    const matapel = (h.chunk as any).materi?.mataPelajaran?.nama ?? ""
    const judul = (h.chunk as any).materi?.judul ?? ""
    const source = `${matapel} — ${judul}`
    const sentences = extractRelevantSentences(h.chunk.text, query, 4)
    for (const s of sentences) {
      allRelevantSentences.push({ sentence: s, source, score: h.skor })
    }
  }

  const seen = new Set<string>()
  const unique = allRelevantSentences.filter((s) => {
    const key = s.sentence.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let answer = ""

  if (isDefinition) {
    const definisi = unique.filter((s) =>
      s.sentence.includes("adalah") || s.sentence.includes("yaitu") || s.sentence.includes("yang dimaksud") || s.sentence.includes("merupakan")
    )
    if (definisi.length > 0) {
      answer += "**Definisi:**\n\n"
      answer += definisi.slice(0, 2).map((d) => `> ${d.sentence}`).join("\n\n") + "\n\n"
    }
  }

  if (isHowTo) {
    const steps = unique.filter((s) =>
      /\d+[\.\)]/.test(s.sentence) || s.sentence.includes("langkah") || s.sentence.includes("pertama") || s.sentence.includes("kedua")
    )
    if (steps.length > 0) {
      answer += "**Langkah-langkah:**\n\n"
      steps.forEach((s, i) => { answer += `${i + 1}. ${s.sentence}\n` })
      answer += "\n"
    }
  }

  if (!answer) {
    const topSentences = unique.slice(0, 6)
    if (topSentences.length > 0) {
      answer += "**Poin Penting:**\n\n"
      answer += topSentences.map((s) => `- ${s.sentence}`).join("\n") + "\n\n"
    }
  }

  if (!answer) {
    const topExcerpts = hasil.slice(0, 3).map((h) => {
      const judul = (h.chunk as any).materi?.judul ?? ""
      const text = h.chunk.text.slice(0, 300)
      return `**${judul}:**\n${text}...`
    })
    answer = topExcerpts.join("\n\n") + "\n\n"
  }

  const sources = [...new Set(hasil.map((h) => (h.chunk as any).materi?.judul ?? "").filter(Boolean))]
  if (sources.length > 0) {
    answer += `\n---\n📚 **Sumber:** ${sources.join(", ")}`
  }

  answer += `\n\n> 💡 Pertanyaanmu: "${query.slice(0, 80)}". Jika jawaban kurang jelas, coba jelaskan pertanyaanmu dengan kata-kata yang berbeda atau pilih materi spesifik.`

  return answer
}

export async function runTutorAgent(
  query: string,
  opts: {
    mapelId?: string | null
    kelasId?: string | null
    history?: ChatMessage[]
    studentId?: string
    masteryAvg?: number
    learningStyle?: string
    streakDays?: number
  }
): Promise<TutorResult> {
  let where: Record<string, unknown> = {}
  if (opts.mapelId) {
    where = { mataPelajaranId: opts.mapelId }
  } else if (opts.kelasId) {
    const pengajaranMapels = await prisma.pengajaran.findMany({
      where: { kelasId: opts.kelasId, deletedAt: null },
      select: { mataPelajaranId: true },
    })
    const allowedMapelIds = pengajaranMapels.map((p) => p.mataPelajaranId)
    if (allowedMapelIds.length > 0) {
      where = { mataPelajaranId: { in: allowedMapelIds } }
    }
  }
  const chunks = (await prisma.materiChunk.findMany({
    where,
    include: {
      materi: { select: { id: true, judul: true, mataPelajaran: { select: { nama: true } } } },
    },
    orderBy: { createdAt: "asc" },
  })) as (ChunkLike & { materi: { id: string; judul: string; mataPelajaran: { nama: string } } })[]

  if (chunks.length === 0) {
    return {
      agent: "tutor",
      jawaban: "Knowledge base materi belum terisi. Minta guru untuk mengindeks materi melalui menu AI Knowledge Base, lalu coba lagi.",
      sumber: [],
      fallback: true,
      confidence: 0,
    }
  }

  let queryEmbedding: number[] | null = null
  try {
    if (geminiEnabled()) {
      queryEmbedding = await embedText(query)
    }
  } catch {
    // fallback to keyword
  }

  const hasil = retrieveHybrid(chunks as ChunkLike[], query, queryEmbedding, 5, 0.6)

  // Relevance gate: hasil di bawah ambang = TIDAK RELEVAN, jangan dipakai
  // sebagai konteks LLM (sebelumnya konteks sampah menghasilkan jawaban
  // yang tidak sesuai materi — keluhan utama audit RAG).
  const MIN_RELEVANCE = 0.12
  if (hasil.length === 0 || hasil[0].skor < MIN_RELEVANCE) {
    const fallbackChunks = chunks.slice(0, 3).map((c) => ({ chunk: c, skor: 0 }))

    return {
      agent: "tutor",
      jawaban: `Maaf, saya tidak menemukan konten yang relevan dengan pertanyaanmu "${query.slice(0, 100)}" di materi yang tersedia.\n\nNamun berikut materi yang tersedia:\n\n${fallbackChunks.map((h) => `• **${(h.chunk as any).materi?.judul ?? ""}** (${(h.chunk as any).materi?.mataPelajaran?.nama ?? ""})`).join("\n")}\n\nCoba jelaskan pertanyaanmu dengan kata-kata yang berbeda, atau pilih materi spesifik.`,
      sumber: fallbackChunks.map((h) => ({
        materiId: h.chunk.materiId,
        judul: (h.chunk as any).materi?.judul ?? "",
        mapel: (h.chunk as any).materi?.mataPelajaran?.nama ?? "",
        excerpt: h.chunk.text.slice(0, 200),
        skor: 0,
      })),
      fallback: true,
      confidence: 0.1,
    }
  }

  const topScore = hasil[0].skor
  const confidence = Math.min(1, Math.max(0.1, topScore))

  const konteks = hasil
    .map((h, i) => `[S${i + 1}] (${(h.chunk as any).materi?.mataPelajaran?.nama ?? ""} - ${(h.chunk as any).materi?.judul ?? ""})\n${h.chunk.text}`)
    .join("\n\n---\n\n")

  const masteryAvg = opts.masteryAvg ?? 50
  const learningStyle = opts.learningStyle ?? "UNKNOWN"
  const streakDays = opts.streakDays ?? 0
  const systemPrompt = buildAdaptiveSystemPrompt(masteryAvg, learningStyle, streakDays)

  let jawaban: string
  let fallback = false

  try {
    if (geminiEnabled()) {
      const userMessage = `Konteks materi:\n${konteks}\n\nPertanyaan siswa:\n${query}`

      if (opts.history && opts.history.length > 0) {
        jawaban = await generateContentWithHistory(systemPrompt, opts.history.map((h) => ({ role: h.role, parts: h.content })), userMessage, { temperature: 0.4 })
      } else {
        jawaban = await generateContent(systemPrompt, userMessage, { temperature: 0.4 })
      }
    } else {
      throw new Error("no key")
    }
  } catch {
    fallback = true
    jawaban = synthesizeAnswer(query, hasil)
  }

  const sumber: SumberRAG[] = hasil.map((h) => ({
    materiId: h.chunk.materiId,
    judul: (h.chunk as any).materi?.judul ?? "",
    mapel: (h.chunk as any).materi?.mataPelajaran?.nama ?? "",
    excerpt: h.chunk.text.slice(0, 200),
    skor: Math.round(h.skor * 100),
  }))

  return { agent: "tutor", jawaban, sumber, fallback, confidence }
}
