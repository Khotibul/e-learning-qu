import { prisma } from "@/lib/prisma"
import { embedText, generateContent, geminiEnabled } from "./gemini"
import { retrieveTopK, retrieveTopKKeyword, type ChunkLike } from "./retrieval"

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
}

const SYSTEM_PROMPT = `Kamu adalah Tutor AI (Agent Tutor) dalam sistem Multi-Agent Learning yang membantu siswa belajar.
Jawablah dalam Bahasa Indonesia yang ramah, jelas, dan terstruktur.
Gunakan HANYA konteks dari materi yang diberikan (ditandai [S1], [S2], dst). Jika konteks tidak memuat jawaban, katakan jujur bahwa materi belum tersedia dan sarankan bertanya ke guru.
Sebutkan sumber materi yang kamu gunakan di akhir jawaban, misalnya: "Sumber: [judul materi]".`

export async function runTutorAgent(query: string, opts: { mapelId?: string | null }): Promise<TutorResult> {
  const where = opts.mapelId
    ? { mataPelajaranId: opts.mapelId }
    : {}
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
    }
  }

  let hasil: { chunk: (typeof chunks)[number]; skor: number }[] = []
  let fallback = false

  try {
    if (geminiEnabled()) {
      const qEmbed = await embedText(query)
      hasil = retrieveTopK(chunks as ChunkLike[], qEmbed, 5, 0.25) as never as { chunk: (typeof chunks)[number]; skor: number }[]
    } else {
      hasil = retrieveTopKKeyword(chunks as ChunkLike[], query, 5) as never as { chunk: (typeof chunks)[number]; skor: number }[]
      fallback = true
    }
  } catch (e) {
    console.error("Retrieval error:", e)
    hasil = retrieveTopKKeyword(chunks as ChunkLike[], query, 5) as never as { chunk: (typeof chunks)[number]; skor: number }[]
    fallback = true
  }

  if (hasil.length === 0) {
    hasil = [chunks.slice(0, 3)].flat().map((c) => ({ chunk: c, skor: 0 }))
  }

  const konteks = hasil
    .map((h, i) => `[S${i + 1}] (${h.chunk.materi.mataPelajaran.nama} - ${h.chunk.materi.judul})\n${h.chunk.text}`)
    .join("\n\n---\n\n")

  let jawaban: string
  try {
    if (geminiEnabled()) {
      jawaban = await generateContent(SYSTEM_PROMPT, `Konteks materi:\n${konteks}\n\nPertanyaan siswa:\n${query}`)
    } else {
      throw new Error("no key")
    }
  } catch (e: any) {
    fallback = true
    const excerpts = hasil
      .map((h) => `• ${h.chunk.materi.judul}: ${h.chunk.text.slice(0, 220)}...`)
      .join("\n")
    jawaban = `(Mode tanpa API AI) Berdasarkan materi yang tersedia:\n\n${excerpts}\n\nPelajari bagian tersebut untuk menjawab pertanyaan "${query}".`
  }

  const sumber: SumberRAG[] = hasil.map((h) => ({
    materiId: h.chunk.materi.id,
    judul: h.chunk.materi.judul,
    mapel: h.chunk.materi.mataPelajaran.nama,
    excerpt: h.chunk.text.slice(0, 200),
    skor: Math.round(h.skor * 100),
  }))

  return { agent: "tutor", jawaban, sumber, fallback }
}
