import { prisma } from "@/lib/prisma"

interface Warning {
  tipe: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  message: string
  skor: number
  detail: any
}

async function checkNilaiDrop(siswaId: string): Promise<Warning[]> {
  const warnings: Warning[] = []
  const nilai = await prisma.nilai.findMany({
    where: { siswaId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { nilai: true, createdAt: true, mataPelajaran: { select: { nama: true } } },
  })
  if (nilai.length < 3) return warnings

  const byMapel = new Map<string, typeof nilai>()
  for (const n of nilai) {
    const key = n.mataPelajaran?.nama ?? "Umum"
    if (!byMapel.has(key)) byMapel.set(key, [])
    byMapel.get(key)!.push(n)
  }

  for (const [mapel, ns] of byMapel) {
    if (ns.length < 2) continue
    const recent = ns.slice(-3)
    const avg = ns.reduce((s, n) => s + n.nilai, 0) / ns.length
    const recentAvg = recent.reduce((s, n) => s + n.nilai, 0) / recent.length
    const drop = avg - recentAvg
    if (drop > 15) {
      warnings.push({
        tipe: "NILAI_DROP",
        severity: drop > 30 ? "CRITICAL" : drop > 20 ? "HIGH" : "MEDIUM",
        message: `Nilai ${mapel} turun signifikan dari rata-rata ${Math.round(avg)} ke ${Math.round(recentAvg)}`,
        skor: Math.min(drop / 40, 1),
        detail: { mapel, avg, recentAvg, drop },
      })
    }
  }
  return warnings
}

async function checkInactivity(siswaId: string): Promise<Warning[]> {
  const warnings: Warning[] = []
  const profile = await prisma.studentProfile.findUnique({ where: { siswaId } })
  if (!profile?.lastActiveAt) return warnings

  const daysInactive = Math.floor((Date.now() - profile.lastActiveAt.getTime()) / 86400000)
  if (daysInactive >= 7) {
    warnings.push({
      tipe: "INAKTIF",
      severity: daysInactive >= 14 ? "CRITICAL" : daysInactive >= 10 ? "HIGH" : "MEDIUM",
      message: `Siswa tidak aktif selama ${daysInactive} hari`,
      skor: Math.min(daysInactive / 21, 1),
      detail: { daysInactive, lastActive: profile.lastActiveAt },
    })
  }
  return warnings
}

async function checkLowMastery(siswaId: string): Promise<Warning[]> {
  const warnings: Warning[] = []
  const penguasaan = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId, skor: { lt: 30 } },
    include: { kompetensi: { select: { nama: true, kode: true } } },
  })
  if (penguasaan.length >= 3) {
    warnings.push({
      tipe: "RENDAH_PENGUASAAN",
      severity: penguasaan.length >= 5 ? "HIGH" : "MEDIUM",
      message: `${penguasaan.length} kompetensi dengan penguasaan di bawah 30%`,
      skor: Math.min(penguasaan.length / 7, 1),
      detail: {
        kompetensi: penguasaan.map((p) => ({
          nama: p.kompetensi.nama,
          skor: p.skor,
          kategori: p.kategori,
        })),
      },
    })
  }
  return warnings
}

async function checkExamFailure(siswaId: string): Promise<Warning[]> {
  const warnings: Warning[] = []
  const recentNilai = await prisma.nilai.findMany({
    where: { siswaId, deletedAt: null, jenis: "UJIAN" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { ujian: { select: { nama: true, nilaiMinimum: true } } },
  })
  const failed = recentNilai.filter(
    (n) => n.ujian && n.nilai < (n.ujian.nilaiMinimum || 70)
  )
  if (failed.length >= 2) {
    warnings.push({
      tipe: "GAGAL_UJIAN",
      severity: failed.length >= 4 ? "CRITICAL" : "HIGH",
      message: `Gagal ${failed.length} dari ${recentNilai.length} ujian terakhir`,
      skor: failed.length / Math.max(recentNilai.length, 1),
      detail: {
        ujian: failed.map((n) => ({
          nama: n.ujian?.nama,
          nilai: n.nilai,
          minimum: n.ujian?.nilaiMinimum,
        })),
      },
    })
  }
  return warnings
}

async function checkMotivasi(siswaId: string): Promise<Warning[]> {
  const warnings: Warning[] = []
  const profile = await prisma.studentProfile.findUnique({ where: { siswaId } })
  if (!profile) return warnings
  if (profile.motivasi < 0.25 && profile.totalSesi > 5) {
    warnings.push({
      tipe: "LOW_MOTIVASI",
      severity: profile.motivasi < 0.1 ? "CRITICAL" : "HIGH",
      message: `Skor motivasi rendah (${Math.round(profile.motivasi * 100)}%), streak ${profile.streak} hari`,
      skor: 1 - profile.motivasi,
      detail: {
        motivasi: profile.motivasi,
        engagement: profile.engagementScore,
        konsistensi: profile.konsistensi,
        streak: profile.streak,
      },
    })
  }
  return warnings
}

export async function runEarlyWarning(siswaId: string) {
  const [inactivity, nilaiDrop, lowMastery, examFail, lowMotivasi] = await Promise.all([
    checkInactivity(siswaId),
    checkNilaiDrop(siswaId),
    checkLowMastery(siswaId),
    checkExamFailure(siswaId),
    checkMotivasi(siswaId),
  ])

  const allWarnings = [...inactivity, ...nilaiDrop, ...lowMastery, ...examFail, ...lowMotivasi]

  const existingUnresolved = await prisma.earlyWarning.findMany({
    where: { siswaId, isResolved: false },
    select: { tipe: true },
  })
  const existingTypes = new Set(existingUnresolved.map((w) => w.tipe))

  const created: string[] = []
  for (const w of allWarnings) {
    if (existingTypes.has(w.tipe)) continue
    await prisma.earlyWarning.create({
      data: {
        siswaId,
        tipe: w.tipe,
        severity: w.severity,
        message: w.message,
        skor: w.skor,
        detail: w.detail,
      },
    })
    created.push(w.tipe)
  }

  return {
    warnings: allWarnings,
    created,
    total: allWarnings.length,
    critical: allWarnings.filter((w) => w.severity === "CRITICAL").length,
    high: allWarnings.filter((w) => w.severity === "HIGH").length,
  }
}

export async function getStudentWarnings(siswaId: string) {
  return prisma.earlyWarning.findMany({
    where: { siswaId },
    orderBy: [{ isResolved: "asc" }, { createdAt: "desc" }],
    take: 50,
  })
}

export async function resolveWarning(warningId: string) {
  return prisma.earlyWarning.update({
    where: { id: warningId },
    data: { isResolved: true, resolvedAt: new Date() },
  })
}

export async function getAtRiskStudents(guruId?: string) {
  const where: any = { isResolved: false }
  if (guruId) {
    where.siswa = { kelas: { guruId } }
  }
  const warnings = await prisma.earlyWarning.findMany({
    where,
    include: {
      siswa: {
        select: {
          id: true,
          nama: true,
          nis: true,
          kelas: { select: { nama: true } },
        },
      },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  const grouped = new Map<string, typeof warnings>()
  for (const w of warnings) {
    const key = w.siswa?.id ?? "unknown"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(w)
  }

  return [...grouped.entries()].map(([siswaId, ws]) => ({
    siswa: ws[0].siswa,
    warnings: ws,
    highestSeverity: ws.reduce((max, w) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      return (order[w.severity as keyof typeof order] ?? 0) > (order[max as keyof typeof order] ?? 0) ? w.severity : max
    }, "LOW"),
    totalWarnings: ws.length,
  }))
}
