"use server"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCurrentSiswa } from "../actions"
import { detectIntent, extractMateriMention, buildConversationHistory, type DetectedIntent } from "@/lib/agents/orchestrator"
import { runTutorAgent } from "@/lib/agents/tutor"
import { generateQuiz, gradeQuiz } from "@/lib/agents/assessor"
import { runHybridRecommender } from "@/lib/agents/hybrid-recommender"
import { updateStudentModel, getStudentModelSummary } from "@/lib/agents/student-modeling"
import { getPenguasaanOverview, updatePenguasaanAfterLatihan } from "@/lib/agents/knowledge-tracing"
import { getAdaptivePath, generateAdaptivePath } from "@/lib/agents/adaptive-learning"
import { runEarlyWarning, getStudentWarnings } from "@/lib/agents/early-warning"
import { explainRecommendation, explainMastery, explainEarlyWarning } from "@/lib/agents/explainable"
import { recordPretestPosttest, getNGainForMapel, submitSUSSurvey, getSUSResults, getAIEvaluationSummary } from "@/lib/agents/evaluation"
import { trackAiChat, trackLatihanDimulai, trackLatihanSelesai, trackPretest, trackPosttest } from "@/lib/agents/learning-analytics"
import { submitFeedback, computeQualityMetrics, getRecentFeedback, getMessageFeedback } from "@/lib/agents/feedback"

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
  return prisma.agentLog.create({ data: { siswaId, ...data, sumber: data.sumber as never | undefined } })
}

async function autoEarlyWarning(siswaId: string) {
  try { await runEarlyWarning(siswaId) } catch { /* silent */ }
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

async function requireRole(...roles: string[]) {
  const session = await auth()
  if (!session?.user || !roles.includes((session.user as any).role)) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function aiChat(input: { sessionId?: string | null; mapelId?: string | null; pesan: string }) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  const start = Date.now()
  // Phase 17 Observability: traceId untuk melacak satu siklus orchestration
  const traceId = crypto.randomUUID().slice(0, 8)
  const trace = (step: string, detail?: string) =>
    console.log(`[AI TRACE ${traceId}] ${step}${detail ? ` — ${detail}` : ""}`)

  trace("orchestrator start", `mapel=${input.mapelId ?? "all"}`)
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
  trackAiChat(siswa.id, session.id, input.mapelId ?? undefined).catch(() => {})

  const existingMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, konten: true },
  })
  const chatHistory = buildConversationHistory(existingMessages.slice(0, -1))

  const materis = await prisma.materi.findMany({
    where: { deletedAt: null, ...(input.mapelId ? { mataPelajaranId: input.mapelId } : {}) },
    select: { id: true, judul: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const intentResult: DetectedIntent = await detectIntent(pesan, { history: chatHistory, materis })
  const intent = intentResult.primary
  const queryToUse = intentResult.rewrittenQuery || pesan
  trace("intent detected", `${intent} (conf=${intentResult.confidence.toFixed(2)})`)
  let jawaban = ""
  let sumber: unknown = null
  let latihan: any = null
  let agent = intent

  const [modelSummary, penguasaanOverview] = await Promise.all([
    getStudentModelSummary(siswa.id),
    getPenguasaanOverview(siswa.id),
  ])

  try {
    switch (intent) {
      case "greeting": {
        agent = "tutor"
        const streak = modelSummary.profile.streak
        const motivasi = Math.round(modelSummary.profile.motivasi * 100)
        jawaban = `Hai! Selamat datang kembali! 👋\n\n` +
          `📊 Status belajarmu: streak ${streak} hari, motivasi ${motivasi}%\n` +
          `🎯 Gaya belajar: ${modelSummary.profile.gayaBelajar}\n\n` +
          `Ada yang bisa saya bantu? Tanyakan materi, minta latihan, atau lihat rekomendasi belajar.`
        break
      }

      case "assessor": {
        agent = "assessor"
        const mention = intentResult.mentionedMateri
        const materi = materis.find((m) => m.id === mention)

        // Guard kontrak: tanpa materi target yang jelas, JANGAN pilih
        // materis[0] secara arbitrer (bug audit M2) — minta siswa memilih.
        if (!materi) {
          if (materis.length === 1) {
            const satu = materis[0]
            const chunksSatu = await prisma.materiChunk.findMany({
              where: { materiId: satu.id },
              orderBy: { index: "asc" },
            })
            if (chunksSatu.length === 0) {
              jawaban = `Materi "${satu.judul}" belum diindeks ke knowledge base AI. Minta guru untuk mengindeksnya.`
              break
            }
            const histSatu = await prisma.latihanAI.findMany({
              where: { siswaId: siswa.id, materiId: satu.id },
              select: { skor: true },
              orderBy: { createdAt: "desc" },
              take: 5,
            })
            const soalSatu = await generateQuiz(chunksSatu.map((c) => c.text), {
              history: histSatu.filter((l) => l.skor != null).map((l) => ({ skor: l.skor! })),
              learningStyle: modelSummary.profile.gayaBelajar,
            })
            if (soalSatu.length === 0) throw new Error("Gagal membuat soal")
            latihan = await prisma.latihanAI.create({
              data: { siswaId: siswa.id, materiId: satu.id, soal: soalSatu as never },
              include: { materi: { select: { judul: true } } },
            })
            trackLatihanDimulai(siswa.id, latihan.id, input.mapelId ?? undefined).catch(() => {})
            jawaban = `Assessor Agent membuat ${soalSatu.length} soal latihan adaptif untuk materi *"${satu.judul}"*.\n\nKerjakan di bawah ini!`
            break
          }

          const daftar = materis.slice(0, 5).map((m, i) => `${i + 1}. ${m.judul}`).join("\n")
          jawaban = `Materi mana yang ingin kamu latih? Sebutkan judulnya, contoh: *"buatkan latihan [judul materi]"*.\n\nMateri tersedia:\n${daftar}`
          break
        }

        const chunks = await prisma.materiChunk.findMany({
          where: { materiId: materi.id },
          orderBy: { index: "asc" },
        })
        if (chunks.length === 0) {
          jawaban = `Materi "${materi.judul}" belum diindeks ke knowledge base AI. Minta guru untuk mengindeksnya.`
        } else {
          const latihanHistory = await prisma.latihanAI.findMany({
            where: { siswaId: siswa.id, materiId: materi.id },
            select: { skor: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })

          const soal = await generateQuiz(chunks.map((c) => c.text), {
            history: latihanHistory.filter((l) => l.skor != null).map((l) => ({ skor: l.skor! })),
            learningStyle: modelSummary.profile.gayaBelajar,
          })
          if (soal.length === 0) throw new Error("Gagal membuat soal")
          latihan = await prisma.latihanAI.create({
            data: { siswaId: siswa.id, materiId: materi.id, soal: soal as never },
            include: { materi: { select: { judul: true } } },
          })
          trackLatihanDimulai(siswa.id, latihan.id, input.mapelId ?? undefined).catch(() => {})
          jawaban = `Assessor Agent membuat ${soal.length} soal latihan adaptif untuk materi *"${materi.judul}"*.\n` +
            `📊 Level soal disesuaikan dengan riwayat belajarmu.\n\nKerjakan di bawah ini!`
        }
        break
      }

      case "recommender": {
        agent = "recommender"
        const { rekomendasi, mode } = await runHybridRecommender(siswa.id, {
          engagementScore: modelSummary.profile.engagementScore,
          gayaBelajar: modelSummary.profile.gayaBelajar,
        })
        sumber = { mode, jumlah: rekomendasi.length }
        if (rekomendasi.length === 0) {
          jawaban = "Belum ada rekomendasi. Isi nilai di mapel tertentu terlebih dahulu atau tambahkan materi oleh guru."
        } else {
          jawaban = `**Rekomendasi Personal** (mode: ${mode}):\n\n` +
            rekomendasi.slice(0, 5).map((r, i) =>
              `${i + 1}. **${r.judul}** (${r.mapel}) [${r.tipeRekomendasi}]\n   ${r.alasan}`
            ).join("\n\n")
        }
        break
      }

      case "adaptive": {
        agent = "recommender"
        const path = await getAdaptivePath(siswa.id)
        const items = (path as any)?.items ?? []
        if (items.length === 0) {
          jawaban = "Belum ada jalur belajar. Kerjakan beberapa ujian atau latihan terlebih dahulu."
        } else {
          const pending = items.filter((i: any) => i.status === "PENDING").slice(0, 5)
          const done = items.filter((i: any) => i.status === "SELESAI").length
          jawaban = `**Jalur Belajar Adaptif** (${Math.round((path as any)?.progres ?? 0)}% selesai)\n\n` +
            `Selesai: ${done}/${items.length}\n\n**Langkah berikutnya:**\n` +
            pending.map((p: any, i: number) => `${i + 1}. ${p.judul || p.jenis} — ${p.difficulty || "medium"}`).join("\n")
          sumber = { pathId: (path as any)?.id, totalItems: items.length }
        }
        break
      }

      case "mastery": {
        agent = "tutor"
        if (penguasaanOverview.total === 0) {
          jawaban = "Belum ada data penguasaan. Kerjakan ujian atau latihan terlebih dahulu."
        } else {
          jawaban = `**Penguasaan Kompetensi** (Rata-rata: ${penguasaanOverview.rataSkor}%)\n\n` +
            `**Distribusi:**\n` +
            `• Advanced: ${penguasaanOverview.distribusi.ADVANCED} | Proficient: ${penguasaanOverview.distribusi.PROFICIENT}\n` +
            `• Developing: ${penguasaanOverview.distribusi.DEVELOPING} | Basic: ${penguasaanOverview.distribusi.BASIC}\n` +
            `• Beginner: ${penguasaanOverview.distribusi.BEGINNER}\n\n` +
            `**Detail:**\n` +
            penguasaanOverview.penguasaan.slice(0, 8).map((p) =>
              `• ${p.kode} — ${p.kompetensi}: ${p.skor}% (${p.kategori})${p.projectedSkor < p.skor ? ` ⚠️ projected: ${p.projectedSkor}%` : ""}`
            ).join("\n")
          sumber = penguasaanOverview
        }
        break
      }

      case "analytics": {
        agent = "tutor"
        jawaban = `**Profil Belajar**\n\n` +
          `• Gaya Belajar: ${modelSummary.profile.gayaBelajar}\n` +
          `• Engagement: ${Math.round(modelSummary.profile.engagementScore * 100)}%\n` +
          `• Motivasi: ${Math.round(modelSummary.profile.motivasi * 100)}%\n` +
          `• Konsistensi: ${Math.round(modelSummary.profile.konsistensi * 100)}%\n` +
          `• Streak: ${modelSummary.profile.streak} hari\n` +
          `• Penguasaan rata-rata: ${penguasaanOverview.rataSkor}%`
        sumber = { model: modelSummary.profile }
        break
      }

      case "warning": {
        agent = "tutor"
        const warnings = await runEarlyWarning(siswa.id)
        if (warnings.total === 0) {
          jawaban = "Tidak ada peringatan aktif. Status belajar kamu aman."
        } else {
          jawaban = `**Early Warning** — ${warnings.total} peringatan aktif\n\n` +
            (warnings.critical > 0 ? `🔴 CRITICAL: ${warnings.critical}\n` : "") +
            (warnings.high > 0 ? `🟠 HIGH: ${warnings.high}\n` : "") +
            (warnings.medium > 0 ? `🟡 MEDIUM: ${warnings.medium}\n` : "") +
            `\n**Detail:**\n` +
            warnings.warnings.map((w) => `• [${w.severity}] ${w.message}`).join("\n")
          if (warnings.predictions.length > 0) {
            jawaban += `\n\n**Prediksi:**\n` +
              warnings.predictions.map((p) => `• ${p.reason} (${Math.round(p.probability * 100)}% dalam ${p.timeframe})`).join("\n")
          }
        }
        sumber = warnings
        break
      }

      case "explain": {
        agent = "tutor"
        const lastRekom = await prisma.rekomendasi.findFirst({
          where: { siswaId: siswa.id },
          orderBy: { createdAt: "desc" },
          select: { materiId: true },
        })
        if (lastRekom?.materiId) {
          const explanation = await explainRecommendation(siswa.id, lastRekom.materiId)
          jawaban = `**Penjelasan Rekomendasi AI**\n\n${explanation.summary}\n\n` +
            `**Faktor yang Dipertimbangkan:**\n` +
            explanation.factors.map((f) => `• ${f.factor}: ${f.value} (${f.impact})`).join("\n") +
            `\n\n**Confidence:** ${Math.round(explanation.confidence * 100)}%`
        } else {
          jawaban = "Belum ada rekomendasi yang bisa dijelaskan. Minta rekomendasi materi terlebih dahulu."
        }
        break
      }

      default: {
        const res = await runTutorAgent(queryToUse, {
          mapelId: input.mapelId || null,
          kelasId: siswa.kelasId ?? null,
          history: chatHistory,
          studentId: siswa.id,
          masteryAvg: penguasaanOverview.rataSkor,
          learningStyle: modelSummary.profile.gayaBelajar,
          streakDays: modelSummary.profile.streak,
        })
        jawaban = res.jawaban
        sumber = res.sumber
        break
      }
    }

    const logEntry = await logAgent(siswa.id, {
      agent,
      tipe: intent,
      query: pesan,
      hasil: jawaban.slice(0, 2000),
      sumber,
      durasiMs: Date.now() - start,
      sukses: true,
    })
    trace("agent done", `${agent} in ${Date.now() - start}ms`)

    if (intent === "tutor" || intent === "greeting") {
      autoEarlyWarning(siswa.id)
    }
  } catch (e: any) {
    trace("FAILED", e?.message?.slice(0, 200))
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

export async function aiJawabLatihan(latihanId: string, jawabanInput: Record<number, string>) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  const start = Date.now()

  const latihan = await prisma.latihanAI.findFirst({ where: { id: latihanId, siswaId: siswa.id } })
  if (!latihan) throw new Error("Latihan tidak ditemukan")
  if (latihan.skor != null) return { skor: latihan.skor, umpanBalik: latihan.umpanBalik, perSoal: null }

  const hasil = await gradeQuiz(latihan.soal as never, jawabanInput, { adaptive: true })
  await prisma.latihanAI.update({
    where: { id: latihan.id },
    data: { jawaban: jawabanInput as never, skor: hasil.skor, umpanBalik: hasil.umpanBalik },
  })

  await updatePenguasaanAfterLatihan(siswa.id, latihan.materiId, hasil.skor)
  trackLatihanSelesai(siswa.id, latihanId, latihan.materiId ?? undefined, { skor: hasil.skor }, Date.now() - start).catch(() => {})

  await logAgent(siswa.id, {
    agent: "assessor",
    tipe: "penilaian_latihan",
    query: "Penilaian latihan AI",
    hasil: `Skor ${hasil.skor}/100 (delta: ${hasil.masteryDelta})`,
    durasiMs: Date.now() - start,
    sukses: true,
  })

  autoEarlyWarning(siswa.id)

  return hasil
}

export async function aiDashboard() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [rekom, latihan, model, warnings] = await Promise.all([
    runHybridRecommender(siswa.id),
    prisma.latihanAI.aggregate({ where: { siswaId: siswa.id }, _avg: { skor: true }, _count: { _all: true } }),
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
      trendNilai: (model.profile as any).trendNilai,
    },
    openWarnings: warnings,
  }
}

export async function aiAnalitikData() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")

  const [logs, byAgent, stat, suksesCount, gagalCount, model, penguasaan] = await Promise.all([
    prisma.agentLog.findMany({ where: { siswaId: siswa.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.agentLog.groupBy({ by: ["agent"], where: { siswaId: siswa.id }, _count: { _all: true }, _avg: { durasiMs: true } }),
    prisma.agentLog.aggregate({ where: { siswaId: siswa.id }, _count: { _all: true }, _avg: { durasiMs: true } }),
    prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: true } }),
    prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: false } }),
    updateStudentModel(siswa.id),
    getPenguasaanOverview(siswa.id),
  ])

  const perAgent = byAgent.map((a) => ({
    agent: a.agent, total: a._count._all, rataDurasi: a._avg.durasiMs ?? 0,
  })).sort((a, b) => b.total - a.total)

  return {
    logs, perAgent,
    statistik: {
      totalRuns: stat._count._all, sukses: suksesCount, gagal: gagalCount,
      rataDurasi: (stat._avg.durasiMs ?? 0) / 1000,
    },
    profile: {
      gayaBelajar: model.gayaBelajar,
      motivasi: Math.round(model.motivasi * 100),
      engagement: Math.round(model.engagementScore * 100),
      konsistensi: Math.round(model.konsistensi * 100),
      streak: model.streak,
      trendNilai: model.trendNilai,
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

export async function explainRecommendationAction(materiId: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return explainRecommendation(siswa.id, materiId)
}

export async function explainWarningAction(warningId: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return explainEarlyWarning(siswa.id, warningId)
}

export async function submitFeedbackAction(input: {
  agentLogId?: string
  messageId?: string
  rating: number
  category?: string
  comment?: string
  helpful?: boolean
  accurate?: boolean
}) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return submitFeedback({ ...input, siswaId: siswa.id })
}

export async function getAgentQualityAction(agent: string, period: string) {
  // Metrik kualitas agent = data agregat sensitif → hanya ADMIN/GURU/RESEARCHER
  await requireRole("ADMIN", "GURU", "RESEARCHER")
  return computeQualityMetrics(agent, period)
}

export async function getRecentFeedbackAction() {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return getRecentFeedback(siswa.id)
}

export async function getMessageFeedbackAction(messageId: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  const feedback = await getMessageFeedback(messageId)
  // Ownership check: feedback hanya boleh dibaca pemiliknya
  if (feedback && feedback.siswaId !== siswa.id) return null
  return feedback
}

export async function submitSUSSurveyAction(jawaban: number[], komentar?: string) {
  const siswa = await getCurrentSiswa()
  if (!siswa) redirect("/login")
  return submitSUSSurvey(siswa.id, jawaban, komentar)
}

export async function getSUSResultsAction() {
  // Siswa melihat AGREGAT saja; rincian per-siswa (nama/skor/komentar)
  // hanya untuk ADMIN/GURU/RESEARCHER (fix kebocoran privasi audit M3)
  const session = await auth()
  const role = (session?.user as any)?.role
  const hasil = await getSUSResults()
  if (role === "ADMIN" || role === "GURU" || role === "RESEARCHER") return hasil
  return { ...hasil, results: [] }
}

export async function getAIEvaluationSummaryAction(periode?: string) {
  // Ringkasan evaluasi AI lintas-siswa → hanya role berprivilese
  await requireRole("ADMIN", "GURU", "RESEARCHER")
  return getAIEvaluationSummary(periode)
}
