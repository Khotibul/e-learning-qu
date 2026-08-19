"use server"

import { prisma } from "@/lib/prisma"

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function toKey(d: Date) {
  return d.toISOString().split("T")[0]!
}

export async function getResearcherOverview() {
  const thirtyDaysAgo = daysAgo(30)

  const [totalStudents, totalExams, totalQuestions, avgScore, totalActivities, activeStudents] =
    await Promise.all([
      prisma.siswa.count({ where: { deletedAt: null } }),
      prisma.ujian.count({ where: { deletedAt: null } }),
      prisma.soal.count({ where: { deletedAt: null } }),
      prisma.nilai.aggregate({ where: { deletedAt: null }, _avg: { nilai: true } }),
      prisma.learningActivity.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.learningActivity.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { siswaId: true },
        distinct: ["siswaId"],
      }),
    ])

  const completionRates = await prisma.ujian.findMany({
    where: { deletedAt: null },
    select: { id: true, _count: { select: { jawabanUjian: true } } },
  })

  const masteryDistribution = await prisma.penguasaanKompetensi.groupBy({
    by: ["kategori"],
    _count: { id: true },
  })

  return {
    totalStudents,
    totalExams,
    totalQuestions,
    avgScore: avgScore._avg.nilai ?? 0,
    totalActivities,
    activeStudentCount: activeStudents.length,
    completionRates,
    masteryDistribution: masteryDistribution.map((m) => ({
      kategori: m.kategori,
      count: m._count.id,
    })),
  }
}

export async function getScoreDistribution() {
  const ranges = [
    { label: "0-20", min: 0, max: 20 },
    { label: "21-40", min: 21, max: 40 },
    { label: "41-60", min: 41, max: 60 },
    { label: "61-80", min: 61, max: 80 },
    { label: "81-100", min: 81, max: 100 },
  ]

  const results = await Promise.all(
    ranges.map(async (range) => {
      const count = await prisma.nilai.count({
        where: {
          deletedAt: null,
          nilai: { gte: range.min, lte: range.max },
        },
      })
      return { label: range.label, count }
    })
  )

  return results
}

export async function getMasteryByMapel() {
  const mastery = await prisma.penguasaanKompetensi.groupBy({
    by: ["kompetensiId"],
    _avg: { skor: true },
    _count: { id: true },
  })

  const kompetensiIds = mastery.map((m) => m.kompetensiId)
  const kompetensis = await prisma.kompetensi.findMany({
    where: { id: { in: kompetensiIds } },
    select: { id: true, nama: true, kode: true, mataPelajaran: { select: { nama: true, kode: true } } },
  })

  const kompetensiMap = new Map(kompetensis.map((k) => [k.id, k]))

  return mastery
    .map((m) => {
      const k = kompetensiMap.get(m.kompetensiId)
      return {
        mapel: k?.mataPelajaran?.nama ?? "Umum",
        kompetensi: k?.nama ?? m.kompetensiId,
        avgSkor: Math.round((m._avg.skor ?? 0) * 100) / 100,
        jumlahSiswa: m._count.id,
      }
    })
    .sort((a, b) => a.avgSkor - b.avgSkor)
}

export async function getLearningTrend() {
  const thirtyDaysAgo = daysAgo(30)

  const activities = await prisma.learningActivity.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const dailyCounts: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    dailyCounts[toKey(daysAgo(29 - i))] = 0
  }

  for (const a of activities) {
    const key = toKey(new Date(a.createdAt))
    if (dailyCounts[key] !== undefined) {
      dailyCounts[key]++
    }
  }

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
}

export async function getAgentPerformance() {
  const logs = await prisma.agentLog.groupBy({
    by: ["agent"],
    _count: { id: true },
    _avg: { durasiMs: true },
    where: { createdAt: { gte: daysAgo(30) } },
  })

  const results = await Promise.all(
    logs.map(async (log) => {
      const successCount = await prisma.agentLog.count({
        where: { agent: log.agent, sukses: true, createdAt: { gte: daysAgo(30) } },
      })
      return {
        agent: log.agent,
        totalCalls: log._count.id,
        successRate: log._count.id > 0 ? Math.round((successCount / log._count.id) * 10000) / 100 : 0,
        avgDuration: Math.round((log._avg.durasiMs ?? 0) * 100) / 100,
      }
    })
  )

  return results.sort((a, b) => b.totalCalls - a.totalCalls)
}

export async function getWarningStats() {
  const warnings = await prisma.earlyWarning.groupBy({
    by: ["severity", "tipe"],
    _count: { id: true },
  })

  const bySeverity = await prisma.earlyWarning.groupBy({
    by: ["severity"],
    _count: { id: true },
  })

  return {
    breakdown: warnings.map((w) => ({
      severity: w.severity,
      tipe: w.tipe,
      count: w._count.id,
    })),
    bySeverity: bySeverity.map((w) => ({
      severity: w.severity,
      count: w._count.id,
    })),
  }
}

export async function getDropoutRisk() {
  const atRisk = await prisma.earlyWarning.groupBy({
    by: ["siswaId"],
    where: {
      severity: { in: ["HIGH", "CRITICAL"] },
    },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
  })

  const siswaIds = atRisk.map((r) => r.siswaId)
  const siswas = await prisma.siswa.findMany({
    where: { id: { in: siswaIds }, deletedAt: null },
    select: {
      id: true,
      nama: true,
      nis: true,
      kelas: { select: { nama: true } },
      _count: { select: { earlyWarnings: { where: { severity: { in: ["HIGH", "CRITICAL"] } } } } },
    },
  })

  return siswas.map((s) => ({
    id: s.id,
    nama: s.nama,
    nis: s.nis,
    kelas: s.kelas?.nama ?? "-",
    warningCount: s._count.earlyWarnings,
  })).sort((a, b) => b.warningCount - a.warningCount)
}
