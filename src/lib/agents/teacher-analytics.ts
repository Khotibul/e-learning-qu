import { prisma } from "@/lib/prisma"

interface TeacherDashboard {
  overview: {
    totalSiswa: number
    totalKelas: number
    totalMapel: number
    totalUjian: number
    rataRataGlobal: number
  }
  perMapel: {
    nama: string
    rataRata: number
    jumlahSiswa: number
    lulusRate: number
    topikLemah: string[]
  }[]
  perKelas: {
    nama: string
    rataRata: number
    jumlahSiswa: number
    distribusi: Record<string, number>
  }[]
  topAtRisk: {
    siswaId: string
    nama: string
    kelas: string
    rataNilai: number
    warnings: number
    kategori: string
  }[]
  nGainSummary: {
    mapel: string
    pretest: number
    posttest: number
    nGain: number
    efektivitas: string
  }[]
  recentActivity: {
    tanggal: string
    aktivitas: string
    detail: string
  }[]
}

export async function getTeacherAnalytics(guruId: string): Promise<TeacherDashboard> {
  const [kelasList, pengajarans, ujians] = await Promise.all([
    prisma.kelas.findMany({
      where: { guruId, deletedAt: null },
      select: { id: true, nama: true },
    }),
    prisma.pengajaran.findMany({
      where: { guruId, deletedAt: null, mataPelajaran: { deletedAt: null } },
      include: { mataPelajaran: { select: { id: true, nama: true } }, kelas: { select: { id: true, nama: true } } },
    }),
    prisma.ujian.findMany({
      where: { guruId, deletedAt: null },
      select: { id: true, nama: true, nilaiMinimum: true, mataPelajaranId: true, kelasId: true },
    }),
  ])

  const mapelIds = [...new Set(pengajarans.map((p) => p.mataPelajaran.id))]
  const kelasIds = kelasList.map((k) => k.id)
  const ujianIds = ujians.map((u) => u.id)

  const [allNilai, allSiswa, allWarnings, allPenguasaan, recentActivities] = await Promise.all([
    prisma.nilai.findMany({
      where: { ujianId: { in: ujianIds }, deletedAt: null },
      select: {
        nilai: true,
        siswaId: true,
        mataPelajaranId: true,
        ujianId: true,
        siswa: { select: { nama: true, kelas: { select: { nama: true } } } },
        mataPelajaran: { select: { nama: true } },
      },
    }),
    prisma.siswa.findMany({
      where: { kelasId: { in: kelasIds }, deletedAt: null },
      select: { id: true, nama: true, kelasId: true, kelas: { select: { nama: true } } },
    }),
    prisma.earlyWarning.findMany({
      where: { isResolved: false, siswa: { kelasId: { in: kelasIds } } },
      select: { siswaId: true, tipe: true },
    }),
    // Untuk topikLemah: penguasaan kompetensi siswa di kelas guru
    prisma.penguasaanKompetensi.findMany({
      where: { siswa: { kelasId: { in: kelasIds }, deletedAt: null } },
      select: {
        skor: true,
        kompetensi: { select: { nama: true, mataPelajaranId: true } },
      },
    }),
    // Untuk recentActivity: aktivitas belajar terbaru siswa di kelas guru
    prisma.learningActivity.findMany({
      where: { siswa: { kelasId: { in: kelasIds }, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        createdAt: true,
        jenis: true,
        detail: true,
        siswa: { select: { nama: true } },
      },
    }),
  ])

  const rataGlobal = allNilai.length > 0
    ? Math.round(allNilai.reduce((s, n) => s + n.nilai, 0) / allNilai.length)
    : 0

  const perMapel = mapelIds.map((mid) => {
    const mapelNilai = allNilai.filter((n) => n.mataPelajaranId === mid)
    const nama = mapelNilai[0]?.mataPelajaran?.nama ?? "-"
    const avg = mapelNilai.length > 0 ? Math.round(mapelNilai.reduce((s, n) => s + n.nilai, 0) / mapelNilai.length) : 0
    const siswaSet = new Set(mapelNilai.map((n) => n.siswaId))
    const ujianForMapel = ujians.filter((u) => u.mataPelajaranId === mid)
    const minMap = new Map(ujianForMapel.map((u) => [u.id, u.nilaiMinimum]))
    const lulus = mapelNilai.filter((n) => n.nilai >= (minMap.get(n.ujianId ?? "") ?? 70)).length

    // Topik lemah: kompetensi dgn rata-rata mastery < 60 di mapel ini,
    // diurutkan terlemah dulu, maks 3 (deterministik, tanpa LLM)
    const kompAgg = new Map<string, { total: number; count: number }>()
    for (const p of allPenguasaan) {
      if (p.kompetensi.mataPelajaranId !== mid) continue
      const cur = kompAgg.get(p.kompetensi.nama) ?? { total: 0, count: 0 }
      cur.total += p.skor
      cur.count++
      kompAgg.set(p.kompetensi.nama, cur)
    }
    const topikLemah = [...kompAgg.entries()]
      .map(([namaK, v]) => ({ nama: namaK, avg: v.total / v.count }))
      .filter((k) => k.avg < 60)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3)
      .map((k) => `${k.nama} (${Math.round(k.avg)}%)`)

    return {
      nama,
      rataRata: avg,
      jumlahSiswa: siswaSet.size,
      lulusRate: mapelNilai.length > 0 ? Math.round((lulus / mapelNilai.length) * 100) : 0,
      topikLemah,
    }
  })

  const perKelas = kelasList.map((k) => {
    const kelasSiswa = allSiswa.filter((s) => s.kelasId === k.id)
    const kelasNilai = allNilai.filter((n) => kelasSiswa.some((s) => s.id === n.siswaId))
    const avg = kelasNilai.length > 0 ? Math.round(kelasNilai.reduce((s, n) => s + n.nilai, 0) / kelasNilai.length) : 0
    const distribusi: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const n of kelasNilai) {
      if (n.nilai >= 90) distribusi.A++
      else if (n.nilai >= 80) distribusi.B++
      else if (n.nilai >= 70) distribusi.C++
      else if (n.nilai >= 60) distribusi.D++
      else distribusi.E++
    }
    return { nama: k.nama, rataRata: avg, jumlahSiswa: kelasSiswa.length, distribusi }
  })

  const warnCount = new Map<string, number>()
  for (const w of allWarnings) {
    if (w.siswaId) warnCount.set(w.siswaId, (warnCount.get(w.siswaId) ?? 0) + 1)
  }

  const siswaNilai = new Map<string, { total: number; count: number }>()
  for (const n of allNilai) {
    const cur = siswaNilai.get(n.siswaId) ?? { total: 0, count: 0 }
    cur.total += n.nilai
    cur.count++
    siswaNilai.set(n.siswaId, cur)
  }

  const topAtRisk = allSiswa
    .map((s) => {
      const avg = siswaNilai.get(s.id)
      const rata = avg ? Math.round(avg.total / avg.count) : 0
      const warnings = warnCount.get(s.id) ?? 0
      const kategori = rata >= 80 ? "Aman" : rata >= 65 ? "Perlu Perhatian" : "Risiko Tinggi"
      return { siswaId: s.id, nama: s.nama, kelas: s.kelas?.nama ?? "-", rataNilai: rata, warnings, kategori }
    })
    .filter((s) => s.warnings > 0 || s.rataNilai < 65)
    .sort((a, b) => a.rataNilai - b.rataNilai)
    .slice(0, 10)

  const pretestPosttest = await prisma.pretestPosttest.findMany({
    where: { siswaId: { in: allSiswa.map((s) => s.id) } },
    include: { mataPelajaran: { select: { nama: true } } },
  })
  const nGainByMapel = new Map<string, { pre: number[]; post: number[] }>()
  for (const ppt of pretestPosttest) {
    if (ppt.pretestNilai == null || ppt.posttestNilai == null) continue
    const key = ppt.mataPelajaran?.nama ?? "Umum"
    if (!nGainByMapel.has(key)) nGainByMapel.set(key, { pre: [], post: [] })
    nGainByMapel.get(key)!.pre.push(ppt.pretestNilai)
    nGainByMapel.get(key)!.post.push(ppt.posttestNilai)
  }
  const nGainSummary = [...nGainByMapel.entries()].map(([mapel, data]) => {
    const avgPre = data.pre.reduce((a, b) => a + b, 0) / data.pre.length
    const avgPost = data.post.reduce((a, b) => a + b, 0) / data.post.length
    const maxPossible = 100
    const nGain = maxPossible - avgPre > 0 ? (avgPost - avgPre) / (maxPossible - avgPre) : 0
    const efektivitas = nGain >= 0.7 ? "Efektif" : nGain >= 0.4 ? "Cukup Efektif" : "Kurang Efektif"
    return { mapel, pretest: Math.round(avgPre), posttest: Math.round(avgPost), nGain: Math.round(nGain * 100) / 100, efektivitas }
  })

  const aktivitasLabel: Record<string, string> = {
    LOGIN: "Login", LOGOUT: "Logout",
    MATERI_DIBUKA: "Membuka materi", MATERI_SELESAI: "Menyelesaikan materi",
    SOAL_DIKERJAKAN: "Mengerjakan soal", LATIHAN_DIMULAI: "Memulai latihan AI",
    LATIHAN_SELESAI: "Menyelesaikan latihan AI", AI_CHAT: "Bertanya ke AI Tutor",
    ASSESSMENT_DIMULAI: "Memulai ujian", ASSESSMENT_SELESAI: "Menyelesaikan ujian",
    PRETEST: "Pretest", POSTTEST: "Posttest", REKOMENDASI_DIKLIK: "Membuka rekomendasi AI",
  }

  return {
    overview: {
      totalSiswa: allSiswa.length,
      totalKelas: kelasList.length,
      totalMapel: mapelIds.length,
      totalUjian: ujians.length,
      rataRataGlobal: rataGlobal,
    },
    perMapel,
    perKelas,
    topAtRisk,
    nGainSummary,
    recentActivity: recentActivities.map((a) => ({
      tanggal: a.createdAt.toISOString(),
      aktivitas: `${a.siswa.nama} — ${aktivitasLabel[a.jenis] ?? a.jenis}`,
      detail: "",
    })),
  }
}

// ─── TEACHER STUDENT INSIGHT (Phase 17 aggregator) ──────────────────────────
// Menggabungkan Student Modeling + Knowledge Tracing + Learning Analytics +
// Assessment + Early Warning menjadi insight per siswa — deterministik,
// batched (tanpa N+1), tanpa LLM. Guru melihat insight, bukan agent mentah.

export interface TeacherStudentInsight {
  studentId: string
  nama: string
  kelas: string
  progress: number
  averageScore: number
  mastery: number
  engagement: string
  riskLevel: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

function engagementLabel(score: number): string {
  if (score >= 0.6) return "Tinggi"
  if (score >= 0.3) return "Sedang"
  return "Rendah"
}

function riskFromWarnings(warnings: { severity: string }[]): string {
  const has = (s: string) => warnings.some((w) => w.severity === s)
  if (has("CRITICAL")) return "Prioritas Intervensi"
  if (has("HIGH")) return "Risiko Tinggi"
  if (has("MEDIUM")) return "Perlu Perhatian"
  return "Aman"
}

export async function getTeacherStudentInsights(
  guruId: string,
  opts?: { siswaIds?: string[]; limit?: number }
): Promise<TeacherStudentInsight[]> {
  const [pengajaranKelas, waliKelas] = await Promise.all([
    prisma.pengajaran.findMany({
      where: { guruId, deletedAt: null, mataPelajaran: { deletedAt: null } },
      select: { kelasId: true },
      distinct: ["kelasId"],
    }),
    prisma.kelas.findMany({ where: { guruId, deletedAt: null }, select: { id: true } }),
  ])
  const kelasIds = [...new Set([...pengajaranKelas.map((p) => p.kelasId), ...waliKelas.map((k) => k.id)])]
  if (kelasIds.length === 0) return []

  const siswaWhere: Record<string, unknown> = { kelasId: { in: kelasIds }, deletedAt: null }
  if (opts?.siswaIds && opts.siswaIds.length > 0) {
    siswaWhere.id = { in: opts.siswaIds }
  }

  const siswaList = await prisma.siswa.findMany({
    where: siswaWhere as any,
    select: { id: true, nama: true, kelas: { select: { nama: true } } },
    orderBy: { nama: "asc" },
    take: opts?.limit ?? 500,
  })
  if (siswaList.length === 0) return []
  const ids = siswaList.map((s) => s.id)

  const [nilaiAgg, penguasaan, warnings, profiles, materiStats] = await Promise.all([
    prisma.nilai.groupBy({
      by: ["siswaId"],
      where: { siswaId: { in: ids }, deletedAt: null },
      _avg: { nilai: true },
    }),
    prisma.penguasaanKompetensi.findMany({
      where: { siswaId: { in: ids } },
      select: {
        siswaId: true,
        skor: true,
        kompetensi: { select: { nama: true } },
      },
    }),
    prisma.earlyWarning.findMany({
      where: { siswaId: { in: ids }, isResolved: false },
      select: { siswaId: true, severity: true },
    }),
    prisma.studentProfile.findMany({
      where: { siswaId: { in: ids } },
      select: { siswaId: true, engagementScore: true, streak: true },
    }),
    prisma.learningActivity.groupBy({
      by: ["siswaId", "jenis"],
      where: { siswaId: { in: ids }, jenis: { in: ["MATERI_DIBUKA", "MATERI_SELESAI"] } },
      _count: { _all: true },
    }),
  ])

  const nilaiMap = new Map(nilaiAgg.map((n) => [n.siswaId, Math.round(n._avg.nilai ?? 0)]))
  const warnMap = new Map<string, { severity: string }[]>()
  for (const w of warnings) {
    const arr = warnMap.get(w.siswaId) ?? []
    arr.push({ severity: w.severity })
    warnMap.set(w.siswaId, arr)
  }
  const profileMap = new Map(profiles.map((p) => [p.siswaId, p]))

  const penguasaanBySiswa = new Map<string, { nama: string; skor: number }[]>()
  for (const p of penguasaan) {
    const arr = penguasaanBySiswa.get(p.siswaId) ?? []
    arr.push({ nama: p.kompetensi.nama, skor: p.skor })
    penguasaanBySiswa.set(p.siswaId, arr)
  }

  const materiMap = new Map<string, { dibuka: number; selesai: number }>()
  for (const m of materiStats) {
    const cur = materiMap.get(m.siswaId) ?? { dibuka: 0, selesai: 0 }
    if (m.jenis === "MATERI_DIBUKA") cur.dibuka += m._count._all
    else cur.selesai += m._count._all
    materiMap.set(m.siswaId, cur)
  }

  return siswaList.map((s) => {
    const komp = (penguasaanBySiswa.get(s.id) ?? []).sort((a, b) => b.skor - a.skor)
    const mastery = komp.length > 0 ? Math.round(komp.reduce((sum, k) => sum + k.skor, 0) / komp.length) : 0
    const avgNilai = nilaiMap.get(s.id) ?? 0
    const myWarnings = warnMap.get(s.id) ?? []
    const riskLevel = riskFromWarnings(myWarnings)
    const profile = profileMap.get(s.id)
    const engagement = engagementLabel(profile?.engagementScore ?? 0)
    const mstats = materiMap.get(s.id) ?? { dibuka: 0, selesai: 0 }
    const progress = mstats.dibuka > 0 ? Math.round((mstats.selesai / mstats.dibuka) * 100) : 0

    const strengths = komp.filter((k) => k.skor >= 70).slice(0, 2).map((k) => k.nama)
    const weaknesses = [...komp].reverse().filter((k) => k.skor < 60).slice(0, 2).map((k) => `${k.nama} (${k.skor}%)`)

    // Rekomendasi deterministik berbasis aturan — bukan LLM, bukan random
    const recommendations: string[] = []
    if (weaknesses.length > 0) {
      recommendations.push(`Berikan remedial/latihan tambahan untuk: ${weaknesses.map((w) => w.split(" (")[0]).join(", ")}.`)
    }
    if (avgNilai > 0 && avgNilai < 65) {
      recommendations.push(`Rata-rata nilai ${avgNilai} di bawah target 65 — pertimbangkan pengayaan dasar.`)
    }
    if (engagement === "Rendah") {
      recommendations.push("Engagement rendah — dorong aktivitas belajar atau sesi konsultasi singkat.")
    }
    if (riskLevel === "Prioritas Intervensi" || riskLevel === "Risiko Tinggi") {
      recommendations.push("Segera lakukan pendampingan intensif dan pantau perkembangan mingguan.")
    }
    if (recommendations.length === 0) {
      recommendations.push("Perkembangan baik — pertahankan dan berikan tantangan lanjutan.")
    }

    return {
      studentId: s.id,
      nama: s.nama,
      kelas: s.kelas?.nama ?? "-",
      progress,
      averageScore: avgNilai,
      mastery,
      engagement,
      riskLevel,
      strengths,
      weaknesses,
      recommendations,
    }
  })
}
