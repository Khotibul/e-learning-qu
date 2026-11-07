import { prisma } from "@/lib/prisma"
import { normalisasiDeskriptor } from "@/lib/wajah-matematika"

// ─── PENDAFTARAN WAJAH MANDIRI (siswa/guru) ────────────────────────
// Siswa/guru menangkap wajah sendiri dari HP, descriptor dikirim ke server
// dan disimpan sebagai pengajuan (aktif = false) sampai Admin menyetujui.
// Selama MENUNGGU, profil tidak ikut pencocokan absensi.

export type StatusPengajuanWajah = "AKTIF" | "MENUNGGU" | "DITOLAK" | null

export type IdentitasPendaftarWajah = {
  userId: string
  siswaId: string | null
  guruId: string | null
  nama: string
  tipe: "SISWA" | "GURU" | "PEGAWAI"
  kelas: string | null
  nis: string | null
}

/** Batas ukuran foto tangkapan (data URL) yang disimpan untuk verifikasi Admin. */
export const MAKS_FOTO_PENGAJUAN = 400_000
const POLA_FOTO = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/

export async function identitasPendaftarWajah(userId: string): Promise<IdentitasPendaftarWajah | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      siswa: {
        select: { id: true, nama: true, nis: true, deletedAt: true, kelas: { select: { nama: true } } },
      },
      guru: { select: { id: true, nama: true, nip: true, deletedAt: true } },
    },
  })
  if (!user) return null

  if (user.siswa && !user.siswa.deletedAt) {
    return {
      userId: user.id,
      siswaId: user.siswa.id,
      guruId: null,
      nama: user.siswa.nama,
      tipe: "SISWA",
      kelas: user.siswa.kelas?.nama ?? null,
      nis: user.siswa.nis,
    }
  }
  if (user.guru && !user.guru.deletedAt) {
    return {
      userId: user.id,
      siswaId: null,
      guruId: user.guru.id,
      nama: user.guru.nama,
      tipe: "GURU",
      kelas: null,
      nis: user.guru.nip,
    }
  }
  return {
    userId: user.id,
    siswaId: null,
    guruId: null,
    nama: user.name ?? "Tanpa nama",
    tipe: "PEGAWAI",
    kelas: null,
    nis: null,
  }
}

export type StatusPendaftaran = {
  identitas: IdentitasPendaftarWajah
  status: StatusPengajuanWajah
  catatan: string | null
  diperbarui: string | null
}

export async function statusPendaftaranWajah(userId: string): Promise<StatusPendaftaran | null> {
  const identitas = await identitasPendaftarWajah(userId)
  if (!identitas) return null
  const profil = await prisma.profilWajah.findUnique({
    where: { userId },
    select: { status: true, aktif: true, catatanAdmin: true, updatedAt: true },
  })
  const status: StatusPengajuanWajah = !profil ? null : profil.aktif && profil.status === "AKTIF" ? "AKTIF" : (profil.status as StatusPengajuanWajah)
  return {
    identitas,
    status,
    catatan: profil?.catatanAdmin ?? null,
    diperbarui: profil?.updatedAt?.toISOString() ?? null,
  }
}

export async function ajukanPendaftaranWajah(params: {
  userId: string
  deskriptor: unknown
  foto?: string | null
  sampel?: number
}): Promise<{ status: "MENUNGGU"; nama: string; pesan: string }> {
  const identitas = await identitasPendaftarWajah(params.userId)
  if (!identitas) throw new Error("Akun tidak ditemukan")
  if (identitas.tipe === "PEGAWAI") {
    throw new Error("Pendaftaran mandiri hanya untuk akun siswa/guru — hubungi Admin")
  }

  const deskriptor = normalisasiDeskriptor(params.deskriptor)

  let foto: string | null = null
  if (params.foto) {
    if (typeof params.foto !== "string" || params.foto.length > MAKS_FOTO_PENGAJUAN || !POLA_FOTO.test(params.foto)) {
      throw new Error("Foto pengajuan tidak valid atau terlalu besar")
    }
    foto = params.foto
  }

  const sampel = Math.min(Math.max(Math.floor(Number(params.sampel) || 1), 1), 10)
  const lama = await prisma.profilWajah.findUnique({
    where: { userId: identitas.userId },
    select: { id: true, aktif: true, status: true },
  })

  if (lama?.aktif && lama.status === "AKTIF") {
    throw new Error("Wajah Anda sudah terdaftar dan aktif — hubungi Admin bila ingin mengganti foto")
  }
  if (lama?.status === "MENUNGGU") {
    throw new Error("Pengajuan wajah Anda masih menunggu persetujuan Admin")
  }

  const data = {
    siswaId: identitas.siswaId,
    deskriptor,
    sampel,
    sumber: "WEBCAM",
    aktif: false,
    status: "MENUNGGU",
    diajukanSendiri: true,
    catatanAdmin: null,
    fotoPengajuan: foto,
  }

  const row = await prisma.profilWajah.upsert({
    where: { userId: identitas.userId },
    create: { userId: identitas.userId, ...data },
    update: data,
    select: { id: true },
  })

  await prisma.logVerifikasiWajah
    .create({
      data: {
        profilId: row.id,
        userId: identitas.userId,
        siswaId: identitas.siswaId,
        tipe: "PENDAFTARAN",
        status: "SUKSES",
        pesan: `Pengajuan wajah mandiri oleh ${identitas.nama} — menunggu persetujuan Admin`,
        perangkat: "ANDROID",
      },
    })
    .catch((e) => console.error("Gagal menulis log pendaftaran wajah:", e))

  return {
    status: "MENUNGGU",
    nama: identitas.nama,
    pesan: "Pengajuan wajah terkirim. Absensi wajah aktif setelah Admin menyetujui.",
  }
}

/** Keputusan Admin atas pengajuan wajah mandiri. */
export async function putuskanPendaftaranWajah(params: {
  profilId: string
  putusan: "SETUJUI" | "TOLAK"
  catatan?: string | null
  adminId: string
}): Promise<{ nama: string; status: "AKTIF" | "DITOLAK" }> {
  const profil = await prisma.profilWajah.findUnique({
    where: { id: params.profilId },
    select: {
      id: true,
      userId: true,
      siswaId: true,
      status: true,
      user: { select: { name: true, guru: { select: { nama: true } } } },
      siswa: { select: { nama: true } },
    },
  })
  if (!profil) throw new Error("Pengajuan wajah tidak ditemukan")
  if (profil.status !== "MENUNGGU") throw new Error("Pengajuan ini sudah diputuskan")

  const nama = profil.siswa?.nama ?? profil.user?.guru?.nama ?? profil.user?.name ?? "Tanpa nama"
  const catatan = (params.catatan ?? "").trim().slice(0, 300) || null
  const setuju = params.putusan === "SETUJUI"

  await prisma.profilWajah.update({
    where: { id: profil.id },
    data: setuju
      ? {
          aktif: true,
          status: "AKTIF",
          catatanAdmin: null,
          // Foto tangkapan tidak disimpan permanen setelah disetujui.
          fotoPengajuan: null,
          dibuatOleh: params.adminId,
        }
      : {
          aktif: false,
          status: "DITOLAK",
          catatanAdmin: catatan,
          fotoPengajuan: null,
          // Jangan simpan descriptor wajah yang ditolak.
          deskriptor: [],
        },
  })

  await prisma.logVerifikasiWajah
    .create({
      data: {
        profilId: setuju ? profil.id : null,
        userId: profil.userId,
        siswaId: profil.siswaId,
        tipe: setuju ? "PENDAFTARAN_DISETUJUI" : "PENDAFTARAN_DITOLAK",
        status: "SUKSES",
        pesan: setuju
          ? `Pengajuan wajah ${nama} disetujui Admin`
          : `Pengajuan wajah ${nama} ditolak${catatan ? `: ${catatan}` : ""}`,
      },
    })
    .catch((e) => console.error("Gagal menulis log keputusan wajah:", e))

  return { nama, status: setuju ? "AKTIF" : "DITOLAK" }
}
