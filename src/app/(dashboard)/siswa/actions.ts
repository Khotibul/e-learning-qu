"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"

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

    if (jawab) {
      await prisma.jawabanUjian.update({
        where: { id: jawab.id },
        data: { isCorrect, poin: isCorrect ? poin : 0 },
      })
    }

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

// ─── PENGATURAN (PROFIL) ─────────────────────────────────────

export async function getSiswaProfile() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { id: true, email: true, name: true, image: true } }, kelas: { select: { nama: true } } },
  })
}

export async function updateSiswaProfile(data: {
  nama?: string
  nis?: string
  nisn?: string
  alamat?: string
  noTelp?: string
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const result = await prisma.$transaction(async (tx) => {
    const siswa = await tx.siswa.update({
      where: { userId: session.user.id },
      data: {
        ...(data.nama !== undefined && { nama: data.nama }),
        ...(data.nis !== undefined && { nis: data.nis || null }),
        ...(data.nisn !== undefined && { nisn: data.nisn || null }),
        ...(data.alamat !== undefined && { alamat: data.alamat || null }),
        ...(data.noTelp !== undefined && { noTelp: data.noTelp || null }),
      },
    })
    if (data.nama) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { name: data.nama },
      })
    }
    return siswa
  })
  revalidatePath("/(dashboard)/siswa/pengaturan")
  return result
}

export async function updateSiswaPassword(data: { passwordLama: string; passwordBaru: string }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user?.password) throw new Error("Akun ini tidak memiliki password (mungkin menggunakan Google SSO)")

  const isValid = await bcrypt.compare(data.passwordLama, user.password)
  if (!isValid) throw new Error("Password lama tidak sesuai")

  const hashed = await bcrypt.hash(data.passwordBaru, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })
  return { success: true }
}

// ─── MATERI ──────────────────────────────────────────────────

export async function getSiswaMateris() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { kelasId: true },
  })
  if (!siswa?.kelasId) return []

  const mapels = await prisma.mataPelajaran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    select: { id: true, nama: true, kode: true },
    orderBy: { nama: "asc" },
  })

  const mapelIds = mapels.map((m) => m.id)
  const materis = await prisma.materi.findMany({
    where: { mataPelajaranId: { in: mapelIds }, deletedAt: null },
    include: {
      mataPelajaran: { select: { id: true, nama: true } },
      guru: { select: { nama: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const grouped: Record<string, { mapel: { id: string; nama: string }; items: typeof materis }> = {}
  for (const m of mapels) {
    grouped[m.id] = { mapel: m, items: [] }
  }
  for (const mat of materis) {
    if (grouped[mat.mataPelajaranId]) {
      grouped[mat.mataPelajaranId].items.push(mat)
    }
  }

  return Object.values(grouped).filter((g) => g.items.length > 0)
}

// ─── STRUKTUR KELAS ──────────────────────────────────────────

export async function getStrukturKelas() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { kelasId: true },
  })
  if (!siswa?.kelasId) return null

  const kelas = await prisma.kelas.findUnique({
    where: { id: siswa.kelasId },
    include: {
      guru: { select: { nama: true } },
      siswas: {
        where: { deletedAt: null, jabatan: { not: null } },
        select: { id: true, nama: true, jabatan: true },
        orderBy: { nama: "asc" },
      },
    },
  })
  return kelas
}

// ─── JADWAL PIKET ────────────────────────────────────────────

export async function getJadwalPiketSiswa() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true },
  })
  if (!siswa?.kelasId) return null

  const kelas = await prisma.kelas.findUnique({
    where: { id: siswa.kelasId },
    select: { nama: true },
  })

  const jadwalPiket = await prisma.jadwalPiket.findMany({
    where: { kelasId: siswa.kelasId },
    include: { siswa: { select: { id: true, nama: true } } },
    orderBy: [{ hari: "asc" }, { siswa: { nama: "asc" } }],
  })

  return { kelas, jadwalPiket }
}

// ─── JADWAL PELAJARAN ────────────────────────────────────────

export async function getJadwalPelajaranSiswa() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { kelasId: true },
  })
  if (!siswa?.kelasId) return []

  return prisma.jadwalPelajaran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    include: { mataPelajaran: { select: { nama: true, guru: { select: { nama: true } } } } },
    orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
  })
}

// ─── IURAN ────────────────────────────────────────────────────

export async function getIuranSiswa() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true },
  })
  if (!siswa?.kelasId) return []

  const iuran = await prisma.iuran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    include: {
      pembayaran: {
        where: { siswaId: siswa.id },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return iuran.map((i) => ({
    id: i.id,
    nama: i.nama,
    nominal: i.nominal,
    tenggat: i.tenggat,
    deskripsi: i.deskripsi,
    status: i.pembayaran.length > 0 ? i.pembayaran[0].status : "BELUM",
    pembayaranId: i.pembayaran.length > 0 ? i.pembayaran[0].id : null,
  }))
}

export async function bayarIuran(iuranId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true },
  })
  if (!siswa) throw new Error("Siswa tidak ditemukan")

  const iuran = await prisma.iuran.findUnique({
    where: { id: iuranId },
    select: { kelasId: true, nominal: true },
  })
  if (!iuran || iuran.kelasId !== siswa.kelasId) throw new Error("Iuran tidak ditemukan")

  await prisma.pembayaranIuran.upsert({
    where: { iuranId_siswaId: { iuranId, siswaId: siswa.id } },
    update: { jumlah: iuran.nominal, status: "LUNAS", tanggalBayar: new Date() },
    create: { iuranId, siswaId: siswa.id, jumlah: iuran.nominal, status: "LUNAS" },
  })
  revalidatePath("/(dashboard)/siswa/iuran")
  return { success: true }
}

// ─── BENDAHARA HELPER ─────────────────────────────────────────

async function getCurrentBendahara() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id, jabatan: "BENDAHARA" },
  })
  if (!siswa) throw new Error("Hanya bendahara yang dapat mengakses fitur ini")
  return siswa
}

// ─── BENDAHARA: IURAN ─────────────────────────────────────────

export async function getBendaharaIuran() {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  return prisma.iuran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    include: {
      _count: { select: { pembayaran: true } },
      pembayaran: {
        include: { siswa: { select: { id: true, nama: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createBendaharaIuran(data: {
  nama: string; nominal: number; tenggat?: string; deskripsi?: string
}) {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  await prisma.iuran.create({
    data: {
      kelasId: siswa.kelasId,
      nama: data.nama,
      nominal: data.nominal,
      tenggat: data.tenggat ? new Date(data.tenggat) : null,
      deskripsi: data.deskripsi || null,
    },
  })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

export async function deleteBendaharaIuran(id: string) {
  const siswa = await getCurrentBendahara()
  const iuran = await prisma.iuran.findUnique({
    where: { id },
    select: { kelasId: true },
  })
  if (!iuran || iuran.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.iuran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

export async function recordBendaharaPembayaranIuran(iuranId: string, siswaId: string, jumlah: number) {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  const iuran = await prisma.iuran.findUnique({
    where: { id: iuranId },
    select: { kelasId: true },
  })
  if (!iuran || iuran.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.pembayaranIuran.upsert({
    where: { iuranId_siswaId: { iuranId, siswaId } },
    update: { jumlah, status: "LUNAS", tanggalBayar: new Date() },
    create: { iuranId, siswaId, jumlah, status: "LUNAS" },
  })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

// ─── BENDAHARA: DENDA ─────────────────────────────────────────

export async function getBendaharaDenda() {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  return prisma.denda.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    include: {
      _count: { select: { pembayaran: true } },
      pembayaran: {
        include: { siswa: { select: { id: true, nama: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createBendaharaDenda(data: {
  nama: string; nominal: number; deskripsi?: string
}) {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  await prisma.denda.create({
    data: {
      kelasId: siswa.kelasId,
      nama: data.nama,
      nominal: data.nominal,
      deskripsi: data.deskripsi || null,
    },
  })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

export async function deleteBendaharaDenda(id: string) {
  const siswa = await getCurrentBendahara()
  const denda = await prisma.denda.findUnique({
    where: { id },
    select: { kelasId: true },
  })
  if (!denda || denda.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.denda.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

export async function recordBendaharaPembayaranDenda(dendaId: string, siswaId: string, jumlah: number) {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  const denda = await prisma.denda.findUnique({
    where: { id: dendaId },
    select: { kelasId: true },
  })
  if (!denda || denda.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.pembayaranDenda.upsert({
    where: { dendaId_siswaId: { dendaId, siswaId } },
    update: { jumlah, status: "LUNAS", tanggalBayar: new Date() },
    create: { dendaId, siswaId, jumlah, status: "LUNAS" },
  })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

// ─── BENDAHARA: PENGELUARAN ───────────────────────────────────

export async function getBendaharaPengeluaran() {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) return []
  return prisma.pengeluaranKelas.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    orderBy: { tanggal: "desc" },
  })
}

export async function createBendaharaPengeluaran(data: {
  jumlah: number; keterangan: string; tanggal?: string
}) {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  await prisma.pengeluaranKelas.create({
    data: {
      kelasId: siswa.kelasId,
      jumlah: data.jumlah,
      keterangan: data.keterangan,
      tanggal: data.tanggal ? new Date(data.tanggal) : new Date(),
    },
  })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

export async function deleteBendaharaPengeluaran(id: string) {
  const siswa = await getCurrentBendahara()
  const item = await prisma.pengeluaranKelas.findUnique({
    where: { id },
    select: { kelasId: true },
  })
  if (!item || item.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.pengeluaranKelas.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/siswa/bendahara")
  return { success: true }
}

// ─── BENDAHARA: SUMMARY ───────────────────────────────────────

export async function getBendaharaSummary() {
  const siswa = await getCurrentBendahara()
  if (!siswa.kelasId) return null
  const [totalIuran, totalDenda, totalPengeluaran] = await Promise.all([
    prisma.pembayaranIuran.aggregate({
      where: { iuran: { kelasId: siswa.kelasId, deletedAt: null } },
      _sum: { jumlah: true },
    }),
    prisma.pembayaranDenda.aggregate({
      where: { denda: { kelasId: siswa.kelasId, deletedAt: null } },
      _sum: { jumlah: true },
    }),
    prisma.pengeluaranKelas.aggregate({
      where: { kelasId: siswa.kelasId, deletedAt: null },
      _sum: { jumlah: true },
    }),
  ])
  const pemasukanIuran = totalIuran._sum.jumlah || 0
  const pemasukanDenda = totalDenda._sum.jumlah || 0
  const totalPemasukan = pemasukanIuran + pemasukanDenda
  const totalKeluar = totalPengeluaran._sum.jumlah || 0
  return { pemasukanIuran, pemasukanDenda, totalPemasukan, totalPengeluaran: totalKeluar, sisaKas: totalPemasukan - totalKeluar }
}

// ─── SEKRETARIS HELPER ─────────────────────────────────────────

async function getCurrentSekretaris() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id, jabatan: "SEKRETARIS" },
  })
  if (!siswa) throw new Error("Hanya sekretaris yang dapat mengakses fitur ini")
  return siswa
}

// ─── SEKRETARIS: JADWAL PIKET ──────────────────────────────────

export async function getSekretarisPiket() {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) return []
  return prisma.jadwalPiket.findMany({
    where: { kelasId: siswa.kelasId },
    include: { siswa: { select: { id: true, nama: true } } },
    orderBy: [{ hari: "asc" }, { siswa: { nama: "asc" } }],
  })
}

export async function getSekretarisSiswa() {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) return []
  return prisma.siswa.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  })
}

export async function createSekretarisPiket(siswaId: string, hari: string) {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  await prisma.jadwalPiket.create({
    data: { kelasId: siswa.kelasId, siswaId, hari },
  })
  revalidatePath("/(dashboard)/siswa/sekretaris")
  return { success: true }
}

export async function deleteSekretarisPiket(id: string) {
  const siswa = await getCurrentSekretaris()
  const item = await prisma.jadwalPiket.findUnique({
    where: { id },
    select: { kelasId: true },
  })
  if (!item || item.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.jadwalPiket.delete({ where: { id } })
  revalidatePath("/(dashboard)/siswa/sekretaris")
  return { success: true }
}

// ─── SEKRETARIS: JADWAL PELAJARAN ─────────────────────────────

export async function getSekretarisJadwalPelajaran() {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) return []
  return prisma.jadwalPelajaran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    include: { mataPelajaran: { select: { id: true, nama: true, guru: { select: { nama: true } } } } },
    orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
  })
}

export async function getSekretarisMapel() {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) return []
  return prisma.mataPelajaran.findMany({
    where: { kelasId: siswa.kelasId, deletedAt: null },
    select: { id: true, kode: true, nama: true },
    orderBy: { nama: "asc" },
  })
}

export async function createSekretarisJadwalPelajaran(data: {
  mataPelajaranId: string; hari: string; jamMulai: string; jamSelesai: string
}) {
  const siswa = await getCurrentSekretaris()
  if (!siswa.kelasId) throw new Error("Anda belum memiliki kelas")
  await prisma.jadwalPelajaran.create({
    data: { kelasId: siswa.kelasId, ...data },
  })
  revalidatePath("/(dashboard)/siswa/sekretaris")
  return { success: true }
}

export async function deleteSekretarisJadwalPelajaran(id: string) {
  const siswa = await getCurrentSekretaris()
  const item = await prisma.jadwalPelajaran.findUnique({
    where: { id },
    select: { kelasId: true },
  })
  if (!item || item.kelasId !== siswa.kelasId) throw new Error("Akses ditolak")
  await prisma.jadwalPelajaran.delete({ where: { id } })
  revalidatePath("/(dashboard)/siswa/sekretaris")
  return { success: true }
}
