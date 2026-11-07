import { prisma } from "@/lib/prisma"
import { ymd } from "@/lib/utils"

// ─── REKAP ABSENSI WAJAH (per kelas & per guru) ────────────────────
// Hanya menghitung absensi yang benar-benar diverifikasi lewat wajah
// (AbsensiHarianSiswa.wajahMasuk/wajahPulang, AbsensiGuru.wajahVerified).

export type RentangRekapWajah = { dari: string; sampai: string; hari: number }

export type BarisKelasWajah = {
  kelasId: string | null
  kelas: string
  siswa: number
  terdaftarWajah: number
  masukWajah: number
  pulangWajah: number
  siswaAbsenWajah: number
}

export type BarisGuruWajah = {
  guruId: string
  nama: string
  nip: string | null
  terdaftarWajah: boolean
  hariWajah: number
  terakhir: string | null
  jamMasukTerakhir: string | null
}

export type RekapWajah = {
  rentang: RentangRekapWajah
  ringkasan: {
    masukWajah: number
    pulangWajah: number
    siswaAbsenWajah: number
    siswaTerdaftarWajah: number
    guruHariWajah: number
    guruTerdaftarWajah: number
  }
  perKelas: BarisKelasWajah[]
  perGuru: BarisGuruWajah[]
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/

function tanggalValid(nilai: string | null | undefined): Date | null {
  if (!nilai || !POLA_TANGGAL.test(nilai)) return null
  const d = new Date(`${nilai}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Rentang default: awal bulan berjalan s.d. hari ini. */
export function rentangRekapWajah(dariStr?: string | null, sampaiStr?: string | null): RentangRekapWajah {
  const hariIni = new Date()
  hariIni.setHours(0, 0, 0, 0)

  let dari = tanggalValid(dariStr)
  let sampai = tanggalValid(sampaiStr)
  if (!dari && !sampai) {
    dari = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1)
    sampai = hariIni
  }
  dari ??= sampai ?? hariIni
  sampai ??= dari
  if (dari > sampai) [dari, sampai] = [sampai, dari]

  const hari = Math.round((sampai.getTime() - dari.getTime()) / 86_400_000) + 1
  return { dari: ymd(dari), sampai: ymd(sampai), hari: Math.max(1, hari) }
}

/** Tanggal siap pakai untuk tombol pintasan filter di halaman rekap. */
export function prasetRekapWajah(): { hariIni: string; tujuhHari: string; awalBulan: string } {
  const hariIni = new Date()
  const tujuhHari = new Date(hariIni.getTime() - 6 * 86_400_000)
  const hari = ymd(hariIni)
  return { hariIni: hari, tujuhHari: ymd(tujuhHari), awalBulan: `${hari.slice(0, 7)}-01` }
}

function akhirHari(tanggal: string): Date {
  const d = new Date(`${tanggal}T23:59:59.999`)
  return d
}

export async function ambilRekapWajah(rentang: RentangRekapWajah): Promise<RekapWajah> {
  const gte = new Date(`${rentang.dari}T00:00:00`)
  const lte = akhirHari(rentang.sampai)

  const [siswa, absensiSiswa, guru, absensiGuru] = await Promise.all([
    prisma.siswa.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        kelasId: true,
        kelas: { select: { nama: true } },
        profilWajah: { select: { aktif: true } },
      },
    }),
    prisma.absensiHarianSiswa.findMany({
      where: {
        tanggal: { gte, lte },
        OR: [
          { wajahMasuk: true },
          { wajahPulang: true },
          { sumberMasuk: "WAJAH" },
          { sumberPulang: "WAJAH" },
        ],
      },
      select: { siswaId: true, wajahMasuk: true, wajahPulang: true, sumberMasuk: true, sumberPulang: true },
    }),
    prisma.guru.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nama: true,
        nip: true,
        user: { select: { profilWajah: { select: { aktif: true } } } },
      },
    }),
    prisma.absensiGuru.findMany({
      where: { tanggal: { gte, lte }, wajahVerified: true },
      select: { guruId: true, tanggal: true, jamMasuk: true },
    }),
  ])

  const kelasSiswa = new Map<string, string | null>()
  const kelasMap = new Map<string, BarisKelasWajah>()
  const siswaWajah = new Set<string>()
  const guruMap = new Map<string, BarisGuruWajah>()

  for (const s of siswa) {
    kelasSiswa.set(s.id, s.kelasId)
    const id = s.kelasId ?? "__tanpa_kelas__"
    const baris = kelasMap.get(id) ?? {
      kelasId: s.kelasId,
      kelas: s.kelas?.nama ?? "Tanpa kelas",
      siswa: 0,
      terdaftarWajah: 0,
      masukWajah: 0,
      pulangWajah: 0,
      siswaAbsenWajah: 0,
    }
    baris.siswa++
    if (s.profilWajah?.aktif) baris.terdaftarWajah++
    kelasMap.set(id, baris)
  }

  let masukWajah = 0
  let pulangWajah = 0
  for (const a of absensiSiswa) {
    const kelasId = kelasSiswa.get(a.siswaId)
    if (kelasId === undefined) continue // siswa sudah dihapus
    const baris = kelasMap.get(kelasId ?? "__tanpa_kelas__")
    if (!baris) continue
    const masuk = a.wajahMasuk || a.sumberMasuk === "WAJAH"
    const pulang = a.wajahPulang || a.sumberPulang === "WAJAH"
    if (masuk) {
      baris.masukWajah++
      masukWajah++
    }
    if (pulang) {
      baris.pulangWajah++
      pulangWajah++
    }
    if (masuk || pulang) siswaWajah.add(a.siswaId)
  }

  for (const s of siswaWajah) {
    const baris = kelasMap.get(kelasSiswa.get(s) ?? "__tanpa_kelas__")
    if (baris) baris.siswaAbsenWajah++
  }

  for (const g of guru) {
    guruMap.set(g.id, {
      guruId: g.id,
      nama: g.nama,
      nip: g.nip,
      terdaftarWajah: !!g.user?.profilWajah?.aktif,
      hariWajah: 0,
      terakhir: null,
      jamMasukTerakhir: null,
    })
  }

  const hariGuru = new Map<string, Set<string>>()
  for (const a of absensiGuru) {
    const baris = guruMap.get(a.guruId)
    if (!baris) continue
    const tgl = ymd(a.tanggal)
    const set = hariGuru.get(a.guruId) ?? new Set<string>()
    set.add(tgl)
    hariGuru.set(a.guruId, set)
    if (!baris.terakhir || tgl > baris.terakhir) {
      baris.terakhir = tgl
      baris.jamMasukTerakhir = a.jamMasuk
    }
  }
  for (const [guruId, set] of hariGuru) {
    const baris = guruMap.get(guruId)
    if (baris) baris.hariWajah = set.size
  }

  const perKelas = [...kelasMap.values()].sort((a, b) => {
    if (a.kelasId === null) return 1
    if (b.kelasId === null) return -1
    return a.kelas.localeCompare(b.kelas, "id")
  })
  const perGuru = [...guruMap.values()].sort(
    (a, b) => b.hariWajah - a.hariWajah || a.nama.localeCompare(b.nama, "id")
  )

  return {
    rentang,
    ringkasan: {
      masukWajah,
      pulangWajah,
      siswaAbsenWajah: siswaWajah.size,
      siswaTerdaftarWajah: siswa.filter((s) => s.profilWajah?.aktif).length,
      guruHariWajah: absensiGuru.length,
      guruTerdaftarWajah: [...guruMap.values()].filter((g) => g.terdaftarWajah).length,
    },
    perKelas,
    perGuru,
  }
}
