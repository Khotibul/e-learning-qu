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

/** Kartu identitas siswa: foto, nama, kelas, jurusan, NIS, sekolah formal/non formal. */
export function kartuSiswa(data: {
  nama: string
  nis: string | null
  image: string | null | undefined
  kelasNama: string | null
  jurusanNama: string | null
  santriAktif: boolean
}): KartuIdentitas {
  return {
    tipe: "SISWA",
    nama: data.nama,
    fotoUrl: fotoDari(data.image),
    nip: null,
    jabatan: null,
    kelas: data.kelasNama,
    jurusan: data.jurusanNama,
    nis: data.nis,
    sekolahFormal: true,
    sekolahNonFormal: data.santriAktif,
  }
}

/** Kartu identitas guru: foto, nama, jabatan, NIP, sekolah formal/non formal. */
export function kartuGuru(data: {
  nama: string
  nip: string | null
  jabatan: string | null
  image: string | null | undefined
  punyaPenugasanPondok: boolean
}): KartuIdentitas {
  return {
    tipe: "GURU",
    nama: data.nama,
    fotoUrl: fotoDari(data.image),
    nip: data.nip,
    jabatan: data.jabatan,
    kelas: null,
    jurusan: null,
    nis: null,
    sekolahFormal: true,
    sekolahNonFormal: data.punyaPenugasanPondok,
  }
}

/**
 * Judul + nada warna banner hasil kiosk. Identitas yang tidak dikenal (mis. NIS
 * salah) harus berbeda dari absensi yang tidak tercatat karena alasan lain —
 * termasuk PEGAWAI yang berhasil diverifikasi tanpa kartu identitas.
 */
export function ringkasHasilKiosk(hasil: Pick<HasilAbsenKiosk, "status" | "pesan">): {
  judul: string
  nada: "sukses" | "gagal"
} {
  if (hasil.status === "SUKSES") return { judul: "Absensi tercatat", nada: "sukses" }
  if (hasil.status === "TIDAK_DIKENAL") return { judul: "Identitas tidak ditemukan", nada: "gagal" }
  return { judul: "Absensi tidak tercatat", nada: "gagal" }
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
      kartu: kartuSiswa({
        nama: siswa.nama,
        nis: siswa.nis,
        image: siswa.user.image,
        kelasNama: siswa.kelas?.nama ?? null,
        jurusanNama: siswa.jurusan?.nama ?? null,
        santriAktif:
          !!siswa.santri && !siswa.santri.deletedAt && siswa.santri.status === "AKTIF",
      }),
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
    kartu: kartuGuru({
      nama: guru.nama,
      nip: guru.nip,
      jabatan: guru.jabatan,
      image: guru.user.image,
      punyaPenugasanPondok: guru.user.pondokAssignments.length > 0,
    }),
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
