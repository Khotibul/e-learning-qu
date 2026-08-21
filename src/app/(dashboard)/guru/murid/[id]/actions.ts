"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function getStudentDetail(siswaId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email! }, deletedAt: null },
  })
  if (!guru) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    include: {
      kelas: true,
      jurusan: true,
      user: { select: { name: true, email: true } },
    },
  })
  if (!siswa || !siswa.kelasId) redirect("/guru/murid")

  // OWNERSHIP CHECK (fix IDOR): siswa harus berada di kelas yang diajar guru
  // (pengajaran) ATAU guru adalah wali kelasnya.
  const [mengajar, jadiWali] = await Promise.all([
    prisma.pengajaran.findFirst({
      where: { guruId: guru.id, kelasId: siswa.kelasId, deletedAt: null },
      select: { id: true },
    }),
    prisma.kelas.findFirst({
      where: { id: siswa.kelasId, guruId: guru.id, deletedAt: null },
      select: { id: true },
    }),
  ])
  if (!mengajar && !jadiWali) redirect("/guru/murid")

  const [nilaiList, penguasaanList, learningActivities, agentLogs, earlyWarnings, latihanList, rekomendasiList, profile] = await Promise.all([
    prisma.nilai.findMany({
      where: { siswaId },
      include: { mataPelajaran: { select: { nama: true } }, ujian: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.penguasaanKompetensi.findMany({
      where: { siswaId },
      include: { kompetensi: { select: { nama: true, mataPelajaran: { select: { nama: true } } } } },
      orderBy: { skor: "desc" },
    }),
    prisma.learningActivity.findMany({
      where: { siswaId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.agentLog.findMany({
      where: { siswaId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.earlyWarning.findMany({
      where: { siswaId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.latihanAI.findMany({
      where: { siswaId },
      include: { materi: { select: { judul: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.rekomendasi.findMany({
      where: { siswaId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.studentProfile.findUnique({ where: { siswaId } }),
  ])

  const rataNilai = nilaiList.length > 0
    ? Math.round(nilaiList.reduce((sum, n) => sum + n.nilai, 0) / nilaiList.length)
    : 0

  const rataMastery = penguasaanList.length > 0
    ? Math.round(penguasaanList.reduce((sum, p) => sum + p.skor, 0) / penguasaanList.length)
    : 0

  const kompetensiTerkuat = penguasaanList.length > 0 ? penguasaanList[0] : null
  const kompetensiTerlemah = penguasaanList.length > 0 ? penguasaanList[penguasaanList.length - 1] : null

  const openWarnings = earlyWarnings.filter((w) => !w.isResolved).length

  // Phase 17: insight agregat (strengths/weaknesses/rekomendasi) utk siswa ini
  const { getTeacherStudentInsights } = await import("@/lib/agents/teacher-analytics")
  const insights = await getTeacherStudentInsights(guru.id, { siswaIds: [siswaId] })
  const insight = insights[0] ?? null

  return {
    siswa: {
      id: siswa.id,
      nama: siswa.nama,
      nis: siswa.nis,
      nisn: siswa.nisn,
      email: siswa.user.email,
      kelas: siswa.kelas?.nama ?? "-",
      jurusan: siswa.jurusan?.nama ?? "-",
      alamat: siswa.alamat,
      noTelp: siswa.noTelp,
      jabatan: siswa.jabatan,
    },
    stats: {
      rataNilai,
      rataMastery,
      totalNilai: nilaiList.length,
      totalLatihan: latihanList.length,
      openWarnings,
      streak: profile?.streak ?? 0,
      engagement: profile?.engagementScore ?? 0,
    },
    kompetensiTerkuat: kompetensiTerkuat ? {
      nama: kompetensiTerkuat.kompetensi.nama,
      skor: kompetensiTerkuat.skor,
      mapel: kompetensiTerkuat.kompetensi.mataPelajaran?.nama ?? "",
    } : null,
    kompetensiTerlemah: kompetensiTerlemah && kompetensiTerlemah.id !== kompetensiTerkuat?.id ? {
      nama: kompetensiTerlemah.kompetensi.nama,
      skor: kompetensiTerlemah.skor,
      mapel: kompetensiTerlemah.kompetensi.mataPelajaran?.nama ?? "",
    } : null,
    nilaiList: nilaiList.map((n) => ({
      id: n.id,
      nilai: n.nilai,
      ujian: n.ujian?.nama ?? "-",
      mapel: n.mataPelajaran?.nama ?? "-",
      createdAt: n.createdAt.toISOString(),
    })),
    penguasaanList: penguasaanList.map((p) => ({
      nama: p.kompetensi.nama,
      skor: p.skor,
      mapel: p.kompetensi.mataPelajaran?.nama ?? "",
      jumlahLatihan: p.jumlahLatihan,
      jumlahBenar: p.jumlahSoalBenar,
    })),
    activities: learningActivities.map((a) => ({
      jenis: a.jenis,
      createdAt: a.createdAt.toISOString(),
      detail: a.detail,
      durationMs: a.durationMs,
    })),
    warnings: earlyWarnings.map((w) => ({
      id: w.id,
      tipe: w.tipe,
      severity: w.severity,
      message: w.message,
      skor: w.skor,
      isResolved: w.isResolved,
      createdAt: w.createdAt.toISOString(),
    })),
    agentLogs: agentLogs.map((l) => ({
      agent: l.agent,
      query: l.query,
      hasil: l.hasil?.slice(0, 200) ?? null,
      durasiMs: l.durasiMs,
      sukses: l.sukses,
      createdAt: l.createdAt.toISOString(),
    })),
    rekomendasi: rekomendasiList.map((r) => ({
      judul: r.judul,
      alasan: r.alasan,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    insight: insight ? {
      progress: insight.progress,
      mastery: insight.mastery,
      engagement: insight.engagement,
      riskLevel: insight.riskLevel,
      strengths: insight.strengths,
      weaknesses: insight.weaknesses,
      recommendations: insight.recommendations,
    } : null,
  }
}
