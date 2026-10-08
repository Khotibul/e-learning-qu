import { prisma } from "@/lib/prisma"
import { DAFTAR_METODE, haversineMeter, wajibFoto, wajibGps, wajibSidikJari, type MetodeAbsensi } from "@/lib/absensi-metode"

// Re-export (dipakai server) — implementasi murni di absensi-metode.ts
export { DAFTAR_METODE, haversineMeter, wajibFoto, wajibGps, wajibSidikJari }
export type { MetodeAbsensi }

// ─── KEBIJAKAN LOKASI (SiteConfig) ─────────────────────────────────
export type KebijakanLokasi = {
  metode: MetodeAbsensi
  gpsWajib: boolean
  lokasiNama: string | null
  lat: number | null
  lng: number | null
  radiusMeter: number
  akurasiMaksMeter: number
}

const LOKASI_DEFAULT: KebijakanLokasi = {
  metode: "TANPA",
  gpsWajib: false,
  lokasiNama: null,
  lat: null,
  lng: null,
  radiusMeter: 100,
  akurasiMaksMeter: 50,
}

export async function getKebijakanLokasi(): Promise<KebijakanLokasi> {
  try {
    const cfg = await prisma.siteConfig.findFirst({
      select: {
        absensiMetode: true,
        gpsWajib: true,
        gpsLokasiNama: true,
        gpsLat: true,
        gpsLng: true,
        gpsRadiusMeter: true,
        gpsAkurasiMaksMeter: true,
      },
    })
    if (!cfg) return LOKASI_DEFAULT
    return {
      metode: cfg.absensiMetode || "TANPA",
      gpsWajib: cfg.gpsWajib,
      lokasiNama: cfg.gpsLokasiNama,
      lat: cfg.gpsLat,
      lng: cfg.gpsLng,
      radiusMeter: cfg.gpsRadiusMeter,
      akurasiMaksMeter: cfg.gpsAkurasiMaksMeter,
    }
  } catch {
    return LOKASI_DEFAULT
  }
}

/** Metode efektif untuk guru: override per guru → ikut SiteConfig */
export async function getMetodeGuru(guruId: string): Promise<MetodeAbsensi> {
  try {
    const guru = await prisma.guru.findUnique({ where: { id: guruId }, select: { absensiMetode: true } })
    if (guru?.absensiMetode) return guru.absensiMetode
  } catch { /* fallback ke kebijakan */ }
  const kebijakan = await getKebijakanLokasi()
  return kebijakan.metode
}

// ─── VALIDASI LOKASI (Haversine — lihat absensi-metode.ts) ────────
export type TitikAbsensi = {
  lat: number
  lng: number
  akurasiMeter?: number | null
  mock?: boolean | null
}

export type HasilValidasiLokasi = {
  valid: boolean
  jarakMeter: number | null
  akurasiMeter: number | null
  radiusMeter: number
  akurasiMaksMeter: number
  mock: boolean
  alasan: string | null
}

export function validasiLokasiMurni(kebijakan: KebijakanLokasi, titik: TitikAbsensi): HasilValidasiLokasi {
  const base: HasilValidasiLokasi = {
    valid: false,
    jarakMeter: null,
    akurasiMeter: titik.akurasiMeter ?? null,
    radiusMeter: kebijakan.radiusMeter,
    akurasiMaksMeter: kebijakan.akurasiMaksMeter,
    mock: !!titik.mock,
    alasan: null,
  }

  if (kebijakan.lat == null || kebijakan.lng == null) {
    return { ...base, alasan: "Lokasi absensi belum dikonfigurasi Admin" }
  }
  if (!Number.isFinite(titik.lat) || !Number.isFinite(titik.lng)) {
    return { ...base, alasan: "Koordinat tidak valid" }
  }

  const jarak = haversineMeter(titik.lat, titik.lng, kebijakan.lat, kebijakan.lng)
  base.jarakMeter = Math.round(jarak * 10) / 10

  if (titik.akurasiMeter != null && titik.akurasiMeter > kebijakan.akurasiMaksMeter) {
    return { ...base, alasan: `Akurasi GPS ${Math.round(titik.akurasiMeter)}m melebihi batas ${kebijakan.akurasiMaksMeter}m — dekatkan ke ruang terbuka` }
  }
  if (jarak > kebijakan.radiusMeter) {
    return { ...base, alasan: `Berada ${base.jarakMeter}m dari titik absensi (radius ${kebijakan.radiusMeter}m)` }
  }
  return { ...base, valid: true, alasan: null }
}

/** Validasi ulang di backend (server adalah acuan). */
export async function validasiLokasiServer(titik: TitikAbsensi): Promise<HasilValidasiLokasi> {
  const kebijakan = await getKebijakanLokasi()
  return validasiLokasiMurni(kebijakan, titik)
}

// ─── PENGECAULIAN (wajib persetujuan Admin) ────────────────────────
export type JenisPengecualian = "LOKASI" | "BIOMETRIK" | "FOTO"

export async function cekPengecualianAktif(
  guruId: string,
  tanggal: Date,
  jenis: JenisPengecualian
): Promise<{ status: "DISETUJUI" | "MENUNGGU" | "TIDAK_ADA"; id?: string }> {
  const row = await prisma.pengecualianAbsensi.findFirst({
    where: { guruId, tanggal, jenis, status: { in: ["DISETUJUI", "MENUNGGU"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true },
  })
  if (!row) return { status: "TIDAK_ADA" }
  return { status: row.status as "DISETUJUI" | "MENUNGGU", id: row.id }
}

/**
 * Validasi verifikasi wajib sesuai metode Admin.
 * Melempar Error dengan pesan yang dapat ditampilkan langsung ke guru.
 * Mengembalikan catatan pengecualian bila pengecualian DISETUJUI dipakai.
 */
export async function validasiVerifikasi(params: {
  guruId: string
  tanggal: Date
  metode: MetodeAbsensi
  fotoUrl?: string | null
  gps?: TitikAbsensi | null
  sidikJari?: { verified: boolean; provider?: string | null } | null
  tahap: "MASUK" | "SELESAI"
}): Promise<{ catatan: string | null; hasilLokasi: HasilValidasiLokasi | null; metode: MetodeAbsensi }> {
  const { guruId, tanggal, metode, fotoUrl, gps, sidikJari, tahap } = params
  const catatanList: string[] = []
  let hasilLokasi: HasilValidasiLokasi | null = null

  // 1) FOTO — wajib pada tahap MASUK saja (bukti identitas awal)
  if (wajibFoto(metode) && tahap === "MASUK") {
    if (!fotoUrl) {
      const p = await cekPengecualianAktif(guruId, tanggal, "FOTO")
      if (p.status === "MENUNGGU") throw new Error("Pengecualian foto sedang menunggu persetujuan Admin")
      if (p.status !== "DISETUJUI") throw new Error("Foto selfie wajib untuk metode absensi ini")
      catatanList.push("tanpa foto (pengecualian DISETUJUI)")
    }
  }

  // 2) BIOMETRIK — validasi backend: klaim verifikasi harus true
  if (wajibSidikJari(metode)) {
    if (!sidikJari?.verified) {
      const p = await cekPengecualianAktif(guruId, tanggal, "BIOMETRIK")
      if (p.status === "MENUNGGU") throw new Error("Pengecualian sidik jari sedang menunggu persetujuan Admin")
      if (p.status !== "DISETUJUI") throw new Error("Verifikasi sidik jari wajib untuk metode absensi ini")
      catatanList.push("tanpa sidik jari (pengecualian DISETUJUI)")
    }
  }

  // 3) GPS — wajib bila metode mengandung GPS ATAU Admin menyalakan gpsWajib
  const kebijakan = await getKebijakanLokasi()
  const gpsAktif = wajibGps(metode) || kebijakan.gpsWajib
  if (gpsAktif) {
    if (!gps || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) {
      const p = await cekPengecualianAktif(guruId, tanggal, "LOKASI")
      if (p.status === "MENUNGGU") throw new Error("Pengecualian lokasi sedang menunggu persetujuan Admin")
      if (p.status !== "DISETUJUI") throw new Error("Absensi memerlukan lokasi GPS — aktifkan GPS perangkat dan izinkan akses lokasi")
      catatanList.push("tanpa GPS (pengecualian DISETUJUI)")
    } else {
      hasilLokasi = validasiLokasiMurni(kebijakan, gps)
      if (!hasilLokasi.valid) {
        const p = await cekPengecualianAktif(guruId, tanggal, "LOKASI")
        if (p.status === "MENUNGGU") throw new Error(`Lokasi tidak valid: ${hasilLokasi.alasan} — pengecualian menunggu persetujuan Admin`)
        if (p.status !== "DISETUJUI") throw new Error(`Absensi ditolak: ${hasilLokasi.alasan}`)
        catatanList.push(`lokasi di luar radius (pengecualian DISETUJUI)`)
      }
    }
  }

  return {
    catatan: catatanList.length > 0 ? catatanList.join("; ") : null,
    hasilLokasi,
    metode,
  }
}
