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
    : learningStyle === "AUDITORI" ? "Gunakan penjelasan naratif, langkah-langkah verbal, dan analogi sehari-hari."
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

export async function runTutorAgent(
  query: string,
  opts: {
    mapelId?: string | null
    history?: ChatMessage[]
    studentId?: string
    masteryAvg?: number
    learningStyle?: string
    streakDays?: number
  }
): Promise<TutorResult> {
  const where = opts.mapelId ? { mataPelajaranId: opts.mapelId } : {}
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

  if (hasil.length === 0) {
    const fallbackChunks = chunks.slice(0, 3).map((c) => ({ chunk: c, skor: 0 }))
    const konteks = fallbackChunks
      .map((h, i) => `[S${i + 1}] (${(h.chunk as any).materi?.mataPelajaran?.nama ?? ""} - ${(h.chunk as any).materi?.judul ?? ""})\n${h.chunk.text}`)
      .join("\n\n---\n\n")

    return {
      agent: "tutor",
      jawaban: `Maaf, saya tidak menemukan konten yang relevan dengan pertanyaanmu "${query.slice(0, 100)}".\n\nNamun berikut materi yang tersedia:\n\n${fallbackChunks.map((h) => `• **${(h.chunk as any).materi?.judul ?? ""}** (${(h.chunk as any).materi?.mataPelajaran?.nama ?? ""})`).join("\n")}\n\nCoba jelaskan pertanyaanmu dengan kata-kata yang berbeda, atau pilih materi spesifik.`,
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
    const excerpts = hasil
      .map((h) => {
        const relevance = Math.round(h.skor * 100)
        return `• **${(h.chunk as any).materi?.judul ?? ""}** (relevansi: ${relevance}%)\n  ${h.chunk.text.slice(0, 250)}...`
      })
      .join("\n\n")
    jawaban = `(Mode tanpa API AI) Berdasarkan materi yang tersedia:\n\n${excerpts}\n\nPelajari bagian tersebut untuk menjawab pertanyaan "${query.slice(0, 100)}".`
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
