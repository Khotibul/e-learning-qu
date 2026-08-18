"use server"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCurrentSiswa } from "../actions"
import { detectIntent, extractMateriMention } from "@/lib/agents/orchestrator"
import { runTutorAgent } from "@/lib/agents/tutor"
import { generateQuiz, gradeQuiz } from "@/lib/agents/assessor"
import { runHybridRecommender } from "@/lib/agents/hybrid-recommender"
import { updateStudentModel, getStudentModelSummary } from "@/lib/agents/student-modeling"
import { getPenguasaanOverview } from "@/lib/agents/knowledge-tracing"
import { getAdaptivePath, generateAdaptivePath } from "@/lib/agents/adaptive-learning"
import { runEarlyWarning, getStudentWarnings } from "@/lib/agents/early-warning"
import { explainRecommendation, explainMastery } from "@/lib/agents/explainable"
import { recordPretestPosttest, getNGainForMapel, submitSUSSurvey, getSUSResults, getAIEvaluationSummary } from "@/lib/agents/evaluation"

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
    switch (intent) {
      case "assessor": {
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
        break
      }

      case "recommender": {
        agent = "recommender"
        const { rekomendasi, mode } = await runHybridRecommender(siswa.id)
        sumber = { mode, jumlah: rekomendasi.length }
        if (rekomendasi.length === 0) {
          jawaban = "Belum ada rekomendasi. Isi nilai di mapel tertentu terlebih dahulu atau tambahkan materi oleh guru, lalu coba lagi."
        } else {
          jawaban =
            `Berikut rekomendasi materi untuk kamu (mode: ${mode}):\n\n` +
            rekomendasi
              .map((r, i) => `${i + 1}. **${r.judul}** (${r.mapel})${r.nilaiRata != null ? ` — rata-rata nilai ${r.nilaiRata}` : ""} [${r.sumber}]\n   ${r.alasan}`)
              .join("\n")
        }
        break
      }

      case "adaptive": {
        agent = "recommender"
        const path = await getAdaptivePath(siswa.id)
        const items = (path as any)?.items ?? []
        if (items.length === 0) {
          jawaban = "Belum ada jalur belajar yang tersedia. Kerjakan beberapa ujian atau latihan terlebih dahulu agar sistem bisa menyusun jalur belajar untukmu."
        } else {
          const pending = items.filter((i: any) => i.status === "PENDING").slice(0, 5)
          const done = items.filter((i: any) => i.status === "SELESAI").length
          jawaban = `**Jalur Belajar Adaptif** (Progres: ${Math.round(((path as any)?.progres ?? 0))}%)\n\n` +
            `Selesai: ${done}/${items.length} item\n\n` +
            `**Langkah berikutnya:**\n` +
            pending.map((p: any, i: number) => `${i + 1}. ${p.materi?.judul ?? p.kompetensi?.nama ?? p.jenis} — ${p.status}`).join("\n")
          sumber = { pathId: (path as any)?.id, totalItems: items.length, progres: (path as any)?.progres }
        }
        break
      }

      case "mastery": {
        agent = "tutor"
        const overview = await getPenguasaanOverview(siswa.id)
        if (overview.total === 0) {
          jawaban = "Belum ada data penguasaan kompetensi. Kerjakan ujian atau latihan terlebih dahulu."
        } else {
          jawaban = `**Penguasaan Kompetensi** (Rata-rata: ${overview.rataSkor}%)\n\n` +
            `**Distribusi:**\n` +
            `• Advanced: ${overview.distribusi.ADVANCED} | Proficient: ${overview.distribusi.PROFICIENT}\n` +
            `• Developing: ${overview.distribusi.DEVELOPING} | Basic: ${overview.distribusi.BASIC}\n` +
            `• Beginner: ${overview.distribusi.BEGINNER}\n\n` +
            `**Detail:**\n` +
            overview.penguasaan.slice(0, 8).map((p) => `• ${p.kode} — ${p.kompetensi}: ${p.skor}% (${p.kategori})`).join("\n")
          sumber = overview
        }
        break
      }

      case "analytics": {
        agent = "tutor"
        const [model, rekom] = await Promise.all([
          updateStudentModel(siswa.id),
          runHybridRecommender(siswa.id),
        ])
        jawaban = `**Ringkasan Profil Belajar**\n\n` +
          `• Gaya Belajar: ${model.gayaBelajar}\n` +
          `• Engagement: ${Math.round(model.engagementScore * 100)}%\n` +
          `• Motivasi: ${Math.round(model.motivasi * 100)}%\n` +
          `• Konsistensi: ${Math.round(model.konsistensi * 100)}%\n` +
          `• Streak: ${model.streak} hari\n` +
          `• Total Sesi: ${model.totalSesi}\n` +
          `• Rata-rata Nilai: ${model.rataNilai}\n\n` +
          (rekom.rekomendasi.length > 0
            ? `**Rekomendasi Teratas:** ${rekom.rekomendasi[0].judul} — ${rekom.rekomendasi[0].alasan}`
            : "")
        sumber = { model: { gayaBelajar: model.gayaBelajar, motivasi: model.motivasi, engagement: model.engagementScore } }
        break
      }

      case "warning": {
        agent = "tutor"
        const warnings = await runEarlyWarning(siswa.id)
        if (warnings.total === 0) {
          jawaban = "Tidak ada peringatan aktif. Status belajar kamu aman."
        } else {
          jawaban = `**Early Warning System** — ${warnings.total} peringatan aktif\n\n` +
            (warnings.critical > 0 ? `🔴 CRITICAL: ${warnings.critical}\n` : "") +
            (warnings.high > 0 ? `🟠 HIGH: ${warnings.high}\n` : "") +
            `\n**Detail:**\n` +
            warnings.warnings.map((w) => `• [${w.severity}] ${w.message}`).join("\n")
        }
        sumber = warnings
        break
      }

      case "explain": {
        agent = "tutor"
        jawaban = "Untuk penjelasan keputusan AI, kunjungi halaman **Profil Belajar** di mana kamu bisa melihat detail mengapa materi direkomendasikan dan bagaimana skor penguasaan dihitung."
        break
      }

      default: {
        const res = await runTutorAgent(pesan, { mapelId: input.mapelId || null })
        jawaban = res.jawaban
        sumber = res.sumber
        break
      }
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

  const { updatePenguasaanAfterLatihan } = await import("@/lib/agents/knowledge-tracing")
  await updatePenguasaanAfterLatihan(siswa.id, latihan.materiId, hasil.skor)

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

  const [rekom, latihan, model, warnings] = await Promise.all([
    runHybridRecommender(siswa.id),
    prisma.latihanAI.aggregate({
      where: { siswaId: siswa.id },
      _avg: { skor: true },
      _count: { _all: true },
    }),
    getStudentModelSummary(siswa.id),
    prisma.earlyWarning.count({ where: { siswaId: siswa.id, isResolved: false } }),
  ])
  return {
    rekomendasi: rekom.rekomendasi.slice(0, 3),
    mode: rekom.mode,
    totalLatihan: latihan._count._all,
    rataSkor: latihan._avg.skor ? Math.round(latihan._avg.skor) : null,
    profile: {
      gayaBelajar: model.profile.gayaBelajar,
      motivasi: Math.round(model.profile.motivasi * 100),
      engagement: Math.round(model.profile.engagementScore * 100),
      streak: model.profile.streak,
    },
    openWarnings: warnings,
  }
}

export async function aiAnalitikData() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [logs, byAgent, stat, suksesCount, gagalCount, model, penguasaan] = await Promise.all([
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
    updateStudentModel(siswa.id),
    getPenguasaanOverview(siswa.id),
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
    profile: {
      gayaBelajar: model.gayaBelajar,
      motivasi: Math.round(model.motivasi * 100),
      engagement: Math.round(model.engagementScore * 100),
      konsistensi: Math.round(model.konsistensi * 100),
      streak: model.streak,
    },
    penguasaan,
  }
}

export { generateAdaptivePath, recordPretestPosttest, getNGainForMapel, getAIEvaluationSummary }

export async function getStudentModelSummaryAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return getStudentModelSummary(siswa.id)
}

export async function getPenguasaanOverviewAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return getPenguasaanOverview(siswa.id)
}

export async function getAdaptivePathAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return getAdaptivePath(siswa.id)
}

export async function getStudentWarningsAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return getStudentWarnings(siswa.id)
}

export async function runEarlyWarningAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return runEarlyWarning(siswa.id)
}

export async function explainMasteryAction(kompetensiId: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return explainMastery(siswa.id, kompetensiId)
}

export async function submitSUSSurveyAction(jawaban: number[], komentar?: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return submitSUSSurvey(siswa.id, jawaban, komentar)
}

export async function getSUSResultsAction() {
  return getSUSResults()
}

export async function getAIEvaluationSummaryAction(periode?: string) {
  return getAIEvaluationSummary(periode)
}
