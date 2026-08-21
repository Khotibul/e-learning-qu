"use server"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCurrentGuru } from "../actions"
import { chunkText, estimateTokens } from "@/lib/agents/chunker"
import { embedText, geminiEnabled } from "@/lib/agents/gemini"

export async function getAIKnowledgeBase() {
  const guru = await getCurrentGuru()
  if (!guru) redirect("/login")

  const [materis, chunks, mapels] = await Promise.all([
    prisma.materi.findMany({
      where: { guruId: guru.id, deletedAt: null },
      include: {
        mataPelajaran: { select: { nama: true } },
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.materiChunk.count(),
    prisma.mataPelajaran.findMany({
      where: { deletedAt: null },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ])
  return { materis, chunks, mapels, geminiEnabled: geminiEnabled() }
}

export async function indexMateri(materiId: string) {
  const guru = await getCurrentGuru()
  if (!guru) redirect("/login")

  const materi = await prisma.materi.findFirst({
    where: { id: materiId, guruId: guru.id, deletedAt: null },
  })
  if (!materi) throw new Error("Materi tidak ditemukan")

  const teks = [materi.judul, materi.deskripsi, materi.konten].filter(Boolean).join("\n\n").trim()
  if (!teks) throw new Error("Materi belum memiliki konten teks. Tambahkan deskripsi/konten pada materi.")

  const bagian = chunkText(teks)
  if (bagian.length === 0) throw new Error("Tidak ada teks yang bisa diindeks")

  await prisma.materiChunk.deleteMany({ where: { materiId } })

  let failedEmbed = false
  const rows: { index: number; text: string; tokenCount: number; embedding: number[]; materiId: string; mataPelajaranId: string }[] = []

  for (let i = 0; i < bagian.length; i++) {
    let embedding: number[] = []
    if (geminiEnabled() && !failedEmbed) {
      try {
        // Dokumen materi pakai RETRIEVAL_DOCUMENT (query siswa tetap RETRIEVAL_QUERY)
        embedding = await embedText(bagian[i], { taskType: "RETRIEVAL_DOCUMENT" })
      } catch (e) {
        console.error("Embed gagal:", e)
        failedEmbed = true
      }
    }
    rows.push({
      index: i,
      text: bagian[i],
      tokenCount: estimateTokens(bagian[i]),
      embedding,
      materiId,
      mataPelajaranId: materi.mataPelajaranId,
    })
  }

  await prisma.materiChunk.createMany({ data: rows })
  return { jumlahChunk: rows.length, modeEmbed: failedEmbed ? "keyword" : geminiEnabled() ? "semantic" : "keyword" }
}

export async function deleteMateriIndex(materiId: string) {
  const guru = await getCurrentGuru()
  if (!guru) redirect("/login")
  const materi = await prisma.materi.findFirst({
    where: { id: materiId, guruId: guru.id, deletedAt: null },
    select: { id: true },
  })
  if (!materi) throw new Error("Materi tidak ditemukan")
  await prisma.materiChunk.deleteMany({ where: { materiId } })
  return { success: true }
}
