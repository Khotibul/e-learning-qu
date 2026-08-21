import { prisma } from "@/lib/prisma"
import { autoCreateInterventionsFromWarnings } from "./intervention-auto"

export interface Warning {
  id: string
  tipe: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  message: string
  skor: number
  detail: any
  isResolved: boolean
  createdAt: Date
}

export interface WarningResult {
  warnings: Warning[]
  total: number
  low: number
  medium: number
  high: number
  critical: number
  predictions: Prediction[]
}

interface Prediction {
  tipe: string
  probability: number
  timeframe: string
  reason: string
}

const SEVERITY_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

function severityMax(a: string, b: string): string {
  const orderA = SEVERITY_ORDER[a as keyof typeof SEVERITY_ORDER] || 0
  const orderB = SEVERITY_ORDER[b as keyof typeof SEVERITY_ORDER] || 0
  return orderA >= orderB ? a : b
}

async function detectNilaiDrop(siswaId: string): Promise<{ tipe: string; severity: string; message: string; skor: number; detail: any } | null> {
  const nilaiHistory = await prisma.nilai.findMany({
    where: { siswaId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { nilai: true, mataPelajaran: { select: { nama: true } }, createdAt: true },
  })

  if (nilaiHistory.length < 3) return null

  const recent = nilaiHistory.slice(0, 3)
  const older = nilaiHistory.slice(3, 6)

  const avgRecent = recent.reduce((s, n) => s + n.nilai, 0) / recent.length
  const avgOlder = older.length > 0 ? older.reduce((s, n) => s + n.nilai, 0) / older.length : avgRecent
  const drop = avgOlder - avgRecent

  if (drop < 10) return null

  const severity = drop >= 25 ? "CRITICAL" : drop >= 20 ? "HIGH" : drop >= 15 ? "MEDIUM" : "LOW"
  const worstSubject = recent.sort((a, b) => a.nilai - b.nilai)[0]

  return {
    tipe: "NILAI_DROP",
    severity,
    message: `Nilai turun ${Math.round(drop)} poin rata-rata. ${worstSubject?.mataPelajaran?.nama || ""}: ${worstSubject?.nilai || 0}`,
    skor: drop,
    detail: {
      avgRecent: Math.round(avgRecent),
      avgOlder: Math.round(avgOlder),
      drop,
      worstSubject: worstSubject?.mataPelajaran?.nama,
      worstScore: worstSubject?.nilai,
      history: nilaiHistory.map((n) => ({ nilai: n.nilai, mapel: n.mataPelajaran.nama, date: n.createdAt })),
    },
  }
}

async function detectInactivity(siswaId: string): Promise<{ tipe: string; severity: string; message: string; skor: number; detail: any } | null> {
  const lastActivity = await prisma.learningActivity.findFirst({
    where: { siswaId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, jenis: true },
  })

  const lastChat = await prisma.chatSession.findFirst({
    where: { siswaId },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  })

  const lastDate = lastActivity?.createdAt && lastChat?.updatedAt
    ? new Date(Math.max(lastActivity.createdAt.getTime(), lastChat.updatedAt.getTime()))
    : lastActivity?.createdAt || lastChat?.updatedAt

  if (!lastDate) return null

  const daysInactive = Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000))

  if (daysInactive < 5) return null

  const severity = daysInactive >= 14 ? "CRITICAL" : daysInactive >= 10 ? "HIGH" : daysInactive >= 7 ? "MEDIUM" : "LOW"

  return {
    tipe: "INAKTIF",
    severity,
    message: `Tidak aktif selama ${daysInactive} hari terakhir`,
    skor: daysInactive,
    detail: {
      daysInactive,
      lastActivityDate: lastDate,
      lastActivityType: lastActivity?.jenis,
    },
  }
}

async function detectLowMastery(siswaId: string): Promise<{ tipe: string; severity: string; message: string; skor: number; detail: any } | null> {
  const penguasaan = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    include: { kompetensi: { select: { nama: true } } },
  })

  if (penguasaan.length === 0) return null

  const lowCount = penguasaan.filter((p) => p.skor < 30).length
  const avgSkor = penguasaan.reduce((s, p) => s + p.skor, 0) / penguasaan.length

  if (lowCount < 2 && avgSkor >= 35) return null

  const severity = lowCount >= 5 ? "CRITICAL" : lowCount >= 4 ? "HIGH" : lowCount >= 3 ? "MEDIUM" : "LOW"

  return {
    tipe: "RENDAH_PENGUASAAN",
    severity,
    message: `${lowCount} kompetensi di bawah 30%. Rata-rata penguasaan: ${Math.round(avgSkor)}%`,
    skor: lowCount,
    detail: {
      lowCount,
      avgMastery: Math.round(avgSkor),
      weakCompetencies: penguasaan
        .filter((p) => p.skor < 40)
        .map((p) => ({ nama: p.kompetensi.nama, skor: p.skor }))
        .sort((a, b) => a.skor - b.skor),
    },
  }
}

async function detectExamFailure(siswaId: string): Promise<{ tipe: string; severity: string; message: string; skor: number; detail: any } | null> {
  const recentExams = await prisma.jawabanUjian.findMany({
    where: { siswaId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { isCorrect: true, ujian: { select: { nama: true, mataPelajaran: { select: { nama: true } } } }, createdAt: true },
  })

  if (recentExams.length < 4) return null

  const last5 = recentExams.slice(0, 5)
  const failCount = last5.filter((j) => !j.isCorrect).length

  if (failCount < 3) return null

  const severity = failCount >= 5 ? "CRITICAL" : failCount >= 4 ? "HIGH" : "MEDIUM"

  return {
    tipe: "GAGAL_UJIAN",
    severity,
    message: `${failCount}/5 jawaban ujian terakhir salah`,
    skor: failCount,
    detail: {
      failCount,
      totalRecent: last5.length,
      exams: last5.map((j) => ({
        nama: j.ujian.nama,
        mapel: j.ujian.mataPelajaran.nama,
        correct: j.isCorrect,
      })),
    },
  }
}

async function detectLowMotivation(siswaId: string): Promise<{ tipe: string; severity: string; message: string; skor: number; detail: any } | null> {
  const profile = await prisma.studentProfile.findFirst({ where: { siswaId } })
  if (!profile) return null

  if (profile.motivasi >= 30) return null

  const severity = profile.motivasi <= 10 ? "CRITICAL" : profile.motivasi <= 20 ? "HIGH" : "MEDIUM"

  return {
    tipe: "LOW_MOTIVASI",
    severity,
    message: `Skor motivasi rendah: ${Math.round(profile.motivasi * 100)}% (engagement: ${Math.round(profile.engagementScore * 100)}%, streak: ${profile.streak} hari)`,
    skor: Math.round(profile.motivasi * 100),
    detail: {
      motivasi: profile.motivasi,
      engagement: profile.engagementScore,
      konsistensi: profile.konsistensi,
      streak: profile.streak,
    },
  }
}

async function generatePredictions(siswaId: string): Promise<Prediction[]> {
  const predictions: Prediction[] = []

  const nilaiHistory = await prisma.nilai.findMany({
    where: { siswaId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { nilai: true, createdAt: true },
  })

  if (nilaiHistory.length >= 4) {
    const recent = nilaiHistory.slice(-4).map((n) => n.nilai)
    const trend = (recent[3] - recent[0]) / 3
    if (trend < -3) {
      predictions.push({
        tipe: "NILAI_DROP_PREDICTION",
        probability: Math.min(0.95, 0.3 + Math.abs(trend) * 0.1),
        timeframe: "2 minggu",
        reason: `Tren nilai turun ${Math.abs(Math.round(trend))} poin/minggu. Tanpa intervensi, diprediksi akan terus menurun.`,
      })
    }
  }

  const daysInactive = await prisma.learningActivity.findFirst({
    where: { siswaId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  if (daysInactive) {
    const daysSince = Math.floor((Date.now() - daysInactive.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    if (daysSince >= 3 && daysSince < 7) {
      predictions.push({
        tipe: "INAKTIF_PREDICTION",
        probability: 0.4 + daysSince * 0.08,
        timeframe: `${7 - daysSince} hari lagi`,
        reason: `Sudah ${daysSince} hari tanpa aktivitas. Jika berlanjut, akan masuk zona inaktif.`,
      })
    }
  }

  const penguasaan = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    select: { skor: true },
  })

  if (penguasaan.length > 0) {
    const lowMastery = penguasaan.filter((p) => p.skor < 40).length
    if (lowMastery >= 2) {
      predictions.push({
        tipe: "RENDAH_PENGUASAAN_PREDICTION",
        probability: Math.min(0.9, 0.3 + lowMastery * 0.12),
        timeframe: "1 bulan",
        reason: `${lowMastery} kompetensi lemah. Tanpa remedial, akan mempengaruhi nilai ujian.`,
      })
    }
  }

  return predictions
}

export async function runEarlyWarning(siswaId: string): Promise<WarningResult> {
  const detectors = [
    detectNilaiDrop(siswaId),
    detectInactivity(siswaId),
    detectLowMastery(siswaId),
    detectExamFailure(siswaId),
    detectLowMotivation(siswaId),
  ]

  const results = await Promise.all(detectors)
  const validResults = results.filter(Boolean) as { tipe: string; severity: string; message: string; skor: number; detail: any }[]

  const existingWarnings = await prisma.earlyWarning.findMany({
    where: { siswaId, isResolved: false },
  })

  const existingMap = new Map(existingWarnings.map((w) => [w.tipe, w]))

  for (const result of validResults) {
    const existing = existingMap.get(result.tipe)
    if (existing) {
      if ((SEVERITY_ORDER[result.severity as keyof typeof SEVERITY_ORDER] || 0) > (SEVERITY_ORDER[existing.severity as keyof typeof SEVERITY_ORDER] || 0)) {
        await prisma.earlyWarning.update({
          where: { id: existing.id },
          data: { severity: result.severity, message: result.message, skor: result.skor, detail: result.detail },
        })
      }
    } else {
      await prisma.earlyWarning.create({
        data: {
          siswaId,
          tipe: result.tipe,
          severity: result.severity,
          message: result.message,
          skor: result.skor,
          detail: result.detail,
        },
      })
    }
  }

  const resolvedTipes = new Set(validResults.map((r) => r.tipe))
  for (const existing of existingWarnings) {
    if (!resolvedTipes.has(existing.tipe)) {
      await prisma.earlyWarning.update({
        where: { id: existing.id },
        data: { isResolved: true },
      })
    }
  }

  const allWarnings = await prisma.earlyWarning.findMany({
    where: { siswaId, isResolved: false },
    orderBy: [
      { severity: "desc" },
      { createdAt: "desc" },
    ],
  })

  const predictions = await generatePredictions(siswaId)

  const mapped: Warning[] = allWarnings.map((w) => ({
    id: w.id,
    tipe: w.tipe,
    severity: w.severity as Warning["severity"],
    message: w.message,
    skor: w.skor || 0,
    detail: w.detail,
    isResolved: w.isResolved,
    createdAt: w.createdAt,
  }))

  const newWarningsForIntervention = validResults.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL")
  if (newWarningsForIntervention.length > 0) {
    try {
      await autoCreateInterventionsFromWarnings(siswaId, newWarningsForIntervention)
    } catch {
      // Intervention auto-creation is best-effort
    }
  }

  return {
    warnings: mapped,
    total: mapped.length,
    low: mapped.filter((w) => w.severity === "LOW").length,
    medium: mapped.filter((w) => w.severity === "MEDIUM").length,
    high: mapped.filter((w) => w.severity === "HIGH").length,
    critical: mapped.filter((w) => w.severity === "CRITICAL").length,
    predictions,
  }
}

export async function getStudentWarnings(siswaId: string): Promise<Warning[]> {
  const warnings = await prisma.earlyWarning.findMany({
    where: { siswaId, isResolved: false },
    orderBy: { createdAt: "desc" },
  })

  return warnings.map((w) => ({
    id: w.id,
    tipe: w.tipe,
    severity: w.severity as Warning["severity"],
    message: w.message,
    skor: w.skor || 0,
    detail: w.detail,
    isResolved: w.isResolved,
    createdAt: w.createdAt,
  }))
}

export async function resolveWarning(warningId: string) {
  await prisma.earlyWarning.update({
    where: { id: warningId },
    data: { isResolved: true },
  })
}

export async function getAtRiskStudents(kelasIds?: string[]) {
  // Scope opsional: tanpa filter = seluruh sistem (untuk admin/researcher).
  // Guru HARUS mengirim kelasIds miliknya agar tidak melihat siswa guru lain.
  const warningWhere: Record<string, unknown> = {
    isResolved: false,
    severity: { in: ["HIGH", "CRITICAL"] },
  }
  if (kelasIds && kelasIds.length > 0) {
    warningWhere.siswa = { kelasId: { in: kelasIds } }
  } else if (kelasIds && kelasIds.length === 0) {
    return []
  }

  const unresolved = await prisma.earlyWarning.groupBy({
    by: ["siswaId"],
    where: warningWhere as any,
    _count: { _all: true },
    _max: { severity: true },
  })

  const sorted = unresolved.sort((a, b) => {
    const sevA = SEVERITY_ORDER[a._max.severity as keyof typeof SEVERITY_ORDER] || 0
    const sevB = SEVERITY_ORDER[b._max.severity as keyof typeof SEVERITY_ORDER] || 0
    return sevB - sevA || b._count._all - a._count._all
  })

  const siswaIds = sorted.map((s) => s.siswaId).filter(Boolean) as string[]
  if (siswaIds.length === 0) return []

  const siswaWhere: Record<string, unknown> = { id: { in: siswaIds } }
  if (kelasIds && kelasIds.length > 0) {
    siswaWhere.kelasId = { in: kelasIds }
  }

  const siswaList = await prisma.siswa.findMany({
    where: siswaWhere as any,
    select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
  })

  const siswaMap = new Map(siswaList.map((s) => [s.id, s]))

  return sorted.map((s) => ({
    siswa: siswaMap.get(s.siswaId || ""),
    warningCount: s._count._all,
    maxSeverity: s._max.severity,
  })).filter((s) => s.siswa)
}
