import { prisma } from "@/lib/prisma"

export type LearningStyle = "VISUAL" | "AUDITORY" | "READ_WRITE" | "KINESTHETIC"

interface ActivitySignal {
  jenis: string
  detail: any
}

export async function getOrCreateProfile(siswaId: string) {
  const existing = await prisma.studentProfile.findUnique({ where: { siswaId } })
  if (existing) return existing
  return prisma.studentProfile.create({ data: { siswaId } })
}

function detectLearningStyle(signals: ActivitySignal[]): LearningStyle {
  const counts: Record<LearningStyle, number> = { VISUAL: 0, AUDITORY: 0, READ_WRITE: 0, KINESTHETIC: 0 }
  for (const s of signals) {
    switch (s.jenis) {
      case "MATERI_DIBUKA": counts.VISUAL += 2; counts.READ_WRITE += 1; break
      case "MATERI_SELESAI": counts.READ_WRITE += 2; counts.VISUAL += 1; break
      case "SOAL_DIKERJAKAN": counts.KINESTHETIC += 2; break
      case "LATIHAN_SELESAI": counts.KINESTHETIC += 3; break
      case "AI_CHAT": counts.AUDITORY += 2; break
      case "ASSESSMENT_SELESAI": counts.READ_WRITE += 1; counts.KINESTHETIC += 1; break
      case "PRETEST": counts.READ_WRITE += 1; break
      case "POSTTEST": counts.READ_WRITE += 1; break
    }
  }
  const sorted = (Object.entries(counts) as [LearningStyle, number][]).sort((a, b) => b[1] - a[1])
  return sorted[0][1] > 0 ? sorted[0][0] : "VISUAL"
}

function computeEngagement(activities: { createdAt: Date; jenis: string }[], days = 14): number {
  const now = Date.now()
  const cutoff = now - days * 86400000
  const recent = activities.filter((a) => a.createdAt.getTime() >= cutoff)
  const uniqueDays = new Set(recent.map((a) => new Date(a.createdAt).toDateString())).size
  const base = Math.min(recent.length / 30, 1)
  const dayRatio = uniqueDays / days
  return Math.round((base * 0.6 + dayRatio * 0.4) * 100) / 100
}

function computeConsistency(activities: { createdAt: Date }[]): number {
  if (activities.length < 3) return 0
  const sorted = activities.map((a) => a.createdAt.getTime()).sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1])
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const variance = gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length
  const cv = avgGap > 0 ? Math.sqrt(variance) / avgGap : 2
  return Math.round(Math.max(0, 1 - cv) * 100) / 100
}

function computeMotivation(profile: {
  engagementScore: number
  konsistensi: number
  streak: number
  totalSesi: number
}): number {
  const e = profile.engagementScore * 0.35
  const k = profile.konsistensi * 0.25
  const s = Math.min(profile.streak / 7, 1) * 0.2
  const f = Math.min(profile.totalSesi / 50, 1) * 0.2
  return Math.round((e + k + s + f) * 100) / 100
}

export async function updateStudentModel(siswaId: string) {
  const [profile, activities, nilaiAgg] = await Promise.all([
    getOrCreateProfile(siswaId),
    prisma.learningActivity.findMany({
      where: { siswaId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.nilai.aggregate({
      where: { siswaId, deletedAt: null },
      _avg: { nilai: true },
      _count: { _all: true },
    }),
  ])

  const signals: ActivitySignal[] = activities.map((a) => ({ jenis: a.jenis, detail: a.detail }))
  const gayaBelajar = detectLearningStyle(signals)
  const engagementScore = computeEngagement(activities)
  const konsistensi = computeConsistency(activities)

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = [...new Set(activities.map((a) => new Date(a.createdAt).toDateString()))]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a)
  for (const t of dates) {
    if (t === today.getTime() - streak * 86400000) streak++
    else if (t === today.getTime()) { streak = Math.max(streak, 1) }
    else break
  }

  const totalSesi = activities.length
  const motivasi = computeMotivation({ engagementScore, konsistensi, streak, totalSesi })

  const lastActivity = activities[0]?.createdAt ?? profile.lastActiveAt

  const updated = await prisma.studentProfile.update({
    where: { siswaId },
    data: {
      gayaBelajar,
      engagementScore,
      konsistensi,
      motivasi,
      streak,
      totalSesi,
      waktuAktif: totalSesi,
      lastActiveAt: lastActivity,
      updateKe: new Date(),
    },
  })

  return {
    ...updated,
    rataNilai: nilaiAgg._avg.nilai ?? 0,
    totalUjian: nilaiAgg._count._all,
  }
}

export async function getStudentModelSummary(siswaId: string) {
  const profile = await getOrCreateProfile(siswaId)
  const recentActivities = await prisma.learningActivity.count({
    where: {
      siswaId,
      createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
  })
  const warnings = await prisma.earlyWarning.count({
    where: { siswaId, isResolved: false },
  })
  const nilaiAgg = await prisma.nilai.aggregate({
    where: { siswaId, deletedAt: null },
    _avg: { nilai: true },
  })

  return {
    profile,
    recentActivities,
    openWarnings: warnings,
    rataNilai: nilaiAgg._avg.nilai ?? 0,
  }
}
