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

  const [allNilai, allSiswa, allWarnings] = await Promise.all([
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

    return {
      nama,
      rataRata: avg,
      jumlahSiswa: siswaSet.size,
      lulusRate: mapelNilai.length > 0 ? Math.round((lulus / mapelNilai.length) * 100) : 0,
      topikLemah: [],
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
    recentActivity: [],
  }
}
