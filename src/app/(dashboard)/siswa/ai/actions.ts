"use server"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCurrentSiswa } from "../actions"
import { detectIntent, extractMateriMention } from "@/lib/agents/orchestrator"
import { runTutorAgent } from "@/lib/agents/tutor"
import { generateQuiz, gradeQuiz } from "@/lib/agents/assessor"
import { runRecommenderAgent } from "@/lib/agents/recommender"

async function logAgent(siswaId: string, data: {
  agent: string
  tipe?: string
  query: string
  hasil?: string
  sumber?: unknown
  durasiMs?: number
  model?: string
  sukses: boolean
  pesanError?: string
}) {
  await prisma.agentLog.create({ data: { siswaId, ...data, sumber: data.sumber as never | undefined } })
}

export async function aiIndexData() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [sessions, mapels] = await Promise.all([
    prisma.chatSession.findMany({
      where: { siswaId: siswa.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      take: 20,
    }),
    prisma.mataPelajaran.findMany({
      where: { deletedAt: null },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ])
  return { sessions, mapels }
}

export async function aiChat(input: { sessionId?: string | null; mapelId?: string | null; pesan: string }) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  const start = Date.now()
  const pesan = input.pesan.trim()
  if (!pesan) throw new Error("Pesan kosong")

  let session = null
  if (input.sessionId) {
    session = await prisma.chatSession.findFirst({ where: { id: input.sessionId, siswaId: siswa.id } })
  }
  if (!session) {
    session = await prisma.chatSession.create({
      data: { siswaId: siswa.id, mapelId: input.mapelId || null, judul: pesan.slice(0, 40) },
    })
  }
  await prisma.chatMessage.create({ data: { sessionId: session.id, role: "siswa", konten: pesan } })

  const intent = detectIntent(pesan)
  let jawaban = ""
  let sumber: unknown = null
  let latihan: any = null
  let agent = intent

  try {
    if (intent === "assessor") {
      agent = "assessor"
      const materis = await prisma.materi.findMany({
        where: { deletedAt: null, ...(input.mapelId ? { mataPelajaranId: input.mapelId } : {}) },
        select: { id: true, judul: true, mataPelajaran: { select: { nama: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      const mention = extractMateriMention(pesan, materis)
      const materi = materis.find((m) => m.id === mention) || materis[0]
      if (!materi) {
        jawaban = "Belum ada materi untuk dibuatkan latihan. Pilih mata pelajaran yang memiliki materi terlebih dahulu."
      } else {
        const chunks = await prisma.materiChunk.findMany({
          where: { materiId: materi.id },
          orderBy: { index: "asc" },
        })
        if (chunks.length === 0) {
          jawaban = `Materi "${materi.judul}" belum diindeks ke knowledge base AI. Minta guru untuk mengindeksnya melalui menu AI Knowledge Base.`
        } else {
          const soal = await generateQuiz(chunks.map((c) => c.text))
          if (soal.length === 0) throw new Error("Gagal membuat soal")
          latihan = await prisma.latihanAI.create({
            data: { siswaId: siswa.id, materiId: materi.id, soal: soal as never },
            include: { materi: { select: { judul: true } } },
          })
          jawaban = `Assessor Agent membuat ${soal.length} soal latihan untuk materi *"${materi.judul}"* (${materi.mataPelajaran.nama}). Kerjakan di bawah ini!`
        }
      }
    } else if (intent === "recommender") {
      agent = "recommender"
      const { rekomendasi, mode } = await runRecommenderAgent(siswa.id)
      sumber = { mode, jumlah: rekomendasi.length }
      if (rekomendasi.length === 0) {
        jawaban = "Belum ada rekomendasi. Isi nilai di mapel tertentu terlebih dahulu atau tambahkan materi oleh guru, lalu coba lagi."
      } else {
        jawaban =
          `Berikut rekomendasi materi untuk kamu (mode: ${mode === "ai" ? "AI" : "aturan"}):\n\n` +
          rekomendasi
            .map((r, i) => `${i + 1}. **${r.judul}** (${r.mapel})${r.nilaiRata != null ? ` — rata-rata nilai ${r.nilaiRata}` : ""}\n   ${r.alasan}`)
            .join("\n")
      }
    } else {
      const res = await runTutorAgent(pesan, { mapelId: input.mapelId || null })
      jawaban = res.jawaban
      sumber = res.sumber
    }

    await logAgent(siswa.id, {
      agent,
      tipe: intent,
      query: pesan,
      hasil: jawaban.slice(0, 2000),
      sumber,
      durasiMs: Date.now() - start,
      sukses: true,
    })
  } catch (e: any) {
    await logAgent(siswa.id, {
      agent,
      tipe: intent,
      query: pesan,
      durasiMs: Date.now() - start,
      sukses: false,
      pesanError: e?.message?.slice(0, 500),
    })
    jawaban = `Maaf, terjadi kesalahan pada agent: ${e?.message || "kesalahan tidak diketahui"}`
  }

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "asisten",
      agent,
      konten: jawaban,
      sumber: (sumber ?? null) as any,
    },
  })

  return { sessionId: session.id, message, latihan }
}

export async function aiJawabLatihan(latihanId: string, jawaban: Record<number, string>) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  const start = Date.now()

  const latihan = await prisma.latihanAI.findFirst({ where: { id: latihanId, siswaId: siswa.id } })
  if (!latihan) throw new Error("Latihan tidak ditemukan")
  if (latihan.skor != null) return { skor: latihan.skor, umpanBalik: latihan.umpanBalik, perSoal: null }

  const hasil = await gradeQuiz(latihan.soal as never, jawaban)
  await prisma.latihanAI.update({
    where: { id: latihan.id },
    data: { jawaban: jawaban as never, skor: hasil.skor, umpanBalik: hasil.umpanBalik },
  })
  await logAgent(siswa.id, {
    agent: "assessor",
    tipe: "penilaian_latihan",
    query: "Penilaian latihan AI",
    hasil: `Skor ${hasil.skor}/100`,
    durasiMs: Date.now() - start,
    sukses: true,
  })
  return hasil
}

export async function aiDashboard() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [rekom, latihan] = await Promise.all([
    runRecommenderAgent(siswa.id),
    prisma.latihanAI.aggregate({
      where: { siswaId: siswa.id },
      _avg: { skor: true },
      _count: { _all: true },
    }),
  ])
  return {
    rekomendasi: rekom.rekomendasi.slice(0, 3),
    mode: rekom.mode,
    totalLatihan: latihan._count._all,
    rataSkor: latihan._avg.skor ? Math.round(latihan._avg.skor) : null,
  }
}

export async function aiAnalitikData() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [logs, byAgent, stat, suksesCount, gagalCount] = await Promise.all([
    prisma.agentLog.findMany({
      where: { siswaId: siswa.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.agentLog.groupBy({
      by: ["agent"],
      where: { siswaId: siswa.id },
      _count: { _all: true },
      _avg: { durasiMs: true },
    }),
    prisma.agentLog.aggregate({
      where: { siswaId: siswa.id },
      _count: { _all: true },
      _avg: { durasiMs: true },
    }),
    prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: true } }),
    prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: false } }),
  ])

  const perAgent = byAgent
    .map((a) => ({
      agent: a.agent,
      total: a._count._all,
      rataDurasi: a._avg.durasiMs ?? 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    logs,
    perAgent,
    statistik: {
      totalRuns: stat._count._all,
      sukses: suksesCount,
      gagal: gagalCount,
      rataDurasi: (stat._avg.durasiMs ?? 0) / 1000,
    },
  }
}
