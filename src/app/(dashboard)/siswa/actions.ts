"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function getCurrentSiswa() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: {
      kelas: true,
      user: true,
    },
  })
  return siswa
}

export async function getDashboardStats() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: {
      kelas: true,
    },
  })

  if (!siswa) redirect("/login")

  const activeSemester = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  })

  const avgNilai = await prisma.nilai.aggregate({
    where: { siswaId: siswa.id },
    _avg: { nilai: true },
  })

  const [ujianAktif, tugasAktif] = !siswa.kelasId
    ? [0, 0]
    : await Promise.all([
        prisma.ujian.count({
          where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null },
        }),
        prisma.ujian.count({
          where: { kelasId: siswa.kelasId, isLatihan: true, status: "AKTIF", deletedAt: null },
        }),
      ])

  const pengumuman = await prisma.pengumuman.findMany({
    where: {
      OR: [
        { kelasId: siswa.kelasId },
        { tipe: "UMUM" },
      ],
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { user: { select: { name: true } } },
  })

  return {
    nama: siswa.nama,
    kelas: siswa.kelas?.nama ?? "-",
    semester: activeSemester ? `${activeSemester.nama} (${activeSemester.tahunAjaran.nama})` : "-",
    nilaiRataRata: avgNilai._avg.nilai ?? 0,
    ujianAktif,
    tugasAktif,
    pengumuman: pengumuman.map((p) => ({
      id: p.id,
      judul: p.judul,
      isi: p.isi,
      createdAt: p.createdAt.toISOString(),
      author: p.user.name ?? "-",
    })),
  }
}

export async function getUjianList(status?: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa?.kelasId) throw new Error("Kelas not assigned")

  const where: any = {
    kelasId: siswa.kelasId,
    isLatihan: false,
    deletedAt: null,
  }

  if (status && status !== "SEMUA") {
    where.status = status as any
  }

  const ujians = await prisma.ujian.findMany({
    where,
    include: {
      mataPelajaran: { select: { nama: true } },
      kelas: { select: { nama: true } },
      semester: { select: { nama: true } },
      _count: { select: { jawabanUjian: { where: { siswaId: siswa.id } } } },
    },
    orderBy: { tanggal: "desc" },
  })

  return ujians.map((u) => ({
    id: u.id,
    nama: u.nama,
    mapel: u.mataPelajaran.nama,
    kelas: u.kelas.nama,
    semester: u.semester.nama,
    tanggal: u.tanggal.toISOString(),
    durasi: u.durasi,
    status: u.status,
    sudahDikerjakan: u._count.jawabanUjian > 0,
    jumlahSoal: u.jumlahSoal,
    nilaiMinimum: u.nilaiMinimum,
  }))
}

export async function getUjianDetail(ujianId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      mataPelajaran: { select: { nama: true } },
      ujianSoal: {
        orderBy: { nomor: "asc" },
        include: {
          soal: true,
        },
      },
    },
  })

  if (!ujian) throw new Error("Ujian not found")

  return {
    id: ujian.id,
    nama: ujian.nama,
    mapel: ujian.mataPelajaran.nama,
    durasi: ujian.durasi,
    jumlahSoal: ujian.jumlahSoal,
    fullscreen: ujian.fullscreen,
    disableCopy: ujian.disableCopy,
    disablePaste: ujian.disablePaste,
    randomSoal: ujian.randomSoal,
    randomJawaban: ujian.randomJawaban,
    nilaiMinimum: ujian.nilaiMinimum,
    status: ujian.status,
    soal: ujian.ujianSoal.map((us) => ({
      id: us.soal.id,
      nomor: us.nomor,
      pertanyaan: us.soal.pertanyaan,
      gambar: us.soal.gambar,
      jenisSoal: us.soal.jenisSoal,
      tingkatKesulitan: us.soal.tingkatKesulitan,
      pilihanGanda: us.soal.pilihanGanda as { label: string; value: string }[] | null,
      poin: us.soal.poin,
    })),
  }
}

export async function startUjian(ujianId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa) redirect("/login")

  const existing = await prisma.jawabanUjian.findFirst({
    where: { ujianId, siswaId: siswa.id },
  })

  if (existing) {
    return { alreadyStarted: true }
  }

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      ujianSoal: {
        orderBy: { nomor: "asc" },
      },
    },
  })

  if (!ujian) throw new Error("Ujian not found")

  await prisma.jawabanUjian.createMany({
    data: ujian.ujianSoal.map((us) => ({
      ujianId: ujian.id,
      siswaId: siswa.id,
      soalId: us.soalId,
    })),
  })

  revalidatePath(`/siswa/ujian/${ujianId}`)
  return { alreadyStarted: false }
}

export async function autoSaveJawaban(
  ujianId: string,
  answers: Record<string, string>,
  raguRagu: string[]
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa) redirect("/login")

  for (const [soalId, jawaban] of Object.entries(answers)) {
    await prisma.jawabanUjian.upsert({
      where: {
        ujianId_siswaId_soalId: {
          ujianId,
          siswaId: siswa.id,
          soalId,
        },
      },
      update: {
        jawaban,
        raguRagu: raguRagu.includes(soalId),
      },
      create: {
        ujianId,
        siswaId: siswa.id,
        soalId,
        jawaban,
        raguRagu: raguRagu.includes(soalId),
      },
    })
  }

  return { success: true }
}

export async function submitUjian(ujianId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa) redirect("/login")

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      ujianSoal: {
        include: { soal: true },
      },
    },
  })

  if (!ujian) throw new Error("Ujian not found")

  const jawabans = await prisma.jawabanUjian.findMany({
    where: { ujianId, siswaId: siswa.id },
  })

  let totalPoin = 0
  let perolehPoin = 0
  const hasilSoal: { nomor: number; jawaban: string | null; jawabanBenar: string; isCorrect: boolean; poin: number }[] =
    []

  for (const us of ujian.ujianSoal) {
    const jawab = jawabans.find((j) => j.soalId === us.soal.id)
    const jawabanUser = jawab?.jawaban ?? ""
    const jawabanBenar = us.soal.jawaban
    const poin = us.soal.poin
    totalPoin += poin

    let isCorrect = false
    if (us.soal.jenisSoal === "PILIHAN_GANDA" || us.soal.jenisSoal === "TRUE_FALSE") {
      isCorrect = jawabanUser === jawabanBenar
    } else if (us.soal.jenisSoal === "ISIAN_SINGKAT") {
      isCorrect = jawabanUser.toLowerCase().trim() === jawabanBenar.toLowerCase().trim()
    } else {
      isCorrect = jawabanUser.trim() === jawabanBenar.trim()
    }

    if (isCorrect) {
      perolehPoin += poin
    }

    await prisma.jawabanUjian.update({
      where: { id: jawab?.id },
      data: { isCorrect, poin: isCorrect ? poin : 0 },
    })

    hasilSoal.push({
      nomor: us.nomor,
      jawaban: jawabanUser,
      jawabanBenar,
      isCorrect,
      poin,
    })
  }

  const nilaiAkhir = totalPoin > 0 ? Math.round((perolehPoin / totalPoin) * 100) : 0

  await prisma.nilai.create({
    data: {
      siswaId: siswa.id,
      ujianId: ujian.id,
      mataPelajaranId: ujian.mataPelajaranId,
      semesterId: ujian.semesterId,
      nilai: nilaiAkhir,
      jenis: ujian.isLatihan ? "LATIHAN" : "UJIAN",
      keterangan: `Nilai ${ujian.nama}`,
    },
  })

  revalidatePath(`/siswa/ujian/${ujianId}`)
  revalidatePath("/siswa/nilai")

  return {
    nilai: nilaiAkhir,
    totalPoin,
    perolehPoin,
    jumlahSoal: ujian.jumlahSoal,
    jumlahBenar: hasilSoal.filter((h) => h.isCorrect).length,
    hasilSoal,
  }
}

export async function getLatihanList() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa?.kelasId) throw new Error("Kelas not assigned")

  const latihans = await prisma.ujian.findMany({
    where: {
      kelasId: siswa.kelasId,
      isLatihan: true,
      status: "AKTIF",
      deletedAt: null,
    },
    include: {
      mataPelajaran: { select: { nama: true } },
      _count: { select: { jawabanUjian: { where: { siswaId: siswa.id } } } },
    },
    orderBy: { createdAt: "desc" },
  })

  return latihans.map((l) => ({
    id: l.id,
    nama: l.nama,
    mapel: l.mataPelajaran.nama,
    jumlahSoal: l.jumlahSoal,
    durasi: l.durasi,
    sudahDikerjakan: l._count.jawabanUjian > 0,
  }))
}

export async function getNilaiList(semesterId?: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
  })

  if (!siswa) redirect("/login")

  const where: any = { siswaId: siswa.id }
  if (semesterId) where.semesterId = semesterId

  const nilais = await prisma.nilai.findMany({
    where,
    include: {
      mataPelajaran: { select: { nama: true } },
      semester: { select: { nama: true } },
      ujian: { select: { nama: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const semesters = await prisma.semester.findMany({
    where: { deletedAt: null },
    include: { tahunAjaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })

  return {
    nilais: nilais.map((n) => ({
      id: n.id,
      mapel: n.mataPelajaran.nama,
      semester: n.semester.nama,
      jenis: n.jenis,
      nilai: n.nilai,
      keterangan: n.keterangan,
      tanggal: n.createdAt.toISOString(),
    })),
    semesters: semesters.map((s) => ({
      id: s.id,
      nama: `${s.nama} (${s.tahunAjaran.nama})`,
    })),
  }
}

export async function getRankingList(kelasId?: string, semesterId?: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: true },
  })

  if (!siswa) redirect("/login")

  const whereKelas: any = {}
  if (kelasId) {
    whereKelas.kelasId = kelasId
  } else if (siswa.kelasId) {
    whereKelas.kelasId = siswa.kelasId
  }

  const whereNilai: any = {}
  if (semesterId) whereNilai.semesterId = semesterId

  const semuaSiswa = await prisma.siswa.findMany({
    where: {
      ...whereKelas,
      deletedAt: null,
    },
    include: {
      kelas: { select: { nama: true } },
      nilai: {
        where: semesterId ? { semesterId } : {},
        select: { nilai: true, ujianId: true },
      },
    },
  })

  const siswaIds = semuaSiswa.map((s) => s.id)
  const completedUjianIds = [
    ...new Set(semuaSiswa.flatMap((s) => s.nilai.map((n) => n.ujianId).filter((id): id is string => id !== null))),
  ]

  let waktuMap: Record<string, number> = {}
  if (completedUjianIds.length > 0) {
    const jawabanTiming = await prisma.jawabanUjian.groupBy({
      by: ["siswaId", "ujianId"],
      _min: { createdAt: true },
      _max: { updatedAt: true },
      where: { siswaId: { in: siswaIds }, ujianId: { in: completedUjianIds } },
    })
    for (const jt of jawabanTiming) {
      if (jt._min.createdAt && jt._max.updatedAt) {
        const diffMs = jt._max.updatedAt.getTime() - jt._min.createdAt.getTime()
        waktuMap[jt.siswaId] = (waktuMap[jt.siswaId] ?? 0) + diffMs
      }
    }
  }

  const kelasData = await prisma.kelas.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true },
  })

  const rankingData = semuaSiswa
    .map((s) => ({
      id: s.id,
      nama: s.nama,
      kelas: s.kelas?.nama ?? "-",
      nilaiCount: s.nilai.length,
      rataRata: s.nilai.length > 0 ? s.nilai.reduce((sum, n) => sum + n.nilai, 0) / s.nilai.length : 0,
      totalWaktu: waktuMap[s.id] ?? 0,
    }))
    .sort((a, b) => b.rataRata - a.rataRata || a.totalWaktu - b.totalWaktu)
    .map((item, index) => ({
      ...item,
      peringkat: index + 1,
      isCurrentUser: item.id === siswa.id,
    }))

  const semesters = await prisma.semester.findMany({
    where: { deletedAt: null },
    include: { tahunAjaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })

  return {
    ranking: rankingData,
    kelasList: kelasData,
    semesters: semesters.map((s) => ({
      id: s.id,
      nama: `${s.nama} (${s.tahunAjaran.nama})`,
    })),
  }
}
