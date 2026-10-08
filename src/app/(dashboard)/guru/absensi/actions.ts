"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  absenMasukSesi,
  absenSelesaiSesi,
  getJadwalGuruDenganStatus,
  getKebijakanAbsensi,
  getRekapBulananGuru,
  getRiwayatSesiGuru,
  setStatusSesiGuru,
  type VerifikasiPayload,
} from "@/lib/absensi-guru"

async function getCurrentGuru() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email }, deletedAt: null },
  })
  if (!guru) redirect("/login")
  return guru
}

export async function getGuruKelasWithSiswa() {
  const guru = await getCurrentGuru()
  const kelasList = await prisma.kelas.findMany({
    where: { guruId: guru.id, deletedAt: null },
    include: {
      siswas: { where: { deletedAt: null }, orderBy: { nama: "asc" } },
    },
    orderBy: { nama: "asc" },
  })
  return kelasList
}

export async function getGuruJadwalByDate(tanggal: string) {
  const guru = await getCurrentGuru()
  const dayName = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long" })
  const hari = dayName.charAt(0).toUpperCase() + dayName.slice(1)

  // Jadwal sesuai pengajaran masing-masing guru (bukan hanya wali kelas)
  const pengajaran = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null },
    select: { kelasId: true, mataPelajaranId: true },
  })
  if (pengajaran.length === 0) return []

  // Ambil jadwal yang sesuai pasangan (kelas, mapel) yang diajar
  const orConditions = pengajaran.map((p) => ({
    kelasId: p.kelasId,
    mataPelajaranId: p.mataPelajaranId,
  }))

  const jadwal = await prisma.jadwalPelajaran.findMany({
    where: {
      hari,
      deletedAt: null,
      OR: orConditions,
    },
    include: {
      mataPelajaran: { select: { id: true, nama: true, kode: true } },
      kelas: { select: { id: true, nama: true } },
    },
    orderBy: [{ kelas: { nama: "asc" } }, { jamMulai: "asc" }],
  })

  // Status absensi guru per sesi → membuka/terkunci fitur Absensi Siswa
  const date = new Date(tanggal + "T00:00:00")
  date.setHours(0, 0, 0, 0)
  const sesiGuru = await prisma.absensiGuruSesi.findMany({
    where: { guruId: guru.id, tanggal: date },
    select: { jadwalPelajaranId: true, jamMasuk: true, status: true },
  })
  const sesiMap = new Map(sesiGuru.map((s) => [s.jadwalPelajaranId, s]))

  return jadwal.map((j) => ({ ...j, _key: j.id, guruAbsen: !!sesiMap.get(j.id)?.jamMasuk }))
}

export async function getAbsensiList(kelasId: string, mataPelajaranId: string) {
  const guru = await getCurrentGuru()
  // Izinkan wali kelas ATAU guru mapel pengampu
  const isPengampu = await prisma.pengajaran.findFirst({
    where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
  })
  const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
  if (!isPengampu && !isWali) throw new Error("Anda tidak mengampu mapel ini di kelas tersebut")

  return prisma.absensi.findMany({
    where: { kelasId, mataPelajaranId },
    include: {
      siswa: { include: { siswa: { select: { id: true, nama: true, nis: true } } } },
    },
    orderBy: { tanggal: "desc" },
  })
}

export async function saveAbsensi(
  kelasId: string,
  mataPelajaranId: string,
  tanggal: string,
  siswaStatus: { siswaId: string; status: string; keterangan?: string }[],
  jadwalPelajaranId?: string | null
) {
  const guru = await getCurrentGuru()
  // Validasi: hanya guru pengampu mapel di kelas tersebut atau wali kelas
  const isPengampu = await prisma.pengajaran.findFirst({
    where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
  })
  const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
  if (!isPengampu && !isWali) throw new Error("Anda tidak berhak mengisi absensi mapel ini")

  const date = new Date(tanggal + "T00:00:00")
  date.setHours(0, 0, 0, 0)

  // ── Alur per sesi: Absensi Siswa terbuka setelah guru absen masuk pada sesi ──
  if (jadwalPelajaranId && isPengampu) {
    const sesi = await prisma.absensiGuruSesi.findFirst({
      where: { guruId: guru.id, jadwalPelajaranId, tanggal: date },
      select: { jamMasuk: true },
    })
    if (!sesi?.jamMasuk) {
      throw new Error("Lakukan Absen Masuk sesi ini terlebih dahulu sebelum mengabsensi siswa")
    }
  }

  const existing = await prisma.absensi.findFirst({
    where: {
      kelasId,
      mataPelajaranId,
      tanggal: date,
      ...(jadwalPelajaranId ? { jadwalPelajaranId } : {}),
    },
  })

  let absensiId: string
  if (existing) {
    absensiId = existing.id
    await prisma.absensiSiswa.deleteMany({ where: { absensiId: existing.id } })
  } else {
    const absensi = await prisma.absensi.create({
      data: {
        kelasId,
        mataPelajaranId,
        tanggal: date,
        jadwalPelajaranId: jadwalPelajaranId ?? null,
        guruPencatatId: guru.id,
      },
    })
    absensiId = absensi.id
  }

  if (siswaStatus.length > 0) {
    await prisma.absensiSiswa.createMany({
      data: siswaStatus.map((ss) => ({
        absensiId,
        siswaId: ss.siswaId,
        status: ss.status as never,
        keterangan: ss.keterangan || null,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath("/guru/absensi")
  return { success: true }
}

// ── Koreksi absensi siswa dengan alasan (tercatat di audit log) ──
export async function koreksiAbsensiAction(
  absensiId: string,
  alasan: string,
  siswaStatus: { siswaId: string; status: string; keterangan?: string }[]
) {
  const guru = await getCurrentGuru()
  if (!alasan || alasan.trim().length < 3) throw new Error("Alasan koreksi wajib diisi (min. 3 karakter)")

  const absensi = await prisma.absensi.findUnique({
    where: { id: absensiId },
    select: { id: true, kelasId: true, mataPelajaranId: true, jadwalPelajaranId: true },
  })
  if (!absensi) throw new Error("Data absensi tidak ditemukan")

  const isPengampu = await prisma.pengajaran.findFirst({
    where: { guruId: guru.id, kelasId: absensi.kelasId, mataPelajaranId: absensi.mataPelajaranId, deletedAt: null },
    select: { id: true },
  })
  const isWali = await prisma.kelas.findFirst({
    where: { id: absensi.kelasId, guruId: guru.id, deletedAt: null },
    select: { id: true },
  })
  if (!isPengampu && !isWali) throw new Error("Anda tidak berhak mengoreksi absensi ini")

  const lama = await prisma.absensiSiswa.findMany({ where: { absensiId }, select: { siswaId: true, status: true, keterangan: true } })
  await prisma.absensiSiswa.deleteMany({ where: { absensiId } })
  if (siswaStatus.length > 0) {
    await prisma.absensiSiswa.createMany({
      data: siswaStatus.map((ss) => ({
        absensiId,
        siswaId: ss.siswaId,
        status: ss.status as never,
        keterangan: ss.keterangan || null,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.absensiSiswaLog.create({
    data: {
      absensiId,
      actorGuruId: guru.id,
      aksi: "KOREKSI",
      alasan: alasan.trim(),
      dataLama: lama as never,
      dataBaru: siswaStatus as never,
    },
  })

  revalidatePath("/guru/absensi")
  return { success: true }
}

export async function getAbsensiByKelasAndDate(kelasId: string, tanggal: string) {
  const guru = await getCurrentGuru()
  const date = new Date(tanggal)
  // Tampilkan semua absensi kelas tersebut jika guru adalah pengampu salah satu mapel di kelas itu atau wali kelas
  const isPengampuKelas = await prisma.pengajaran.findFirst({
    where: { guruId: guru.id, kelasId, deletedAt: null },
    select: { id: true },
  })
  const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
  if (!isPengampuKelas && !isWali) throw new Error("Anda tidak mengajar di kelas ini")

  return prisma.absensi.findMany({
    where: { kelasId, tanggal: date },
    include: {
      mataPelajaran: { select: { id: true, nama: true } },
      siswa: {
        include: { siswa: { select: { id: true, nama: true, nis: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

// ─── ABSENSI GURU (kehadiran guru sendiri) ───────────────────────

export async function getGuruAbsensi(tanggal: string) {
  const guru = await getCurrentGuru()
  const date = new Date(tanggal)
  date.setHours(0, 0, 0, 0)
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)

  return prisma.absensiGuru.findFirst({
    where: { guruId: guru.id, tanggal: { gte: date, lt: nextDay } },
  })
}

export async function saveGuruAbsensi(tanggal: string, status: string, keterangan?: string) {
  const guru = await getCurrentGuru()
  const date = new Date(tanggal)
  date.setHours(0, 0, 0, 0)

  const existing = await prisma.absensiGuru.findFirst({
    where: { guruId: guru.id, tanggal: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } },
  })

  if (existing) {
    return prisma.absensiGuru.update({
      where: { id: existing.id },
      data: { status: status as never, keterangan: keterangan || null, jamMasuk: new Date().toTimeString().slice(0, 5) },
    })
  }

  return prisma.absensiGuru.create({
    data: {
      guruId: guru.id,
      tanggal: date,
      status: status as never,
      keterangan: keterangan || null,
      jamMasuk: new Date().toTimeString().slice(0, 5),
    },
  })
}

export async function getGuruAbsensiRange(start: string, end: string) {
  const guru = await getCurrentGuru()
  return prisma.absensiGuru.findMany({
    where: {
      guruId: guru.id,
      tanggal: { gte: new Date(start), lte: new Date(end) },
    },
    orderBy: { tanggal: "desc" },
  })
}

// ─── ABSENSI PER SESI JAM PELAJARAN (sesuai jadwal mengajar) ──────

export async function getSesiAbsensiHariIni(tanggal: string) {
  const guru = await getCurrentGuru()
  return getJadwalGuruDenganStatus(guru.id, tanggal)
}

export async function absenMasukAction(
  jadwalPelajaranId: string,
  tanggal: string,
  verifikasi?: VerifikasiPayload | null
) {
  const guru = await getCurrentGuru()
  const hasil = await absenMasukSesi({ guruId: guru.id, jadwalPelajaranId, tanggal, verifikasi: verifikasi ?? undefined })
  revalidatePath("/guru/absensi")
  return hasil
}

export async function absenSelesaiAction(
  jadwalPelajaranId: string,
  tanggal: string,
  verifikasi?: VerifikasiPayload | null
) {
  const guru = await getCurrentGuru()
  const hasil = await absenSelesaiSesi({ guruId: guru.id, jadwalPelajaranId, tanggal, verifikasi: verifikasi ?? undefined })
  revalidatePath("/guru/absensi")
  return hasil
}

export async function absenStatusAction(
  jadwalPelajaranId: string,
  tanggal: string,
  status: "IZIN" | "SAKIT",
  keterangan?: string
) {
  const guru = await getCurrentGuru()
  const hasil = await setStatusSesiGuru({ guruId: guru.id, jadwalPelajaranId, tanggal, status, keterangan })
  revalidatePath("/guru/absensi")
  return hasil
}

export async function getRiwayatSesiAction(start: string, end: string) {
  const guru = await getCurrentGuru()
  return getRiwayatSesiGuru(guru.id, start, end)
}

export async function getRekapBulananAction(bulan: string) {
  const guru = await getCurrentGuru()
  return getRekapBulananGuru(guru.id, bulan)
}

export async function getKebijakanAbsensiAction() {
  await getCurrentGuru()
  return getKebijakanAbsensi()
}

// ─── PENGECAULIAN VERIFIKASI (wajib persetujuan Admin) ────────────
export async function ajukanPengecualianAction(
  jenis: "LOKASI" | "BIOMETRIK" | "FOTO",
  alasan: string,
  tanggal: string,
  jadwalPelajaranId?: string
) {
  const guru = await getCurrentGuru()
  if (!alasan || alasan.trim().length < 5) throw new Error("Alasan pengecualian wajib diisi (min. 5 karakter)")
  if (!["LOKASI", "BIOMETRIK", "FOTO"].includes(jenis)) throw new Error("Jenis pengecualian tidak valid")

  const date = new Date(tanggal + "T00:00:00")
  date.setHours(0, 0, 0, 0)

  const dup = await prisma.pengecualianAbsensi.findFirst({
    where: { guruId: guru.id, tanggal: date, jenis, status: "MENUNGGU" },
    select: { id: true },
  })
  if (dup) throw new Error("Pengecualian untuk tanggal ini sudah menunggu persetujuan Admin")

  await prisma.pengecualianAbsensi.create({
    data: {
      guruId: guru.id,
      tanggal: date,
      jenis,
      alasan: alasan.trim(),
      jadwalPelajaranId: jadwalPelajaranId ?? null,
    },
  })
  revalidatePath("/guru/absensi")
  return { success: true }
}

export async function getPengecualianSayaAction(tanggal: string) {
  const guru = await getCurrentGuru()
  const date = new Date(tanggal + "T00:00:00")
  date.setHours(0, 0, 0, 0)
  return prisma.pengecualianAbsensi.findMany({
    where: { guruId: guru.id, tanggal: date },
    orderBy: { createdAt: "desc" },
    select: { id: true, jenis: true, alasan: true, status: true, catatanAdmin: true, createdAt: true },
  })
}


