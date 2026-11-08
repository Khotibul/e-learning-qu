"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { audit } from "@/lib/absensi-harian"
import { AMBANG_WAJAH, normalisasiDeskriptor } from "@/lib/wajah-matematika"
import { KIOSK_COOKIE, KIOSK_TOKEN_TTL_SECONDS, signKioskToken, signWajahToken, verifyKioskToken } from "@/lib/wajah-token"
import { putuskanPendaftaranWajah } from "@/lib/wajah-pendaftaran"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Akses ditolak")
  return session.user
}

export type OrangWajah = {
  tipe: "GURU" | "SISWA"
  targetId: string
  nama: string
  nis: string | null
  kelas: string | null
  fotoUrl: string | null
  sudahTerdaftar: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cari guru/siswa untuk didaftarkan foto wajahnya. */
export async function cariOrangWajah(q: string): Promise<OrangWajah[]> {
  await requireAdmin()
  const kata = q.trim()
  if (kata.length < 2) return []

  const [guru, siswa, profil] = await Promise.all([
    prisma.guru.findMany({
      where: {
        deletedAt: null,
        OR: [{ nama: { contains: kata, mode: "insensitive" } }, { nip: { contains: kata } }],
      },
      select: { userId: true, nama: true, nip: true, user: { select: { image: true, biodata: { select: { fotoThumbId: true } } } } },
      take: 8,
      orderBy: { nama: "asc" },
    }),
    prisma.siswa.findMany({
      where: {
        deletedAt: null,
        OR: [{ nama: { contains: kata, mode: "insensitive" } }, { nis: { contains: kata } }],
      },
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } }, user: { select: { image: true, biodata: { select: { fotoThumbId: true } } } } },
      take: 8,
      orderBy: { nama: "asc" },
    }),
    prisma.profilWajah.findMany({ where: { aktif: true }, select: { userId: true, siswaId: true } }),
  ])

  const userTerdaftar = new Set(profil.map((p) => p.userId).filter(Boolean) as string[])
  const siswaTerdaftar = new Set(profil.map((p) => p.siswaId).filter(Boolean) as string[])

  return [
    ...guru.map((g) => ({
      tipe: "GURU" as const,
      targetId: g.userId,
      nama: g.nama,
      nis: g.nip,
      kelas: null,
      fotoUrl: g.user?.image ?? (g.user?.biodata?.fotoThumbId ? `/api/upload/${g.user.biodata.fotoThumbId}` : null),
      sudahTerdaftar: userTerdaftar.has(g.userId),
    })),
    ...siswa.map((s) => ({
      tipe: "SISWA" as const,
      targetId: s.id,
      nama: s.nama,
      nis: s.nis,
      kelas: s.kelas?.nama ?? null,
      fotoUrl: s.user?.image ?? (s.user?.biodata?.fotoThumbId ? `/api/upload/${s.user.biodata.fotoThumbId}` : null),
      sudahTerdaftar: siswaTerdaftar.has(s.id),
    })),
  ]
}

export type ProfilWajahRingkas = {
  id: string
  tipe: "GURU" | "SISWA" | "PEGAWAI"
  nama: string
  nis: string | null
  kelas: string | null
  fotoUrl: string | null
  sampel: number
  sumber: string
  aktif: boolean
  status: string
  diajukanSendiri: boolean
  updatedAt: string
}

export async function daftarProfilWajah(): Promise<ProfilWajahRingkas[]> {
  await requireAdmin()
  const rows = await prisma.profilWajah.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      userId: true,
      siswaId: true,
      fotoId: true,
      fotoPengajuan: true,
      sampel: true,
      sumber: true,
      aktif: true,
      status: true,
      diajukanSendiri: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
          image: true,
          guru: { select: { nama: true, nip: true, deletedAt: true } },
          biodata: { select: { fotoThumbId: true } },
        },
      },
      siswa: {
        select: {
          nama: true,
          nis: true,
          kelas: { select: { nama: true } },
          user: { select: { image: true, biodata: { select: { fotoThumbId: true } } } },
        },
      },
    },
  })

  return rows.map((r) => {
    const fotoThumb =
      r.fotoId ??
      r.fotoPengajuan ??
      r.user?.image ??
      r.user?.biodata?.fotoThumbId ??
      r.siswa?.user?.image ??
      r.siswa?.user?.biodata?.fotoThumbId ??
      null
    return {
      id: r.id,
      tipe: r.siswaId ? "SISWA" : r.user?.guru ? "GURU" : "PEGAWAI",
      nama: r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? "Tanpa nama",
      nis: r.siswa?.nis ?? r.user?.guru?.nip ?? null,
      kelas: r.siswa?.kelas?.nama ?? null,
      fotoUrl: fotoThumb ? (fotoThumb.startsWith("http") || fotoThumb.startsWith("/") ? fotoThumb : `/api/upload/${fotoThumb}`) : null,
      sampel: r.sampel,
      sumber: r.sumber,
      aktif: r.aktif,
      status: r.status,
      diajukanSendiri: r.diajukanSendiri,
      updatedAt: r.updatedAt.toISOString(),
    }
  })
}

/** Simpan/ganti profil wajah hasil upload foto atau tangkapan webcam admin. */
export async function simpanProfilWajah(input: {
  tipe: "GURU" | "SISWA"
  targetId: string
  deskriptor: unknown
  fotoId?: string | null
  sampel?: number
  sumber?: "UPLOAD" | "WEBCAM"
}) {
  const admin = await requireAdmin()
  if (!input.tipe || !UUID_RE.test(input.targetId)) throw new Error("Target wajah tidak valid")

  const deskriptor = normalisasiDeskriptor(input.deskriptor)
  const fotoId = input.fotoId && UUID_RE.test(input.fotoId) ? input.fotoId : null

  let userId: string
  let siswaId: string | null = null
  let nama = ""

  if (input.tipe === "GURU") {
    const guru = await prisma.guru.findFirst({
      where: { userId: input.targetId, deletedAt: null },
      select: { nama: true },
    })
    if (!guru) throw new Error("Guru tidak ditemukan")
    userId = input.targetId
    nama = guru.nama
  } else {
    const siswa = await prisma.siswa.findFirst({
      where: { id: input.targetId, deletedAt: null },
      select: { nama: true, userId: true },
    })
    if (!siswa) throw new Error("Siswa tidak ditemukan")
    siswaId = input.targetId
    userId = siswa.userId
    nama = siswa.nama
  }

  const sampel = Math.min(Math.max(Math.floor(Number(input.sampel) || 1), 1), 10)
  const sumber = input.sumber === "WEBCAM" ? "WEBCAM" : "UPLOAD"

  const row = await prisma.profilWajah.upsert({
    where: { userId },
    create: {
      userId,
      siswaId,
      deskriptor,
      fotoId,
      sampel,
      sumber,
      dibuatOleh: admin.id,
      aktif: true,
      status: "AKTIF",
      diajukanSendiri: false,
      catatanAdmin: null,
      fotoPengajuan: null,
    },
    update: {
      siswaId,
      deskriptor,
      fotoId,
      sampel,
      sumber,
      dibuatOleh: admin.id,
      aktif: true,
      status: "AKTIF",
      diajukanSendiri: false,
      catatanAdmin: null,
      fotoPengajuan: null,
    },
    select: { id: true },
  })

  await audit(admin.id, "SIMPAN_PROFIL_WAJAH", "ProfilWajah", row.id, {
    nama,
    tipe: input.tipe,
    sumber,
    sampel,
    ambang: AMBANG_WAJAH,
  })
  revalidatePath("/admin/wajah")
  return { success: true, id: row.id, nama }
}

export async function hapusProfilWajah(id: string) {
  const admin = await requireAdmin()
  if (!UUID_RE.test(id)) throw new Error("Profil tidak valid")
  const lama = await prisma.profilWajah.findUnique({ where: { id }, select: { userId: true, siswaId: true } })
  if (!lama) throw new Error("Profil wajah tidak ditemukan")
  await prisma.profilWajah.delete({ where: { id } })
  await audit(admin.id, "HAPUS_PROFIL_WAJAH", "ProfilWajah", id, lama)
  revalidatePath("/admin/wajah")
  return { success: true }
}

/** Aktif/nonaktifkan profil tanpa menghapus descriptor. */
export async function ubahStatusProfilWajah(id: string, aktif: boolean) {
  const admin = await requireAdmin()
  if (!UUID_RE.test(id)) throw new Error("Profil tidak valid")
  const row = await prisma.profilWajah.update({
    where: { id },
    data: aktif ? { aktif: true, status: "AKTIF", catatanAdmin: null } : { aktif: false },
    select: { userId: true, siswaId: true },
  })
  await audit(admin.id, aktif ? "AKTIFKAN_PROFIL_WAJAH" : "NONAKTIFKAN_PROFIL_WAJAH", "ProfilWajah", id, row)
  revalidatePath("/admin/wajah")
  return { success: true }
}

export type LogWajahRingkas = {
  id: string
  nama: string
  tipe: string
  status: string
  pesan: string | null
  jarak: number | null
  perangkat: string | null
  createdAt: string
}

export async function daftarLogWajah(take = 100): Promise<LogWajahRingkas[]> {
  await requireAdmin()
  const rows = await prisma.logVerifikasiWajah.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 300),
    select: {
      id: true,
      tipe: true,
      status: true,
      pesan: true,
      jarak: true,
      perangkat: true,
      createdAt: true,
      user: { select: { name: true, guru: { select: { nama: true } } } },
      siswa: { select: { nama: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    nama: r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? "Tidak dikenal",
    tipe: r.tipe,
    status: r.status,
    pesan: r.pesan,
    jarak: r.jarak == null ? null : Math.round(r.jarak * 1000) / 1000,
    perangkat: r.perangkat,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Token + URL kiosk absensi wajah (dibuka di tab/browser perangkat). */
export async function tokenKioskWajah() {
  const admin = await requireAdmin()
  const token = await signWajahToken(admin.id, String(admin.role ?? "ADMIN"), "ADMIN")
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
  return { token, url: `${base}/absensi/wajah?t=${encodeURIComponent(token)}` }
}

/**
 * Aktifkan kiosk absensi di komputer ini (cookie 30 hari) supaya guru/siswa
 * bisa absen wajah atau sidik jari tanpa login. Hanya Admin yang boleh.
 */
export async function aktifkanKioskDesktop() {
  const admin = await requireAdmin()
  const token = await signKioskToken(admin.id, admin.name ?? null)
  const jar = await cookies()
  jar.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: KIOSK_TOKEN_TTL_SECONDS,
  })
  await audit(admin.id, "KIOSK_DESKTOP_AKTIF", "User", admin.id, {
    perangkat: "BROWSER",
    masaBerlakuHari: KIOSK_TOKEN_TTL_SECONDS / 86400,
    berlakuSampai: new Date(Date.now() + KIOSK_TOKEN_TTL_SECONDS * 1000).toISOString(),
  })
  return { url: "/absensi/kiosk" }
}

export type AktivasiKioskRingkas = {
  id: string
  perangkat: string
  diaktifkan: string
  oleh: string
  berlakuSampai: string
  aktif: boolean
}

export type StatusKioskDesktop = {
  /** Cookie kiosk di browser admin yang sedang membuka halaman ini. */
  browser: { aktif: boolean; berlakuSampai: string | null }
  /** Satu baris per komputer (aplikasi desktop) — aktivasi terakhirnya. */
  perangkat: AktivasiKioskRingkas[]
}

/**
 * Status kiosk desktop untuk panel Admin → Absensi Wajah.
 * Browser: dibaca dari cookie perangkat yang sedang dipakai.
 * Aplikasi desktop: dari audit aktivasi (token 30 hari), dikelompokkan per komputer.
 */
export async function statusKioskDesktop(): Promise<StatusKioskDesktop> {
  await requireAdmin()

  const jar = await cookies()
  const tokenBrowser = jar.get(KIOSK_COOKIE)?.value ?? ""
  const sesiBrowser = tokenBrowser ? await verifyKioskToken(tokenBrowser) : null

  const rows = await prisma.auditLog.findMany({
    where: { action: "KIOSK_DESKTOP_AKTIF" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      detail: true,
      user: { select: { name: true, email: true, guru: { select: { nama: true } } } },
    },
  })

  const sekarang = Date.now()
  const perKomputer = new Map<string, AktivasiKioskRingkas>()

  for (const r of rows) {
    const detail = (r.detail && typeof r.detail === "object" ? r.detail : {}) as {
      perangkat?: string
      perangkatNama?: string
      masaBerlakuHari?: number
      berlakuSampai?: string
    }
    // Hanya aktivasi dari aplikasi desktop; aktivasi browser sudah diwakili cookie di atas.
    if (detail.perangkat !== "DESKTOP") continue

    const nama = (detail.perangkatNama ?? "Desktop").trim() || "Desktop"
    if (perKomputer.has(nama)) continue // rows sudah urut terbaru → simpan yang terakhir saja

    const hari = Number.isFinite(detail.masaBerlakuHari) ? Number(detail.masaBerlakuHari) : 30
    const kedaluwarsa = detail.berlakuSampai
      ? new Date(detail.berlakuSampai)
      : new Date(r.createdAt.getTime() + hari * 86400000)

    perKomputer.set(nama, {
      id: r.id,
      perangkat: nama,
      diaktifkan: r.createdAt.toISOString(),
      oleh: r.user?.guru?.nama ?? r.user?.name ?? r.user?.email ?? "Admin",
      berlakuSampai: kedaluwarsa.toISOString(),
      aktif: kedaluwarsa.getTime() > sekarang,
    })
  }

  return {
    browser: {
      aktif: !!sesiBrowser,
      berlakuSampai: sesiBrowser?.exp ? new Date(sesiBrowser.exp * 1000).toISOString() : null,
    },
    perangkat: [...perKomputer.values()].sort((a, b) => b.diaktifkan.localeCompare(a.diaktifkan)),
  }
}

export type PengajuanWajahRingkas = {
  id: string
  nama: string
  tipe: "GURU" | "SISWA" | "PEGAWAI"
  nis: string | null
  kelas: string | null
  foto: string | null
  sampel: number
  diajukanPada: string
}

/** Daftar pengajuan wajah mandiri yang menunggu persetujuan Admin. */
export async function daftarPengajuanWajah(): Promise<PengajuanWajahRingkas[]> {
  await requireAdmin()
  const rows = await prisma.profilWajah.findMany({
    where: { status: "MENUNGGU" },
    orderBy: { updatedAt: "asc" },
    take: 200,
    select: {
      id: true,
      sampel: true,
      fotoPengajuan: true,
      userId: true,
      siswaId: true,
      updatedAt: true,
      user: { select: { name: true, guru: { select: { nama: true, nip: true } } } },
      siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    nama: r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? "Tanpa nama",
    tipe: r.siswaId ? "SISWA" : r.user?.guru ? "GURU" : "PEGAWAI",
    nis: r.siswa?.nis ?? r.user?.guru?.nip ?? null,
    kelas: r.siswa?.kelas?.nama ?? null,
    foto: r.fotoPengajuan,
    sampel: r.sampel,
    diajukanPada: r.updatedAt.toISOString(),
  }))
}

/** Setujui/tolak pengajuan wajah mandiri. */
export async function putuskanPengajuanWajahAdmin(id: string, putusan: "SETUJUI" | "TOLAK", catatan?: string) {
  const admin = await requireAdmin()
  if (!UUID_RE.test(id)) throw new Error("Pengajuan tidak valid")
  const hasil = await putuskanPendaftaranWajah({ profilId: id, putusan, catatan, adminId: admin.id })
  await audit(admin.id, putusan === "SETUJUI" ? "SETUJUI_WAJAH" : "TOLAK_WAJAH", "ProfilWajah", id, {
    nama: hasil.nama,
    status: hasil.status,
    catatan: catatan ?? null,
  })
  revalidatePath("/admin/wajah")
  return { success: true, ...hasil }
}

export type RingkasanWajah = {
  totalProfil: number
  siswa: number
  guru: number
  scanHariIni: number
  suksesHariIni: number
  pengajuan: number
}

export async function ringkasanWajah(): Promise<RingkasanWajah> {
  await requireAdmin()
  const awal = new Date()
  awal.setHours(0, 0, 0, 0)
  const [totalProfil, siswa, guru, scanHariIni, suksesHariIni, pengajuan] = await Promise.all([
    prisma.profilWajah.count({ where: { aktif: true } }),
    prisma.profilWajah.count({ where: { aktif: true, siswaId: { not: null } } }),
    prisma.profilWajah.count({ where: { aktif: true, userId: { not: null } } }),
    prisma.logVerifikasiWajah.count({ where: { createdAt: { gte: awal } } }),
    prisma.logVerifikasiWajah.count({ where: { createdAt: { gte: awal }, status: "SUKSES" } }),
    prisma.profilWajah.count({ where: { status: "MENUNGGU" } }),
  ])
  return { totalProfil, siswa, guru, scanHariIni, suksesHariIni, pengajuan }
}
