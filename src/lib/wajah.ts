import { prisma } from "@/lib/prisma"
import { ymd } from "@/lib/utils"
import { audit, cekHariLibur, catatAbsensiHarianWajah, hariTanggal, type HasilAbsensiWajah } from "@/lib/absensi-harian"
import {
  AMBANG_WAJAH,
  DIMENSI_DESKRIPTOR,
  MARGIN_WAJAH,
  jarakEuclidean,
  normalisasiDeskriptor,
} from "@/lib/wajah-matematika"

// ─── FACE RECOGNITION UNTUK ABSENSI ────────────────────────────────
// Descriptor 128-d dihitung di perangkat (browser/webview Android/desktop)
// memakai model face-api, lalu dicocokkan di server. Foto mentah tidak
// diproses server dan template wajah tidak pernah dikirim balik ke client.

export type PerangkatWajah = "WEB" | "ANDROID" | "DESKTOP"

/** Batas jumlah profil yang dibandingkan (1:N). */
const MAKS_PROFIL = 5000

export { AMBANG_WAJAH, DIMENSI_DESKRIPTOR, jarakEuclidean, normalisasiDeskriptor }

type ProfilRingkas = {
  id: string
  userId: string | null
  siswaId: string | null
  deskriptor: number[]
  nama: string
  nis: string | null
  kelas: string | null
  tipe: "SISWA" | "GURU" | "PEGAWAI"
  guruId: string | null
  fotoThumbId: string | null
}

function labelTipe(profil: { siswaId: string | null; guruId: string | null }): ProfilRingkas["tipe"] {
  if (profil.siswaId) return "SISWA"
  if (profil.guruId) return "GURU"
  return "PEGAWAI"
}

async function muatProfilAktif(targetProfilId?: string | null): Promise<ProfilRingkas[]> {
  const rows = await prisma.profilWajah.findMany({
    // Hanya profil yang disetujui Admin yang ikut pencocokan absensi.
    where: { aktif: true, status: "AKTIF", ...(targetProfilId ? { id: targetProfilId } : {}) },
    take: MAKS_PROFIL,
    select: {
      id: true,
      userId: true,
      siswaId: true,
      deskriptor: true,
      fotoId: true,
      user: {
        select: {
          name: true,
          image: true,
          guru: { select: { id: true, nama: true, nip: true, deletedAt: true } },
        },
      },
      siswa: {
        select: {
          id: true,
          nama: true,
          nis: true,
          deletedAt: true,
          kelas: { select: { nama: true } },
          user: { select: { image: true } },
        },
      },
    },
  })

  return rows
    .filter((r) => {
      if (r.siswaId) return !!r.siswa && !r.siswa.deletedAt
      if (r.userId) return !!r.user && (!r.user.guru || !r.user.guru.deletedAt)
      return false
    })
    .map((r) => {
      const nama = r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? "Tanpa nama"
      const deskriptor = Array.isArray(r.deskriptor) ? (r.deskriptor as number[]).map(Number) : []
      const fotoThumbId = r.fotoId ?? null
      return {
        id: r.id,
        userId: r.userId,
        siswaId: r.siswaId,
        deskriptor,
        nama,
        nis: r.siswa?.nis ?? r.user?.guru?.nip ?? null,
        kelas: r.siswa?.kelas?.nama ?? null,
        tipe: labelTipe({ siswaId: r.siswaId, guruId: r.user?.guru?.id ?? null }),
        guruId: r.user?.guru?.id ?? null,
        fotoThumbId,
      }
    })
    .filter((r) => r.deskriptor.length === DIMENSI_DESKRIPTOR)
}

export type HasilVerifikasiWajah = {
  status: "SUKSES" | "DUPLIKAT" | "TIDAK_DIKENAL" | "DITOLAK" | "GAGAL"
  pesan: string
  nama: string | null
  tipe: "SISWA" | "GURU" | "PEGAWAI" | null
  kelas: string | null
  nis: string | null
  jarak: number | null
  ambang: number
  perangkat: PerangkatWajah
  absensi: HasilAbsensiWajah | null
  profilId: string | null
  fotoUrl: string | null
}

type OpsiVerifikasi = {
  deskriptor: number[]
  tujuan?: "ABSEN" | "UJI"
  targetProfilId?: string | null
  perangkat?: PerangkatWajah
  operatorUserId?: string | null
  fotoId?: string | null
}

/**
 * Cocokkan descriptor wajah dengan profil terdaftar (1:N), atau 1:1 bila
 * targetProfilId diisi (uji verifikasi admin). Untuk tujuan ABSEN, kehadiran
 * guru/siswa langsung dicatat memakai kebijakan jam & waktu server.
 */
export async function verifikasiWajah(opts: OpsiVerifikasi): Promise<HasilVerifikasiWajah> {
  const perangkat: PerangkatWajah = opts.perangkat ?? "WEB"
  const dasar: HasilVerifikasiWajah = {
    status: "TIDAK_DIKENAL",
    pesan: "Wajah belum terdaftar",
    nama: null,
    tipe: null,
    kelas: null,
    nis: null,
    jarak: null,
    ambang: AMBANG_WAJAH,
    perangkat,
    absensi: null,
    profilId: null,
    fotoUrl: null,
  }

  const profil = await muatProfilAktif(opts.targetProfilId ?? null)
  if (profil.length === 0) {
    return { ...dasar, pesan: "Belum ada profil wajah terdaftar — Admin perlu mendaftarkan foto wajah" }
  }

  const berjarak = profil
    .map((p) => ({ p, jarak: jarakEuclidean(opts.deskriptor, p.deskriptor) }))
    .sort((a, b) => a.jarak - b.jarak)

  const terbaik = berjarak[0]
  const kedua = berjarak[1]

  if (!terbaik || terbaik.jarak > AMBANG_WAJAH) {
    await catatLog({
      profilId: null,
      userId: opts.operatorUserId ?? null,
      tipe: opts.tujuan === "UJI" ? "UJI" : "VERIFIKASI",
      status: "TIDAK_DIKENAL",
      jarak: terbaik?.jarak ?? null,
      pesan: "Wajah tidak cocok dengan profil terdaftar",
      perangkat,
      fotoId: opts.fotoId ?? null,
    })
    return { ...dasar, jarak: terbaik ? bulat(terbaik.jarak) : null, pesan: "Wajah tidak cocok dengan profil terdaftar" }
  }

  // Wajah bisa mirip ke dua profil (mis. saudara kembar) → tolak agar aman.
  if (!opts.targetProfilId && kedua && kedua.jarak - terbaik.jarak < MARGIN_WAJAH) {
    await catatLog({
      profilId: terbaik.p.id,
      userId: terbaik.p.userId,
      siswaId: terbaik.p.siswaId,
      tipe: "VERIFIKASI",
      status: "DITOLAK",
      jarak: terbaik.jarak,
      pesan: "Wajah terlalu mirip dengan lebih dari satu profil — ulangi dengan pencahayaan lebih baik",
      perangkat,
      fotoId: opts.fotoId ?? null,
    })
    return {
      ...dasar,
      status: "GAGAL",
      jarak: bulat(terbaik.jarak),
      pesan: "Wajah terlalu mirip dengan lebih dari satu profil — ulangi dengan pencahayaan lebih baik",
    }
  }

  const orang = terbaik.p
  const identitas = {
    nama: orang.nama,
    tipe: orang.tipe,
    kelas: orang.kelas,
    nis: orang.nis,
    jarak: bulat(terbaik.jarak),
    profilId: orang.id,
    fotoUrl: orang.fotoThumbId ? `/api/upload/${orang.fotoThumbId}` : null,
  }

  // Uji verifikasi saja (dipakai Admin untuk mengecek hasil upload foto).
  if (opts.tujuan === "UJI") {
    await catatLog({
      profilId: orang.id,
      userId: orang.userId,
      siswaId: orang.siswaId,
      tipe: "UJI",
      status: "SUKSES",
      jarak: terbaik.jarak,
      pesan: `Terverifikasi sebagai ${orang.nama}`,
      perangkat,
      fotoId: opts.fotoId ?? null,
    })
    return {
      ...dasar,
      ...identitas,
      status: "SUKSES",
      pesan: `Terverifikasi sebagai ${orang.nama} (jarak ${bulat(terbaik.jarak)})`,
    }
  }

  // ── Absensi ──────────────────────────────────────────────────────
  try {
    if (orang.siswaId) {
      const hasil = await catatAbsensiHarianWajah({ siswaId: orang.siswaId, jarak: terbaik.jarak })
      await catatLog({
        profilId: orang.id,
        siswaId: orang.siswaId,
        tipe: `ABSEN_${hasil.tipe}`,
        status: hasil.status,
        jarak: terbaik.jarak,
        pesan: hasil.pesan,
        perangkat,
        fotoId: opts.fotoId ?? null,
      })
      return {
        ...dasar,
        ...identitas,
        status: hasil.status,
        pesan: `${orang.nama}: ${hasil.pesan}`,
        absensi: hasil,
      }
    }

    if (orang.userId && orang.guruId) {
      const hasil = await catatAbsensiGuruWajah({
        guruId: orang.guruId,
        userId: orang.userId,
        jarak: terbaik.jarak,
        fotoId: opts.fotoId ?? null,
      })
      await catatLog({
        profilId: orang.id,
        userId: orang.userId,
        tipe: "ABSEN_GURU",
        status: hasil.status,
        jarak: terbaik.jarak,
        pesan: hasil.pesan,
        perangkat,
        fotoId: opts.fotoId ?? null,
      })
      return { ...dasar, ...identitas, status: hasil.status, pesan: `${orang.nama}: ${hasil.pesan}` }
    }

    await catatLog({
      profilId: orang.id,
      userId: orang.userId,
      tipe: "VERIFIKASI",
      status: "SUKSES",
      jarak: terbaik.jarak,
      pesan: `Terverifikasi sebagai ${orang.nama} (bukan siswa/guru — tidak ada absensi yang dicatat)`,
      perangkat,
      fotoId: opts.fotoId ?? null,
    })
    return {
      ...dasar,
      ...identitas,
      status: "SUKSES",
      pesan: `${orang.nama} terverifikasi, tetapi identitas bukan siswa/guru sehingga absensi tidak dicatat`,
    }
  } catch (e) {
    console.error("verifikasiWajah error:", e)
    await catatLog({
      profilId: orang.id,
      userId: orang.userId,
      siswaId: orang.siswaId,
      tipe: "VERIFIKASI",
      status: "GAGAL",
      jarak: terbaik.jarak,
      pesan: "Gagal mencatat absensi — coba lagi",
      perangkat,
      fotoId: opts.fotoId ?? null,
    })
    return {
      ...dasar,
      ...identitas,
      status: "GAGAL",
      pesan: "Wajah cocok, tetapi absensi gagal dicatat — coba lagi",
    }
  }
}

async function catatAbsensiGuruWajah(params: {
  guruId: string
  userId: string
  jarak: number
  fotoId?: string | null
}): Promise<{ status: HasilVerifikasiWajah["status"]; pesan: string }> {
  const libur = await cekHariLibur(new Date())
  if (libur) return { status: "GAGAL", pesan: `Absensi ditolak: ${libur}` }

  const jamServer = new Date().toTimeString().slice(0, 5)
  const tanggal = hariTanggal(new Date())
  const lama = await prisma.absensiGuru.findUnique({
    where: { guruId_tanggal: { guruId: params.guruId, tanggal } },
    select: { id: true, jamMasuk: true },
  })

  if (lama?.jamMasuk) {
    return { status: "DUPLIKAT", pesan: `Absensi guru sudah tercatat pukul ${lama.jamMasuk}` }
  }

  const data = {
    status: "HADIR" as const,
    jamMasuk: jamServer,
    wajahVerified: true,
    wajahJarak: params.jarak,
    wajahFotoId: params.fotoId ?? null,
  }
  if (lama) await prisma.absensiGuru.update({ where: { id: lama.id }, data })
  else await prisma.absensiGuru.create({ data: { guruId: params.guruId, tanggal, ...data } })

  await audit(params.userId, "ABSENSI_GURU_WAJAH", "AbsensiGuru", lama?.id, {
    jamMasuk: jamServer,
    jarak: params.jarak,
    tanggal: ymd(tanggal),
  })
  return { status: "SUKSES", pesan: `Absensi guru tercatat pukul ${jamServer} (wajah terverifikasi)` }
}

async function catatLog(data: {
  profilId: string | null
  userId?: string | null
  siswaId?: string | null
  tipe: string
  status: string
  jarak?: number | null
  pesan?: string | null
  perangkat: PerangkatWajah
  fotoId?: string | null
}) {
  try {
    await prisma.logVerifikasiWajah.create({
      data: {
        profilId: data.profilId,
        userId: data.userId ?? null,
        siswaId: data.siswaId ?? null,
        tipe: data.tipe,
        status: data.status,
        jarak: data.jarak ?? null,
        ambang: AMBANG_WAJAH,
        pesan: data.pesan ?? null,
        perangkat: data.perangkat,
        fotoId: data.fotoId ?? null,
      },
    })
  } catch (e) {
    console.error("Gagal menulis log wajah:", e)
  }
}

function bulat(v: number) {
  return Math.round(v * 1000) / 1000
}
