import { prisma } from "@/lib/prisma"

export interface StudentModel {
  gayaBelajar: "VISUAL" | "AUDITORY" | "KINESTHETIC" | "READ_WRITE"
  engagementScore: number
  konsistensi: number
  motivasi: number
  streak: number
  totalSesi: number
  learningVelocity: number
  trendNilai: "naik" | "stabil" | "turun"
}

const DURASI_NORMAL = { min: 2 * 60 * 1000, max: 45 * 60 * 1000 }

function computeEngagementDepth(activities: {
  tipe: string
  durasiMs: number
  createdAt: Date
}[]): number {
  if (activities.length === 0) return 0

  let depthScore = 0
  const now = Date.now()

  for (const a of activities) {
    const durasi = a.durasiMs || 0
    const durasiRatio = Math.min(1, durasi / DURASI_NORMAL.max)
    const depthMultiplier = a.tipe === "AI_CHAT" ? 0.8
      : a.tipe === "ASSESSMENT_SELESAI" || a.tipe === "SOAL_DIKERJAKAN" ? 1.0
      : a.tipe === "LATIHAN_SELESAI" ? 0.9
      : a.tipe === "MATERI_DIBUKA" || a.tipe === "MATERI_SELESAI" ? 0.6
      : 0.5

    const timeSince = now - new Date(a.createdAt).getTime()
    const recencyBonus = Math.max(0, 1 - timeSince / (14 * 24 * 60 * 60 * 1000)) * 0.3

    depthScore += (durasiRatio * 0.4 + depthMultiplier * 0.4 + recencyBonus * 0.2) / activities.length
  }

  return Math.min(1, depthScore * 2)
}

function computeLearningStyle(activities: {
  tipe: string
  durasiMs: number
  detal?: any
}[]): StudentModel["gayaBelajar"] {
  const scores = { VISUAL: 0, AUDITORY: 0, KINESTHETIC: 0, READ_WRITE: 0 }

  for (const a of activities) {
    const durasi = a.durasiMs || 60000
    const weight = Math.min(2, durasi / 60000)

    if (a.tipe === "MATERI_DIBUKA" || a.tipe === "MATERI_SELESAI") {
      scores.VISUAL += weight * 1.2
    } else if (a.tipe === "AI_CHAT") {
      scores.AUDITORY += weight * 1.0
    } else if (a.tipe === "SOAL_DIKERJAKAN" || a.tipe === "LATIHAN_SELESAI" || a.tipe === "ASSESSMENT_SELESAI") {
      scores.KINESTHETIC += weight * 1.3
    }

    const detail = a.detal as any
    if (detail) {
      if (detail.materiType === "pdf" || detail.materiType === "image") scores.VISUAL += 0.5
      if (detail.hasAudio) scores.AUDITORY += 0.5
      if (detail.isInteractive) scores.KINESTHETIC += 0.5
    }
  }

  const total = scores.VISUAL + scores.AUDITORY + scores.KINESTHETIC + scores.READ_WRITE
  if (total === 0) return "READ_WRITE"

  const maxScore = Math.max(scores.VISUAL, scores.AUDITORY, scores.KINESTHETIC, scores.READ_WRITE)
  const threshold = total * 0.35

  if (maxScore < threshold) return "READ_WRITE"
  if (maxScore === scores.VISUAL) return "VISUAL"
  if (maxScore === scores.AUDITORY) return "AUDITORY"
  if (maxScore === scores.KINESTHETIC) return "KINESTHETIC"
  return "READ_WRITE"
}

function computeStreak(activities: { createdAt: Date }[]): number {
  if (activities.length === 0) return 0

  const days = new Set(
    activities.map((a) => new Date(a.createdAt).toISOString().split("T")[0])
  )
  const sorted = [...days].sort().reverse()

  let streak = 0
  const today = new Date().toISOString().split("T")[0]
  let checkDate = new Date(today)

  for (const d of sorted) {
    const dateStr = checkDate.toISOString().split("T")[0]
    if (d === dateStr) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (d < dateStr) {
      break
    }
  }

  return streak
}

function computeConsistency(activities: { createdAt: Date }[]): number {
  if (activities.length < 2) return 0

  const days = new Set(
    activities.map((a) => new Date(a.createdAt).toISOString().split("T")[0])
  )
  if (days.size < 2) return 0.3

  const sorted = [...days].sort()
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()
    gaps.push(diff / (24 * 60 * 60 * 1000))
  }

  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
  const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length
  const cv = avgGap > 0 ? Math.sqrt(variance) / avgGap : 1

  return Math.max(0, Math.min(1, 1 - cv / 2))
}

function computeTrend(nilaiHistory: number[]): "naik" | "stabil" | "turun" {
  if (nilaiHistory.length < 2) return "stabil"

  const recent = nilaiHistory.slice(-5)
  const firstHalf = recent.slice(0, Math.ceil(recent.length / 2))
  const secondHalf = recent.slice(Math.ceil(recent.length / 2))

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
  const diff = avgSecond - avgFirst

  if (diff > 5) return "naik"
  if (diff < -5) return "turun"
  return "stabil"
}

function computeLearningVelocity(activities: { tipe: string; createdAt: Date }[]): number {
  if (activities.length === 0) return 0

  const uniqueDays = new Set(activities.map((a) => new Date(a.createdAt).toISOString().split("T")[0]))
  const totalActivities = activities.length
  const daysActive = uniqueDays.size || 1

  return Math.min(1, totalActivities / (daysActive * 3))
}

export async function updateStudentModel(siswaId: string): Promise<StudentModel> {
  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [activities, nilaiHistory, chatSessions] = await Promise.all([
    prisma.learningActivity.findMany({
      where: { siswaId, createdAt: { gte: fourteenDaysAgo } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.nilai.findMany({
      where: { siswaId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { nilai: true, createdAt: true },
    }),
    prisma.chatSession.findMany({
      where: { siswaId },
      select: { createdAt: true },
    }),
  ])

  const allActivities = [
    ...activities.map((a) => ({ tipe: a.jenis, durasiMs: 0, createdAt: a.createdAt, detal: a.detail })),
    ...chatSessions.map((c) => ({ tipe: "AI_CHAT" as const, durasiMs: 0, createdAt: c.createdAt, detal: null })),
  ]

  const gayaBelajar = computeLearningStyle(allActivities)
  const engagementScore = computeEngagementDepth(allActivities)
  const konsistensi = computeConsistency(allActivities)
  const streak = computeStreak(allActivities)
  const totalSesi = activities.length + chatSessions.length
  const rataNilai = nilaiHistory.length > 0
    ? Math.round(nilaiHistory.reduce((s, n) => s + n.nilai, 0) / nilaiHistory.length)
    : 0
  const trendNilai = computeTrend(nilaiHistory.map((n) => n.nilai))
  const learningVelocity = computeLearningVelocity(allActivities)

  const motivasiBase = (engagementScore * 0.3 + konsistensi * 0.3 + Math.min(1, streak / 7) * 0.2 + learningVelocity * 0.2)
  const trendBonus = trendNilai === "naik" ? 0.1 : trendNilai === "turun" ? -0.1 : 0
  const motivasi = Math.max(0, Math.min(1, motivasiBase + trendBonus))

  const profile = await prisma.studentProfile.findFirst({ where: { siswaId } })
  const data = {
    siswaId,
    gayaBelajar,
    motivasi: Math.round(motivasi * 1000) / 1000,
    engagementScore: Math.round(engagementScore * 1000) / 1000,
    konsistensi: Math.round(konsistensi * 1000) / 1000,
    streak,
    totalSesi,
  }

  if (profile) {
    await prisma.studentProfile.update({ where: { id: profile.id }, data })
  } else {
    await prisma.studentProfile.create({ data })
  }

  return {
    gayaBelajar,
    engagementScore,
    konsistensi,
    motivasi,
    streak,
    totalSesi,
    learningVelocity,
    trendNilai,
  }
}

export async function getStudentModelSummary(siswaId: string) {
  const profile = await prisma.studentProfile.findFirst({ where: { siswaId } })

  if (!profile) {
    const model = await updateStudentModel(siswaId)
    return { profile: model, isNew: true }
  }

  return {
    profile: {
      gayaBelajar: profile.gayaBelajar as StudentModel["gayaBelajar"],
      motivasi: profile.motivasi,
      engagementScore: profile.engagementScore,
      konsistensi: profile.konsistensi,
      streak: profile.streak,
      totalSesi: profile.totalSesi,
      learningVelocity: 0,
      trendNilai: "stabil" as const,
    },
    isNew: false,
  }
}
