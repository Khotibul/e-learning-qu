import { prisma } from "@/lib/prisma"
import { audit, catatAbsensiGuruHarian, catatAbsensiHarianWajah } from "@/lib/absensi-harian"

// ─── KIOSK ABSENSI DESKTOP (tanpa login) ───────────────────────────
// Dipakai halaman /absensi/kiosk di komputer admin. Wajah diverifikasi lewat
// descriptor (lib/wajah.ts); sidik jari memakai pemetaan mesin fingerprint
// yang sudah ada, dengan cadangan NIS/NIP selama sensor belum terpasang.

export type MetodeKiosk = "WAJAH" | "SIDIK_JARI" | "NIS_NIP"

export type KartuIdentitas = {
  tipe: "SISWA" | "GURU"
  nama: string
  fotoUrl: string | null
  nip: string | null
  jabatan: string | null
  kelas: string | null
  jurusan: string | null
  nis: string | null
  /** Unit sekolah formal (Siswa/Guru) — true bila terdaftar di sekolah. */
  sekolahFormal: boolean
  /** Program pondok / non formal (santri atau penugasan pondok). */
  sekolahNonFormal: boolean
}

export type IdentitasKiosk = {
  kartu: KartuIdentitas
  userId: string
  siswaId: string | null
  guruId: string | null
}

export type HasilAbsenKiosk = {
  status: "SUKSES" | "DUPLIKAT" | "TIDAK_DIKENAL" | "DITOLAK" | "GAGAL"
  pesan: string
  metode: MetodeKiosk
  kartu: KartuIdentitas | null
  tipe: "MASUK" | "PULANG" | null
  jam: string | null
}

const KODE_RE = /^[A-Za-z0-9._-]{3,30}$/

/** NIS, NISN, atau NIP — dibatasi agar tidak dipakai untuk pencarian bebas. */
export function normalisasiKodeKiosk(nilai: unknown): string {
  const kode = String(nilai ?? "").trim()
  if (!KODE_RE.test(kode)) throw new Error("Masukkan NIS, NISN, atau NIP yang valid (3–30 karakter)")
  return kode.toUpperCase()
}

function fotoDari(image: string | null | undefined): string | null {
  return image && image.trim() ? image.trim() : null
}

/** Cari identitas siswa/guru berdasarkan NIS, NISN, atau NIP. */
export async function cariIdentitasKiosk(kodeInput: unknown): Promise<IdentitasKiosk | null> {
  const kode = normalisasiKodeKiosk(kodeInput)
  const cocok = { equals: kode, mode: "insensitive" as const }

  const siswa = await prisma.siswa.findFirst({
    where: {
      deletedAt: null,
      user: { isActive: true },
      OR: [{ nis: cocok }, { nisn: cocok }],
    },
    select: {
      id: true,
      userId: true,
      nama: true,
      nis: true,
      user: { select: { image: true } },
      kelas: { select: { nama: true } },
      jurusan: { select: { nama: true } },
      santri: { select: { id: true, status: true, deletedAt: true } },
    },
  })

  if (siswa) {
    return {
      userId: siswa.userId,
      siswaId: siswa.id,
      guruId: null,
      kartu: {
        tipe: "SISWA",
        nama: siswa.nama,
        fotoUrl: fotoDari(siswa.user.image),
        nip: null,
        jabatan: null,
        kelas: siswa.kelas?.nama ?? null,
        jurusan: siswa.jurusan?.nama ?? null,
        nis: siswa.nis,
        sekolahFormal: true,
        sekolahNonFormal: !!siswa.santri && !siswa.santri.deletedAt && siswa.santri.status === "AKTIF",
      },
    }
  }

  const guru = await prisma.guru.findFirst({
    where: { deletedAt: null, nip: cocok },
    select: {
      id: true,
      userId: true,
      nama: true,
      nip: true,
      jabatan: true,
      user: {
        select: {
          image: true,
          isActive: true,
          pondokAssignments: { where: { aktif: true }, select: { id: true }, take: 1 },
        },
      },
    },
  })
  if (!guru || !guru.user.isActive) return null

  return {
    userId: guru.userId,
    siswaId: null,
    guruId: guru.id,
    kartu: {
      tipe: "GURU",
      nama: guru.nama,
      fotoUrl: fotoDari(guru.user.image),
      nip: guru.nip,
      jabatan: guru.jabatan,
      kelas: null,
      jurusan: null,
      nis: null,
      sekolahFormal: true,
      sekolahNonFormal: guru.user.pondokAssignments.length > 0,
    },
  }
}

/**
 * Catat kehadiran dari kiosk memakai NIS/NIP (cadangan) atau sidik jari.
 * Metode SIDIK_JARI mensyaratkan orang sudah dipetakan ke mesin fingerprint.
 */
export async function absenKiosk(params: { kode: unknown; metode: MetodeKiosk }): Promise<HasilAbsenKiosk> {
  const metode = params.metode
  const ident = await cariIdentitasKiosk(params.kode)
  if (!ident) {
    return {
      status: "TIDAK_DIKENAL",
      pesan: "NIS/NISN/NIP tidak ditemukan atau akun tidak aktif",
      metode,
      kartu: null,
      tipe: null,
      jam: null,
    }
  }

  if (metode === "SIDIK_JARI") {
    const peta = await prisma.pemetaanFingerprint.findFirst({
      where: {
        perangkat: { status: "AKTIF" },
        ...(ident.siswaId ? { siswaId: ident.siswaId } : { userId: ident.userId }),
      },
      select: { id: true },
    })
    if (!peta) {
      return {
        status: "DITOLAK",
        pesan:
          "Sidik jari belum terdaftar pada mesin fingerprint aktif. Minta Admin memetakan sidik jari, atau pakai cadangan NIS/NIP.",
        metode,
        kartu: ident.kartu,
        tipe: null,
        jam: null,
      }
    }
  }

  const sumber = metode === "SIDIK_JARI" ? "FINGERPRINT" : metode === "NIS_NIP" ? "MANUAL" : "WAJAH"

  try {
    if (ident.siswaId) {
      const hasil = await catatAbsensiHarianWajah({ siswaId: ident.siswaId, sumber })
      await audit(ident.userId, "ABSENSI_KIOSK_SISWA", "AbsensiHarianSiswa", undefined, {
        metode,
        tipe: hasil.tipe,
        jam: hasil.jam,
        status: hasil.status,
      })
      return {
        status: hasil.status,
        pesan: hasil.pesan,
        metode,
        kartu: ident.kartu,
        tipe: hasil.tipe,
        jam: hasil.jam,
      }
    }

    if (ident.guruId) {
      const hasil = await catatAbsensiGuruHarian({
        guruId: ident.guruId,
        userId: ident.userId,
        sumber,
      })
      return {
        status: hasil.status,
        pesan: hasil.pesan,
        metode,
        kartu: ident.kartu,
        tipe: hasil.status === "SUKSES" ? "MASUK" : null,
        jam: hasil.jam,
      }
    }

    return {
      status: "GAGAL",
      pesan: "Identitas bukan siswa/guru — absensi tidak dicatat",
      metode,
      kartu: ident.kartu,
      tipe: null,
      jam: null,
    }
  } catch (e) {
    console.error("absenKiosk error:", e)
    return {
      status: "GAGAL",
      pesan: "Absensi gagal dicatat — coba lagi",
      metode,
      kartu: ident.kartu,
      tipe: null,
      jam: null,
    }
  }
}
