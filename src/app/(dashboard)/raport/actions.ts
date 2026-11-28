"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  DEFAULT_PENGATURAN,
  deskripsiCapaian,
  hitungNilaiAkhir,
  predikatDari,
  rataRata,
  type BobotRaport,
} from "@/lib/raport"

// ─── GUARD AKSES ─────────────────────────────────────────────

type Pengguna = { id: string; role: string }

async function penggunaAktif(): Promise<Pengguna> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Sesi berakhir, silakan masuk ulang")
  return { id: session.user.id, role: (session.user.role as string) ?? "" }
}

async function guruDari(userId: string) {
  const guru = await prisma.guru.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, nama: true },
  })
  if (!guru) throw new Error("Data guru tidak ditemukan")
  return guru
}

async function staf(user: Pengguna) {
  if (user.role === "ADMIN") return { admin: true as const, guru: null }
  if (user.role !== "GURU") throw new Error("Akses ditolak")
  return { admin: false as const, guru: await guruDari(user.id) }
}

async function pastikanWaliAtauAdmin(kelasId: string, user: Pengguna) {
  const { admin, guru } = await staf(user)
  if (admin) return { admin, guru, wali: true as const }
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru!.id, deletedAt: null },
    select: { id: true },
  })
  if (!kelas) throw new Error("Akses ditolak: Anda bukan wali kelas ini")
  return { admin, guru, wali: true as const }
}

async function pastikanGuruMapel(mapelId: string, kelasId: string, user: Pengguna) {
  const { admin, guru } = await staf(user)
  if (admin) return { admin, guru }
  const pengajaran = await prisma.pengajaran.findFirst({
    where: {
      guruId: guru!.id,
      kelasId,
      mataPelajaranId: mapelId,
      deletedAt: null,
      mataPelajaran: { deletedAt: null },
    },
    select: { id: true },
  })
  if (!pengajaran) throw new Error("Akses ditolak: Anda tidak mengajar mata pelajaran ini di kelas tersebut")
  return { admin, guru }
}

async function pengaturanSemester(semesterId: string): Promise<BobotRaport & { kktp: number }> {
  const p = await prisma.pengaturanRaport.findUnique({ where: { semesterId } })
  return {
    bobotFormatif: p?.bobotFormatif ?? DEFAULT_PENGATURAN.bobotFormatif,
    bobotSumatif: p?.bobotSumatif ?? DEFAULT_PENGATURAN.bobotSumatif,
    bobotProyek: p?.bobotProyek ?? DEFAULT_PENGATURAN.bobotProyek,
    bobotPraktik: p?.bobotPraktik ?? DEFAULT_PENGATURAN.bobotPraktik,
    ambangA: p?.ambangA ?? DEFAULT_PENGATURAN.ambangA,
    ambangB: p?.ambangB ?? DEFAULT_PENGATURAN.ambangB,
    ambangC: p?.ambangC ?? DEFAULT_PENGATURAN.ambangC,
    kktp: p?.kktp ?? DEFAULT_PENGATURAN.kktp,
  }
}

function segarkan() {
  revalidatePath("/admin/raport")
  revalidatePath("/guru/raport")
}

// ─── REFERENSI ───────────────────────────────────────────────

export async function getRaportRefs() {
  const user = await penggunaAktif()
  const { admin, guru } = await staf(user)

  const [semesters, kelas, mapels] = await Promise.all([
    prisma.semester.findMany({
      where: { deletedAt: null },
      select: { id: true, nama: true, isAktif: true, tahunAjaran: { select: { nama: true } } },
      orderBy: [{ isAktif: "desc" }, { createdAt: "desc" }],
    }),
    prisma.kelas.findMany({
      where: {
        deletedAt: null,
        ...(admin
          ? {}
          : {
              OR: [
                { guruId: guru!.id },
                { pengajaran: { some: { guruId: guru!.id, deletedAt: null } } },
              ],
            }),
      },
      select: { id: true, nama: true, tingkat: true, guruId: true, guru: { select: { nama: true } } },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    }),
    prisma.mataPelajaran.findMany({
      where: {
        deletedAt: null,
        ...(admin
          ? {}
          : {
              OR: [
                { pengajaran: { some: { guruId: guru!.id, deletedAt: null } } },
                { komponenNilai: { some: { guruId: guru!.id, deletedAt: null } } },
                { ujians: { some: { guruId: guru!.id, deletedAt: null } } },
              ],
            }),
      },
      select: { id: true, nama: true, kode: true, semesterId: true },
      orderBy: { nama: "asc" },
    }),
  ])

  return {
    semesters,
    kelas,
    mapels,
    isAdmin: admin,
    guruId: guru?.id ?? null,
    waliKelasIds: kelas.filter((k) => !admin && k.guruId === guru?.id).map((k) => k.id),
  }
}

export async function getPengaturanRaport(semesterId: string) {
  await staf(await penggunaAktif())
  const p = await prisma.pengaturanRaport.findUnique({ where: { semesterId } })
  return {
    ...DEFAULT_PENGATURAN,
    namaKepalaSekolah: "",
    nipKepalaSekolah: "",
    catatanKepala: "",
    ...(p ?? {}),
  }
}

export async function simpanPengaturanRaport(input: {
  semesterId: string
  bobotFormatif: number
  bobotSumatif: number
  bobotProyek: number
  bobotPraktik: number
  kktp: number
  ambangA: number
  ambangB: number
  ambangC: number
  tampilkanPeringkat: boolean
  namaKepalaSekolah?: string
  nipKepalaSekolah?: string
  catatanKepala?: string
}) {
  const user = await penggunaAktif()
  if (user.role !== "ADMIN") throw new Error("Hanya admin yang dapat mengubah pengaturan raport")
  const angka = [input.bobotFormatif, input.bobotSumatif, input.bobotProyek, input.bobotPraktik]
  if (angka.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) throw new Error("Bobot harus 0–100")
  if (angka.reduce((a, b) => a + b, 0) <= 0) throw new Error("Total bobot harus lebih dari 0")
  if (!(input.ambangA > input.ambangB && input.ambangB > input.ambangC)) {
    throw new Error("Ambang predikat harus berurutan: A > B > C")
  }
  const data = {
    bobotFormatif: Math.round(input.bobotFormatif),
    bobotSumatif: Math.round(input.bobotSumatif),
    bobotProyek: Math.round(input.bobotProyek),
    bobotPraktik: Math.round(input.bobotPraktik),
    kktp: Math.round(input.kktp),
    ambangA: Math.round(input.ambangA),
    ambangB: Math.round(input.ambangB),
    ambangC: Math.round(input.ambangC),
    tampilkanPeringkat: input.tampilkanPeringkat,
    namaKepalaSekolah: input.namaKepalaSekolah?.trim() || null,
    nipKepalaSekolah: input.nipKepalaSekolah?.trim() || null,
    catatanKepala: input.catatanKepala?.trim() || null,
  }
  await prisma.pengaturanRaport.upsert({
    where: { semesterId: input.semesterId },
    create: { semesterId: input.semesterId, ...data },
    update: data,
  })
  segarkan()
}

// ─── KOMPONEN NILAI ──────────────────────────────────────────

export async function getKomponens(mapelId: string, kelasId: string, semesterId: string) {
  const user = await penggunaAktif()
  await pastikanGuruMapel(mapelId, kelasId, user)
  return prisma.komponenNilai.findMany({
    where: { mapelId, kelasId, semesterId, deletedAt: null },
    select: {
      id: true,
      nama: true,
      jenis: true,
      bobot: true,
      tanggal: true,
      _count: { select: { nilais: { where: { nilai: { not: null } } } } },
    },
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
  })
}

export async function getNilaiGrid(komponenId: string) {
  const user = await penggunaAktif()
  const komponen = await prisma.komponenNilai.findFirst({
    where: { id: komponenId, deletedAt: null },
    select: {
      id: true,
      nama: true,
      jenis: true,
      bobot: true,
      mapelId: true,
      kelasId: true,
      semesterId: true,
      mapel: { select: { nama: true } },
      kelas: { select: { nama: true } },
    },
  })
  if (!komponen) throw new Error("Komponen nilai tidak ditemukan")
  await pastikanGuruMapel(komponen.mapelId, komponen.kelasId, user)

  const [siswas, nilais] = await Promise.all([
    prisma.siswa.findMany({
      where: { kelasId: komponen.kelasId, deletedAt: null },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: "asc" },
    }),
    prisma.nilaiKomponen.findMany({
      where: { komponenId },
      select: { siswaId: true, nilai: true, catatan: true },
    }),
  ])
  const bySiswa = new Map(nilais.map((n) => [n.siswaId, n]))
  return {
    komponen,
    siswas: siswas.map((s) => ({
      ...s,
      nilai: bySiswa.get(s.id)?.nilai ?? null,
      catatan: bySiswa.get(s.id)?.catatan ?? "",
    })),
  }
}

export async function buatKomponen(input: {
  nama: string
  jenis: "FORMATIF" | "SUMATIF" | "PROYEK" | "PRAKTIK"
  bobot: number
  tanggal: string
  mapelId: string
  kelasId: string
  semesterId: string
}) {
  const user = await penggunaAktif()
  const { admin, guru } = await pastikanGuruMapel(input.mapelId, input.kelasId, user)
  const nama = input.nama.trim()
  if (!nama) throw new Error("Nama komponen wajib diisi")
  if (!Number.isFinite(input.bobot) || input.bobot <= 0) throw new Error("Bobot komponen harus lebih dari 0")

  let guruId = guru?.id ?? null
  if (admin) {
    const pengajaran = await prisma.pengajaran.findFirst({
      where: { mataPelajaranId: input.mapelId, kelasId: input.kelasId, deletedAt: null },
      select: { guruId: true },
    })
    guruId = pengajaran?.guruId ?? null
  }
  if (!guruId) throw new Error("Tentukan guru pengampu terlebih dahulu di menu Jadwal Mengajar")

  const data = {
    nama,
    jenis: input.jenis,
    bobot: Math.round(input.bobot),
    tanggal: new Date(input.tanggal || Date.now()),
    mapelId: input.mapelId,
    kelasId: input.kelasId,
    semesterId: input.semesterId,
    guruId,
  }
  // Nama komponen unik per mapel/kelas/semester. Bila pernah dihapus,
  // aktifkan kembali baris lama agar tidak bentrok dengan unique constraint.
  const lama = await prisma.komponenNilai.findUnique({
    where: {
      mapelId_kelasId_semesterId_nama: {
        mapelId: input.mapelId,
        kelasId: input.kelasId,
        semesterId: input.semesterId,
        nama,
      },
    },
    select: { id: true },
  })
  const komponen = lama
    ? await prisma.komponenNilai.update({
        where: { id: lama.id },
        data: { ...data, deletedAt: null },
        select: { id: true },
      })
    : await prisma.komponenNilai.create({ data, select: { id: true } })
  segarkan()
  return komponen
}

export async function hapusKomponen(id: string) {
  const user = await penggunaAktif()
  const komponen = await prisma.komponenNilai.findFirst({
    where: { id, deletedAt: null },
    select: { mapelId: true, kelasId: true },
  })
  if (!komponen) throw new Error("Komponen nilai tidak ditemukan")
  await pastikanGuruMapel(komponen.mapelId, komponen.kelasId, user)
  await prisma.komponenNilai.update({ where: { id }, data: { deletedAt: new Date() } })
  segarkan()
}

export async function simpanNilaiKomponen(komponenId: string, rows: { siswaId: string; nilai: number | null; catatan?: string }[]) {
  const user = await penggunaAktif()
  const komponen = await prisma.komponenNilai.findFirst({
    where: { id: komponenId, deletedAt: null },
    select: { mapelId: true, kelasId: true },
  })
  if (!komponen) throw new Error("Komponen nilai tidak ditemukan")
  await pastikanGuruMapel(komponen.mapelId, komponen.kelasId, user)

  for (const row of rows) {
    if (row.nilai != null && (!Number.isFinite(row.nilai) || row.nilai < 0 || row.nilai > 100)) {
      throw new Error("Nilai harus berada di antara 0 dan 100")
    }
  }
  await prisma.$transaction(
    rows.map((row) =>
      prisma.nilaiKomponen.upsert({
        where: { komponenId_siswaId: { komponenId, siswaId: row.siswaId } },
        create: { komponenId, siswaId: row.siswaId, nilai: row.nilai, catatan: row.catatan?.trim() || null },
        update: { nilai: row.nilai, catatan: row.catatan?.trim() || null },
      }),
    ),
  )
  segarkan()
}

// ─── REKAP ───────────────────────────────────────────────────

type BarisRekap = {
  siswas: { id: string; nama: string; nis: string | null; nisn: string | null }[]
  mapels: { id: string; nama: string; kode: string }[]
  nilai: Record<string, Record<string, number | null>>
  sumber: Record<string, Record<string, "KOMPONEN" | "UJIAN" | null>>
  jumlahKomponen: Record<string, number>
  pengaturan: BobotRaport & { kktp: number }
}

async function susunRekap(kelasId: string, semesterId: string): Promise<BarisRekap> {
  const [siswas, pengajarans, komponens, nilaiUjian, pengaturan] = await Promise.all([
    prisma.siswa.findMany({
      where: { kelasId, deletedAt: null },
      select: { id: true, nama: true, nis: true, nisn: true },
      orderBy: { nama: "asc" },
    }),
    prisma.pengajaran.findMany({
      where: { kelasId, deletedAt: null, mataPelajaran: { semesterId, deletedAt: null } },
      select: { mataPelajaran: { select: { id: true, nama: true, kode: true } } },
    }),
    prisma.komponenNilai.findMany({
      where: { kelasId, semesterId, deletedAt: null },
      select: {
        id: true,
        mapelId: true,
        jenis: true,
        bobot: true,
        nilais: { select: { siswaId: true, nilai: true } },
      },
    }),
    prisma.nilai.findMany({
      where: { semesterId, deletedAt: null, siswa: { kelasId, deletedAt: null } },
      select: {
        siswaId: true,
        mataPelajaranId: true,
        nilai: true,
        ujian: { select: { komponenRaport: true } },
      },
    }),
    pengaturanSemester(semesterId),
  ])

  // Mapel yang punya nilai pada semester ini ikut dimasukkan, meskipun
  // data mapelnya tercatat di semester lain. Dengan begitu nilai yang tampil
  // di menu Nilai selalu ikut terhitung di raport.
  const mapelIds = new Set<string>([
    ...pengajarans.map((p) => p.mataPelajaran.id),
    ...komponens.map((k) => k.mapelId),
    ...nilaiUjian.map((n) => n.mataPelajaranId),
  ])
  const mapels =
    mapelIds.size === 0
      ? []
      : await prisma.mataPelajaran.findMany({
          where: { id: { in: [...mapelIds] }, deletedAt: null },
          select: { id: true, nama: true, kode: true },
          orderBy: { nama: "asc" },
        })

  const komponenByMapel = new Map<string, typeof komponens>()
  for (const k of komponens) {
    const arr = komponenByMapel.get(k.mapelId) ?? []
    arr.push(k)
    komponenByMapel.set(k.mapelId, arr)
  }
  // Nilai ujian/latihan yang sudah ditandai komponen raport ikut dihitung
  // sebagai komponen pada jenisnya. Sisanya tetap menjadi cadangan rata-rata
  // bila mapel belum punya komponen sama sekali.
  const nilaiUjianBySiswaMapel = new Map<string, number[]>()
  const komponenUjianBySiswaMapel = new Map<string, { jenis: string; bobot: number; nilai: number }[]>()
  for (const n of nilaiUjian) {
    const key = `${n.siswaId}:${n.mataPelajaranId}`
    const jenis = n.ujian?.komponenRaport
    if (jenis) {
      const arr = komponenUjianBySiswaMapel.get(key) ?? []
      arr.push({ jenis, bobot: 1, nilai: n.nilai })
      komponenUjianBySiswaMapel.set(key, arr)
    } else {
      const arr = nilaiUjianBySiswaMapel.get(key) ?? []
      arr.push(n.nilai)
      nilaiUjianBySiswaMapel.set(key, arr)
    }
  }

  const nilai: BarisRekap["nilai"] = {}
  const sumber: BarisRekap["sumber"] = {}
  for (const siswa of siswas) {
    nilai[siswa.id] = {}
    sumber[siswa.id] = {}
    for (const mapel of mapels) {
      const komponenMapel = komponenByMapel.get(mapel.id) ?? []
      const nilaiKomponen = [
        ...komponenMapel.map((k) => ({
          jenis: k.jenis,
          bobot: k.bobot,
          nilai: k.nilais.find((n) => n.siswaId === siswa.id)?.nilai ?? null,
        })),
        ...(komponenUjianBySiswaMapel.get(`${siswa.id}:${mapel.id}`) ?? []),
      ]
      const dariKomponen = hitungNilaiAkhir(nilaiKomponen, pengaturan)
      const ujian = nilaiUjianBySiswaMapel.get(`${siswa.id}:${mapel.id}`) ?? []
      const dariUjian = rataRata(ujian)
      nilai[siswa.id][mapel.id] = dariKomponen ?? dariUjian
      sumber[siswa.id][mapel.id] = dariKomponen != null ? "KOMPONEN" : dariUjian != null ? "UJIAN" : null
    }
  }

  const jumlahKomponen: Record<string, number> = {}
  for (const mapel of mapels) jumlahKomponen[mapel.id] = komponenByMapel.get(mapel.id)?.length ?? 0

  return { siswas, mapels, nilai, sumber, jumlahKomponen, pengaturan }
}

export async function getRekapKelas(kelasId: string, semesterId: string) {
  const user = await penggunaAktif()
  if (user.role !== "ADMIN") {
    const { guru } = await staf(user)
    const boleh =
      (await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru!.id, deletedAt: null }, select: { id: true } })) ||
      (await prisma.pengajaran.findFirst({ where: { kelasId, guruId: guru!.id, deletedAt: null }, select: { id: true } }))
    if (!boleh) throw new Error("Akses ditolak")
  }
  return susunRekap(kelasId, semesterId)
}

export async function getRekapNilaiAdmin(params: {
  kelasId?: string
  mapelId?: string
  semesterId?: string
  search?: string
  page?: number
  limit?: number
}) {
  const user = await penggunaAktif()
  if (user.role !== "ADMIN") throw new Error("Akses ditolak")

  const page = Math.max(1, params.page ?? 1)
  const limit = Math.max(1, params.limit ?? 20)
  const semesterId =
    params.semesterId ||
    (
      await prisma.semester.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: [{ isAktif: "desc" }, { createdAt: "desc" }],
      })
    )?.id

  const kosong = { data: [], total: 0, totalPages: 0, page, limit, semesterId: semesterId ?? null, summary: { terisi: 0, kosong: 0, rataRata: null as number | null } }
  if (!semesterId) return kosong

  const kelasList = await prisma.kelas.findMany({
    where: { deletedAt: null, ...(params.kelasId ? { id: params.kelasId } : {}) },
    select: { id: true, nama: true, tingkat: true },
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
  })

  const rekaps = await Promise.all(
    kelasList.map(async (kelas) => ({ kelas, rekap: await susunRekap(kelas.id, semesterId) })),
  )

  const rows: {
    id: string
    siswa: { id: string; nama: string; nis: string | null; nisn: string | null }
    kelas: { id: string; nama: string }
    mapel: { id: string; nama: string; kode: string }
    nilai: number | null
    predikat: string | null
    sumber: "KOMPONEN" | "UJIAN" | null
  }[] = []

  for (const { kelas, rekap } of rekaps) {
    for (const siswa of rekap.siswas) {
      for (const mapel of rekap.mapels) {
        if (params.mapelId && mapel.id !== params.mapelId) continue
        const nilai = rekap.nilai[siswa.id]?.[mapel.id] ?? null
        rows.push({
          id: `${siswa.id}:${mapel.id}`,
          siswa: { id: siswa.id, nama: siswa.nama, nis: siswa.nis, nisn: siswa.nisn },
          kelas: { id: kelas.id, nama: kelas.nama },
          mapel: { id: mapel.id, nama: mapel.nama, kode: mapel.kode },
          nilai,
          predikat: nilai == null ? null : predikatDari(nilai, rekap.pengaturan),
          sumber: rekap.sumber[siswa.id]?.[mapel.id] ?? null,
        })
      }
    }
  }

  const cari = params.search?.trim().toLowerCase()
  const tersaring = cari
    ? rows.filter((r) =>
        [r.siswa.nama, r.siswa.nis ?? "", r.kelas.nama, r.mapel.nama, r.mapel.kode]
          .join(" ")
          .toLowerCase()
          .includes(cari),
      )
    : rows

  tersaring.sort(
    (a, b) =>
      a.kelas.nama.localeCompare(b.kelas.nama) ||
      a.siswa.nama.localeCompare(b.siswa.nama) ||
      a.mapel.nama.localeCompare(b.mapel.nama),
  )

  const terisi = tersaring.filter((r) => r.nilai != null)
  const summary = {
    terisi: terisi.length,
    kosong: tersaring.length - terisi.length,
    rataRata: rataRata(terisi.map((r) => r.nilai)),
  }

  return {
    data: tersaring.slice((page - 1) * limit, page * limit),
    total: tersaring.length,
    totalPages: Math.ceil(tersaring.length / limit),
    page,
    limit,
    semesterId,
    summary,
  }
}

export async function getRaportKelas(kelasId: string, semesterId: string) {
  const user = await penggunaAktif()
  await pastikanWaliAtauAdmin(kelasId, user)

  const [rekap, kelas, raports] = await Promise.all([
    susunRekap(kelasId, semesterId),
    prisma.kelas.findFirst({
      where: { id: kelasId, deletedAt: null },
      select: { id: true, nama: true, guru: { select: { nama: true } } },
    }),
    prisma.raport.findMany({
      where: { kelasId, semesterId, siswa: { deletedAt: null } },
      select: {
        id: true,
        siswaId: true,
        status: true,
        rataRata: true,
        peringkat: true,
        catatanWali: true,
        sikapPredikat: true,
        sikapDeskripsi: true,
        prestasi: true,
        sakit: true,
        izin: true,
        alpa: true,
        terbitAt: true,
        nilais: { select: { mapelId: true, nilaiAkhir: true, predikat: true, deskripsi: true } },
      },
    }),
  ])

  return { ...rekap, kelas, raports }
}

// ─── SIMPAN & TERBITKAN RAPORT ───────────────────────────────

export async function simpanRaport(input: {
  siswaId: string
  semesterId: string
  catatanWali?: string
  sikapPredikat?: string
  sikapDeskripsi?: string
  prestasi?: string
  sakit?: number
  izin?: number
  alpa?: number
}) {
  const user = await penggunaAktif()
  const siswa = await prisma.siswa.findFirst({
    where: { id: input.siswaId, deletedAt: null },
    select: { id: true, kelasId: true, nama: true, kelas: { select: { guruId: true } } },
  })
  if (!siswa?.kelasId) throw new Error("Siswa belum memiliki kelas")
  const { guru } = await pastikanWaliAtauAdmin(siswa.kelasId, user)

  const raportLama = await prisma.raport.findUnique({
    where: { siswaId_semesterId: { siswaId: input.siswaId, semesterId: input.semesterId } },
    select: { id: true, status: true },
  })
  if (raportLama?.status === "TERBIT") {
    throw new Error("Raport sudah terbit. Tarik terlebih dahulu untuk mengubahnya.")
  }

  const rekap = await susunRekap(siswa.kelasId, input.semesterId)
  const barisNilai = rekap.mapels
    .map((mapel) => {
      const nilai = rekap.nilai[input.siswaId]?.[mapel.id]
      if (nilai == null) return null
      const predikat = predikatDari(nilai, rekap.pengaturan)
      return {
        mapelId: mapel.id,
        nilaiAkhir: nilai,
        predikat,
        deskripsi: deskripsiCapaian(mapel.nama, nilai, predikat),
      }
    })
    .filter((x): x is { mapelId: string; nilaiAkhir: number; predikat: string; deskripsi: string } => x != null)

  const rata = rataRata(barisNilai.map((n) => n.nilaiAkhir))
  const data = {
    kelasId: siswa.kelasId,
    waliKelasId: guru?.id ?? siswa.kelas?.guruId ?? null,
    catatanWali: input.catatanWali?.trim() || null,
    sikapPredikat: input.sikapPredikat?.trim() || null,
    sikapDeskripsi: input.sikapDeskripsi?.trim() || null,
    prestasi: input.prestasi?.trim() || null,
    sakit: Math.max(0, Math.round(input.sakit ?? 0)),
    izin: Math.max(0, Math.round(input.izin ?? 0)),
    alpa: Math.max(0, Math.round(input.alpa ?? 0)),
    rataRata: rata,
  }

  const raport = await prisma.raport.upsert({
    where: { siswaId_semesterId: { siswaId: input.siswaId, semesterId: input.semesterId } },
    create: { siswaId: input.siswaId, semesterId: input.semesterId, ...data },
    update: data,
    select: { id: true },
  })
  await prisma.$transaction([
    prisma.raportNilai.deleteMany({ where: { raportId: raport.id } }),
    ...(barisNilai.length
      ? [prisma.raportNilai.createMany({ data: barisNilai.map((n) => ({ ...n, raportId: raport.id })) })]
      : []),
  ])
  segarkan()
  return raport
}

export async function terbitkanRaportKelas(kelasId: string, semesterId: string) {
  const user = await penggunaAktif()
  await pastikanWaliAtauAdmin(kelasId, user)

  const rekap = await susunRekap(kelasId, semesterId)
  if (rekap.mapels.length === 0) throw new Error("Belum ada mata pelajaran bernilai di kelas ini")
  if (rekap.siswas.length === 0) throw new Error("Kelas ini belum memiliki siswa")

  const kosong = rekap.siswas.reduce((total, siswa) => {
    return (
      total +
      rekap.mapels.filter((mapel) => rekap.nilai[siswa.id]?.[mapel.id] == null).length
    )
  }, 0)
  if (kosong > 0) {
    throw new Error(`Raport belum lengkap: ${kosong} nilai mapel masih kosong. Lengkapi sebelum menerbitkan.`)
  }

  const wali = await prisma.kelas.findUnique({ where: { id: kelasId }, select: { guruId: true } })
  const perSiswa = rekap.siswas.map((siswa) => {
    const baris = rekap.mapels.map((mapel) => {
      const nilai = rekap.nilai[siswa.id][mapel.id] as number
      const predikat = predikatDari(nilai, rekap.pengaturan)
      return {
        mapelId: mapel.id,
        nilaiAkhir: nilai,
        predikat,
        deskripsi: deskripsiCapaian(mapel.nama, nilai, predikat),
      }
    })
    return { siswa, baris, rata: rataRata(baris.map((b) => b.nilaiAkhir)) ?? 0 }
  })
  const urut = [...perSiswa].sort((a, b) => b.rata - a.rata)
  const peringkat = new Map(urut.map((row, i) => [row.siswa.id, i + 1]))

  await prisma.$transaction(async (tx) => {
    for (const { siswa, baris, rata } of perSiswa) {
      const raport = await tx.raport.upsert({
        where: { siswaId_semesterId: { siswaId: siswa.id, semesterId } },
        create: {
          siswaId: siswa.id,
          semesterId,
          kelasId,
          waliKelasId: wali?.guruId ?? null,
          status: "TERBIT",
          rataRata: rata,
          peringkat: peringkat.get(siswa.id) ?? null,
          terbitAt: new Date(),
        },
        update: {
          kelasId,
          waliKelasId: wali?.guruId ?? null,
          status: "TERBIT",
          rataRata: rata,
          peringkat: peringkat.get(siswa.id) ?? null,
          terbitAt: new Date(),
        },
        select: { id: true },
      })
      await tx.raportNilai.deleteMany({ where: { raportId: raport.id } })
      if (baris.length) {
        await tx.raportNilai.createMany({ data: baris.map((b) => ({ ...b, raportId: raport.id })) })
      }
    }
  }, { timeout: 30000 })
  segarkan()
}

export async function batalkanTerbitRaportKelas(kelasId: string, semesterId: string) {
  const user = await penggunaAktif()
  await pastikanWaliAtauAdmin(kelasId, user)
  await prisma.raport.updateMany({
    where: { kelasId, semesterId, status: "TERBIT" },
    data: { status: "DRAFT", terbitAt: null },
  })
  segarkan()
}

// ─── RAPORT SISWA & WALI SANTRI (hanya yang terbit) ─────────

export async function getRaportSiswaSendiri() {
  const user = await penggunaAktif()
  const siswa = await prisma.siswa.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, nama: true, kelas: { select: { nama: true } } },
  })
  if (!siswa) return { siswa: null, raports: [] }
  const raports = await prisma.raport.findMany({
    where: { siswaId: siswa.id, status: "TERBIT" },
    select: {
      id: true,
      rataRata: true,
      peringkat: true,
      terbitAt: true,
      semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
      nilais: { select: { nilaiAkhir: true, predikat: true, mapel: { select: { nama: true } } } },
    },
    orderBy: { terbitAt: "desc" },
  })
  return { siswa, raports }
}

export async function getRaportAnakWali() {
  const user = await penggunaAktif()
  const wali = await prisma.waliSantri.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: {
      id: true,
      nama: true,
      hubungan: true,
      anak: {
        select: {
          santri: { select: { nama: true, siswaId: true } },
        },
      },
    },
  })
  if (!wali) return { wali: null, anak: [] }
  const siswaIds = wali.anak.map((a) => a.santri.siswaId).filter((id): id is string => !!id)
  const raports = siswaIds.length
    ? await prisma.raport.findMany({
        where: { siswaId: { in: siswaIds }, status: "TERBIT" },
        select: {
          id: true,
          siswaId: true,
          rataRata: true,
          peringkat: true,
          terbitAt: true,
          siswa: { select: { nama: true, kelas: { select: { nama: true } } } },
          semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
        },
        orderBy: { terbitAt: "desc" },
      })
    : []
  return { wali, anak: raports }
}

// ─── CETAK ───────────────────────────────────────────────────

export async function getRaportCetak(raportId: string) {
  const user = await penggunaAktif()
  const raport = await prisma.raport.findUnique({
    where: { id: raportId },
    select: {
      id: true,
      siswaId: true,
      status: true,
      rataRata: true,
      peringkat: true,
      catatanWali: true,
      sikapPredikat: true,
      sikapDeskripsi: true,
      prestasi: true,
      sakit: true,
      izin: true,
      alpa: true,
      terbitAt: true,
      kelasId: true,
      semesterId: true,
      siswa: { select: { nama: true, nis: true, nisn: true, userId: true } },
      kelas: { select: { nama: true } },
      semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
      waliKelas: { select: { nama: true, nip: true } },
      nilais: {
        select: { nilaiAkhir: true, predikat: true, deskripsi: true, mapel: { select: { nama: true, kode: true } } },
        orderBy: { mapel: { nama: "asc" } },
      },
    },
  })
  if (!raport) throw new Error("Raport tidak ditemukan")

  let boleh = user.role === "ADMIN"
  if (!boleh && user.role === "GURU") {
    try {
      await pastikanWaliAtauAdmin(raport.kelasId, user)
      boleh = true
    } catch {}
  }
  if (!boleh) {
    if (raport.status !== "TERBIT") throw new Error("Raport belum diterbitkan")
    if (raport.siswa.userId === user.id) {
      boleh = true
    } else {
      const wali = await prisma.waliSantri.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
          anak: { some: { santri: { siswaId: raport.siswaId } } },
        },
        select: { id: true },
      })
      if (wali) boleh = true
    }
  }
  if (!boleh) throw new Error("Akses ditolak")

  const [pengaturanDb, site] = await Promise.all([
    prisma.pengaturanRaport.findUnique({ where: { semesterId: raport.semesterId } }),
    prisma.siteConfig.findFirst({ select: { siteName: true, logoUrl: true, tagline: true } }),
  ])
  const pengaturan = {
    ...DEFAULT_PENGATURAN,
    namaKepalaSekolah: "",
    nipKepalaSekolah: "",
    catatanKepala: "",
    ...(pengaturanDb ?? {}),
  }
  return { raport, pengaturan, site }
}
