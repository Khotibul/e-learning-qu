import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { kirimNotifikasi, type PenerimaNotifikasi } from "@/lib/notifikasi"
import { createAuditLog } from "@/lib/audit"
import { randomBytes } from "crypto"
import type { JenisIzin, StatusIzinSantri, StatusKehadiranSantri, TahapIzin } from "@prisma/client"

// ─── E-IZIN SANTRI — logika bisnis terpusat ───────────────────────────
// Semua transisi status memakai transaksi DB + pengecekan status ekspektasi
// (idempoten). Notifikasi dikirim SETELAH transaksi sukses (fire-and-forget).

export const JENIS_IZIN_LABEL: Record<JenisIzin, string> = {
  PULANG_RUMAH: "Izin Pulang ke Rumah",
  KELUAR_SEMENTARA: "Izin Keluar Sementara",
  BEROBAT: "Izin Berobat",
  KEGIATAN_KELUARGA: "Izin Kegiatan Keluarga",
  KEGIATAN_SEKOLAH: "Izin Kegiatan Sekolah",
  DARURAT: "Izin Darurat",
  LIBURAN_PONDOK: "Izin Liburan Pondok",
}

export const STATUS_IZIN_LABEL: Record<StatusIzinSantri, string> = {
  DRAFT: "Draft",
  DIAJUKU: "Diajukan",
  MENUNGGU_WALI: "Menunggu Persetujuan Wali",
  MENUNGGU_MUSYRIF: "Menunggu Musyrif",
  MENUNGGU_ADMIN: "Menunggu Admin Pondok",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
  KEDALUWARSA: "Kedaluwarsa",
  SELESAI: "Selesai",
}

export const KEBERADAAN_LABEL: Record<StatusKehadiranSantri, string> = {
  DI_PONDOK: "Di Pondok",
  KEGIATAN_LUAR: "Kegiatan Luar",
  IZIN_KELUAR: "Izin Keluar Sementara",
  IZIN_PULANG: "Pulang / Di Rumah",
  DALAM_PERJALANAN: "Dalam Perjalanan",
  DI_RUMAH: "Pulang / Di Rumah",
  TERLAMBAT_KEMBALI: "Terlambat Kembali",
  BELUM_KEMBALI: "Belum Kembali",
  TIDAK_DIKETAHUI: "Tidak Diketahui",
}

const STATUS_AKTIF_IZIN: StatusIzinSantri[] = ["DRAFT", "DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_MUSYRIF", "MENUNGGU_ADMIN", "DISETUJUI"]
const STATUS_MENUNGGU: StatusIzinSantri[] = ["DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_MUSYRIF", "MENUNGGU_ADMIN"]
const MAKS_DURASI_HARI = 90

// ─── GUARD / RESOLVER ─────────────────────────────────────────────────

export async function getSantriByUserId(userId: string) {
  return prisma.santri.findFirst({
    where: { userId, deletedAt: null, status: { notIn: ["LULUS", "ALUMNI", "KELUAR"] } },
    include: {
      asrama: { select: { id: true, nama: true } },
      kamar: { select: { id: true, nama: true } },
      walis: { include: { wali: { select: { id: true, userId: true, nama: true, hubungan: true, noTelp: true } } } },
    },
  })
}

export async function requireSantri(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const santri = await getSantriByUserId(session.user.id)
  if (!santri) throw new Error("Akun ini tidak terdaftar sebagai santri")
  return santri.id
}

export async function requireWaliSantri(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const wali = await prisma.waliSantri.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { id: true } })
  if (!wali) throw new Error("Akun ini tidak terdaftar sebagai wali santri")
  return wali.id
}

/** Musyrif = Guru jabatan "MUSYRIF" ATAU pembina asrama (Asrama.musyrifId). Admin selalu lolos. */
export async function requireMusyrif(): Promise<{ userId: string; guruId: string | null; admin: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role === "ADMIN") return { userId: session.user.id, guruId: null, admin: true }
  const guru = await prisma.guru.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { id: true, jabatan: true, asramaDibina: { select: { id: true } } } })
  if (!guru) throw new Error("Bukan musyrif")
  const isMusyrif = guru.jabatan === "MUSYRIF" || guru.asramaDibina.length > 0
  if (!isMusyrif) throw new Error("Bukan musyrif")
  return { userId: session.user.id, guruId: guru.id, admin: false }
}

/** Petugas gerbang = Admin ATAU Guru jabatan GERBANG/MUSYRIF/PENGASUH. */
export async function requireGerbang(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role === "ADMIN") return session.user.id
  const guru = await prisma.guru.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { jabatan: true } })
  if (guru && ["GERBANG", "MUSYRIF", "PENGASUH"].includes(guru.jabatan ?? "")) return session.user.id
  throw new Error("Bukan petugas gerbang")
}

export async function requireAdminIzin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") throw new Error("Forbidden")
  return session.user.id
}

// ─── PENGATURAN PER JENIS ─────────────────────────────────────────────

export type PengaturanIzin = { butuhWali: boolean; butuhMusyrif: boolean; butuhAdmin: boolean; aktif: boolean }

export async function getPengaturan(jenis: JenisIzin): Promise<PengaturanIzin> {
  const row = await prisma.izinPengaturan.findUnique({ where: { jenis } })
  return row ?? { butuhWali: true, butuhMusyrif: true, butuhAdmin: true, aktif: true }
}

/** Tahap berikutnya setelah satu tahap disetujui; null = langsung DISETUJUI. */
export function nextStatusSetelahTahap(sudah: { wali: boolean; musyrif: boolean }, p: PengaturanIzin): "MENUNGGU_WALI" | "MENUNGGU_MUSYRIF" | "MENUNGGU_ADMIN" | "DISETUJUI" {
  if (p.butuhWali && !sudah.wali) return "MENUNGGU_WALI"
  if (p.butuhMusyrif && !sudah.musyrif) return "MENUNGGU_MUSYRIF"
  if (p.butuhAdmin) return "MENUNGGU_ADMIN"
  return "DISETUJUI"
}

export function statusAwalSetelahDiajukan(p: PengaturanIzin): "MENUNGGU_WALI" | "MENUNGGU_MUSYRIF" | "MENUNGGU_ADMIN" | "DISETUJUI" {
  return nextStatusSetelahTahap({ wali: false, musyrif: false }, p)
}

// ─── VALIDASI FORMULIR ────────────────────────────────────────────────

export type FormIzinInput = {
  jenis: string
  alasan: string
  rencanaKeluar: string | Date
  rencanaKembali: string | Date
  alamatTujuan: string
  namaPenjemput: string
  hubunganPenjemput: string
  noTelpPenjemput: string
  lampiranId?: string | null
}

const HUBUNGAN = ["AYAH", "IBU", "WALI", "LAINNYA"]

export async function validasiFormIzin(input: FormIzinInput): Promise<{ jenis: JenisIzin; rencanaKeluar: Date; rencanaKembali: Date; hubunganPenjemput: "AYAH" | "IBU" | "WALI" | "LAINNYA" }> {
  const jenis = String(input.jenis || "") as JenisIzin
  if (!(jenis in JENIS_IZIN_LABEL)) throw new Error("Jenis izin tidak dikenal")
  const pengaturan = await getPengaturan(jenis)
  if (!pengaturan.aktif) throw new Error(`Jenis izin ${JENIS_IZIN_LABEL[jenis]} sedang tidak aktif`)

  const alasan = String(input.alasan || "").trim()
  if (alasan.length < 10) throw new Error("Alasan izin minimal 10 karakter")

  const rencanaKeluar = new Date(input.rencanaKeluar)
  const rencanaKembali = new Date(input.rencanaKembali)
  if (isNaN(rencanaKeluar.getTime()) || isNaN(rencanaKembali.getTime())) throw new Error("Tanggal/jam rencana tidak valid")
  const now = new Date()
  if (rencanaKeluar.getTime() < now.getTime() - 5 * 60 * 1000) throw new Error("Waktu rencana keluar sudah lewat")
  if (rencanaKembali.getTime() <= rencanaKeluar.getTime()) throw new Error("Waktu kembali harus setelah waktu keluar")
  const durasiHari = (rencanaKembali.getTime() - rencanaKeluar.getTime()) / (24 * 3600 * 1000)
  if (durasiHari > MAKS_DURASI_HARI) throw new Error(`Durasi izin maksimal ${MAKS_DURASI_HARI} hari`)

  const alamatTujuan = String(input.alamatTujuan || "").trim()
  if (alamatTujuan.length < 5) throw new Error("Alamat tujuan minimal 5 karakter")

  const namaPenjemput = String(input.namaPenjemput || "").trim()
  if (namaPenjemput.length < 3) throw new Error("Nama penjemput minimal 3 karakter")

  const hubunganPenjemput = String(input.hubunganPenjemput || "") as never
  if (!HUBUNGAN.includes(hubunganPenjemput)) throw new Error("Hubungan penjemput tidak valid")

  const noTelpPenjemput = String(input.noTelpPenjemput || "").replace(/[\s-]/g, "")
  if (!/^\d{9,15}$/.test(noTelpPenjemput)) throw new Error("Nomor HP penjemput tidak valid (9-15 digit)")

  if (input.lampiranId) {
    const up = await prisma.upload.findUnique({ where: { id: input.lampiranId }, select: { id: true } })
    if (!up) throw new Error("Lampiran tidak ditemukan")
  }

  return { jenis, rencanaKeluar, rencanaKembali, hubunganPenjemput }
}

async function cegahIzinAktifGanda(tx: { izinSantri: { findFirst: typeof prisma.izinSantri.findFirst } }, santriId: string, kecualiId?: string) {
  const aktif = await tx.izinSantri.findFirst({
    where: { santriId, status: { in: STATUS_AKTIF_IZIN }, ...(kecualiId ? { id: { not: kecualiId } } : {}) },
    select: { id: true, status: true, jenis: true },
  })
  if (aktif) throw new Error(`Masih ada izin aktif (${STATUS_IZIN_LABEL[aktif.status]}). Selesaikan atau batalkan terlebih dahulu.`)
}

// ─── PEMBANTU NOTIFIKASI ──────────────────────────────────────────────

async function penerimaWali(santriId: string): Promise<PenerimaNotifikasi[]> {
  const walis = await prisma.santriWali.findMany({ where: { santriId }, include: { wali: { select: { userId: true, nama: true } } } })
  return walis.filter((w) => w.wali.userId).map((w) => ({ userId: w.wali.userId!, label: "wali-santri", link: "/wali-santri/izin" }))
}

// ─── CRUD SANTRI: DRAFT / AJUKAN / BATALKAN ───────────────────────────

export async function simpanDraftIzin(userId: string, input: FormIzinInput, izinId?: string) {
  const santri = await getSantriByUserId(userId)
  if (!santri) throw new Error("Akun ini tidak terdaftar sebagai santri")
  if (santri.status !== "AKTIF") throw new Error("Hanya santri aktif yang dapat mengajukan izin")
  const v = await validasiFormIzin(input)

  return prisma.$transaction(async (tx) => {
    if (izinId) {
      const lama = await tx.izinSantri.findUnique({ where: { id: izinId }, select: { santriId: true, status: true } })
      if (!lama || lama.santriId !== santri.id) throw new Error("Draft izin tidak ditemukan")
      if (lama.status !== "DRAFT") throw new Error("Hanya draft yang dapat diubah")
      return tx.izinSantri.update({
        where: { id: izinId },
        data: {
          jenis: v.jenis, alasan: String(input.alasan).trim(),
          rencanaKeluar: v.rencanaKeluar, rencanaKembali: v.rencanaKembali,
          alamatTujuan: String(input.alamatTujuan).trim(),
          namaPenjemput: String(input.namaPenjemput).trim(),
          hubunganPenjemput: v.hubunganPenjemput, noTelpPenjemput: String(input.noTelpPenjemput).replace(/[\s-]/g, ""),
          lampiranId: input.lampiranId ?? null,
        },
      })
    }
    await cegahIzinAktifGanda(tx, santri.id)
    return tx.izinSantri.create({
      data: {
        santriId: santri.id, jenis: v.jenis, alasan: String(input.alasan).trim(),
        rencanaKeluar: v.rencanaKeluar, rencanaKembali: v.rencanaKembali,
        alamatTujuan: String(input.alamatTujuan).trim(),
        namaPenjemput: String(input.namaPenjemput).trim(),
        hubunganPenjemput: v.hubunganPenjemput, noTelpPenjemput: String(input.noTelpPenjemput).replace(/[\s-]/g, ""),
        lampiranId: input.lampiranId ?? null, status: "DRAFT",
      },
    })
  })
}

export async function ajukanIzinSantri(userId: string, input: FormIzinInput, draftId?: string) {
  const santri = await getSantriByUserId(userId)
  if (!santri) throw new Error("Akun ini tidak terdaftar sebagai santri")
  if (santri.status !== "AKTIF") throw new Error("Hanya santri aktif yang dapat mengajukan izin")
  const v = await validasiFormIzin(input)

  const izin = await prisma.$transaction(async (tx) => {
    let row
    if (draftId) {
      const lama = await tx.izinSantri.findUnique({ where: { id: draftId }, select: { santriId: true, status: true } })
      if (!lama || lama.santriId !== santri.id) throw new Error("Draft izin tidak ditemukan")
      if (lama.status !== "DRAFT" && lama.status !== "DIAJUKU") throw new Error("Status draft tidak dapat diajukan")
      row = await tx.izinSantri.update({
        where: { id: draftId },
        data: {
          jenis: v.jenis, alasan: String(input.alasan).trim(),
          rencanaKeluar: v.rencanaKeluar, rencanaKembali: v.rencanaKembali,
          alamatTujuan: String(input.alamatTujuan).trim(),
          namaPenjemput: String(input.namaPenjemput).trim(),
          hubunganPenjemput: v.hubunganPenjemput, noTelpPenjemput: String(input.noTelpPenjemput).replace(/[\s-]/g, ""),
          lampiranId: input.lampiranId ?? null,
        },
      })
    } else {
      row = await tx.izinSantri.create({
        data: {
          santriId: santri.id, jenis: v.jenis, alasan: String(input.alasan).trim(),
          rencanaKeluar: v.rencanaKeluar, rencanaKembali: v.rencanaKembali,
          alamatTujuan: String(input.alamatTujuan).trim(),
          namaPenjemput: String(input.namaPenjemput).trim(),
          hubunganPenjemput: v.hubunganPenjemput, noTelpPenjemput: String(input.noTelpPenjemput).replace(/[\s-]/g, ""),
          lampiranId: input.lampiranId ?? null,
        },
      })
    }
    await cegahIzinAktifGanda(tx, santri.id, row.id)

    const pengaturan = await getPengaturan(v.jenis)
    const statusBaru = statusAwalSetelahDiajukan(pengaturan)
    const updated = await tx.izinSantri.update({
      where: { id: row.id },
      data: { status: statusBaru === "DISETUJUI" ? "DISETUJUI" : statusBaru },
    })
    await tx.izinApprovalLog.create({ data: { izinId: row.id, tahap: "DIAJUKU", keputusan: "DIAJUKU", actorUserId: userId, catatan: `Status: ${STATUS_IZIN_LABEL[statusBaru]}` } })
    if (statusBaru === "DISETUJUI") {
      await terbitkanSurat(tx, updated.id)
      return (await tx.izinSantri.findUnique({ where: { id: row.id } }))!
    }
    return updated
  })

  await createAuditLog({ userId, action: "IZIN_SANTRI_DIAJUKU", entity: "IzinSantri", entityId: izin.id, detail: { jenis: izin.jenis, status: izin.status } })
  void notifikasiDiajukan(izin.id, santri.nama, v.jenis)
  return izin
}

export async function batalkanIzinSantri(userId: string, izinId: string, alasan: string) {
  const santri = await getSantriByUserId(userId)
  if (!santri) throw new Error("Akun ini tidak terdaftar sebagai santri")
  if (String(alasan || "").trim().length < 5) throw new Error("Alasan pembatalan minimal 5 karakter")

  const izin = await prisma.izinSantri.updateMany({
    where: { id: izinId, santriId: santri.id, status: { in: [...STATUS_MENUNGGU, "DRAFT", "DISETUJUI"] }, checkoutAt: null },
    data: { status: "DIBATALKAN", alasanKeputusan: String(alasan).trim() },
  })
  if (izin.count === 0) throw new Error("Izin tidak dapat dibatalkan (sudah diproses petugas gerbang)")
  await prisma.izinApprovalLog.create({ data: { izinId, tahap: "SISTEM", keputusan: "DIBATALKAN", actorUserId: userId, catatan: String(alasan).trim() } })
  await createAuditLog({ userId, action: "IZIN_SANTRI_DIBATALKAN", entity: "IzinSantri", entityId: izinId, detail: { alasan } })
  const ulang = await prisma.izinSantri.findUnique({ where: { id: izinId }, include: { santri: { select: { nama: true, userId: true } } } })
  if (ulang) {
    void kirimNotifikasi(
      [{ userId: ulang.santri.userId, label: "santri", link: "/santri/izin" }, ...(await penerimaWali(ulang.santriId))],
      { judul: "Izin Dibatalkan", pesan: `Pengajuan izin ${JENIS_IZIN_LABEL[ulang.jenis]} telah DIBATALKAN oleh santri.`, tipe: "INFO", eventKey: `izin-batal:${izinId}` }
    )
  }
  return { success: true }
}

// ─── PERSETUJUAN: WALI / MUSYRIF / ADMIN ──────────────────────────────

export async function setujuiIzin(izinId: string, tahap: "WALI" | "MUSYRIF" | "ADMIN", actorUserId: string, catatan?: string) {
  const izin = await prisma.izinSantri.findUnique({ where: { id: izinId }, include: { santri: { select: { nama: true, user: { select: { id: true } } } } } })
  if (!izin) throw new Error("Izin tidak ditemukan")
  const pengaturan = await getPengaturan(izin.jenis)

  const ekspektasi: StatusIzinSantri = tahap === "WALI" ? "MENUNGGU_WALI" : tahap === "MUSYRIF" ? "MENUNGGU_MUSYRIF" : "MENUNGGU_ADMIN"
  if (izin.status !== ekspektasi) throw new Error(`Izin tidak dalam tahap ${tahap} (status: ${STATUS_IZIN_LABEL[izin.status]})`)
  if (izin.rencanaKembali.getTime() < Date.now()) throw new Error("Izin sudah melewati batas waktu — tidak dapat disetujui")

  const sudah = { wali: tahap === "WALI" ? true : Boolean(izin.waliApprovedAt), musyrif: tahap === "MUSYRIF" ? true : Boolean(izin.musyrifApprovedAt) }
  // Admin adalah keputusan akhir → selalu DISETUJUI bila tahap ADMIN disetujui
  const berikutnya = tahap === "ADMIN" ? "DISETUJUI" : nextStatusSetelahTahap(sudah, pengaturan)

  const hasil = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {}
    if (tahap === "WALI") { data.waliApprovedAt = new Date(); data.waliApprovedBy = actorUserId }
    if (tahap === "MUSYRIF") { data.musyrifApprovedAt = new Date(); data.musyrifApprovedBy = actorUserId }
    if (tahap === "ADMIN") { data.adminApprovedAt = new Date(); data.adminApprovedBy = actorUserId }
    data.status = berikutnya
    const upd = await tx.izinSantri.updateMany({ where: { id: izinId, status: ekspektasi }, data: data as never })
    if (upd.count === 0) throw new Error("Izin sudah diproses pihak lain")
    await tx.izinApprovalLog.create({ data: { izinId, tahap, keputusan: "DISETUJUI", actorUserId, catatan: catatan ?? null } })
    if (berikutnya === "DISETUJUI") await terbitkanSurat(tx, izinId)
    return (await tx.izinSantri.findUnique({ where: { id: izinId } }))!
  })

  await createAuditLog({ userId: actorUserId, action: `IZIN_${tahap}_DISETUJUI`, entity: "IzinSantri", entityId: izinId, detail: { status: hasil.status } })
  void notifikasiKeputusan(hasil, tahap, "DISETUJUI", catatan)
  return hasil
}

export async function tolakIzin(izinId: string, tahap: "WALI" | "MUSYRIF" | "ADMIN", actorUserId: string, alasan: string) {
  if (String(alasan || "").trim().length < 5) throw new Error("Alasan penolakan minimal 5 karakter")
  const izin = await prisma.izinSantri.findUnique({ where: { id: izinId } })
  if (!izin) throw new Error("Izin tidak ditemukan")
  const ekspektasi: StatusIzinSantri = tahap === "WALI" ? "MENUNGGU_WALI" : tahap === "MUSYRIF" ? "MENUNGGU_MUSYRIF" : "MENUNGGU_ADMIN"
  if (izin.status !== ekspektasi) throw new Error(`Izin tidak dalam tahap ${tahap}`)

  await prisma.$transaction(async (tx) => {
    const upd = await tx.izinSantri.updateMany({ where: { id: izinId, status: ekspektasi }, data: { status: "DITOLAK", alasanKeputusan: String(alasan).trim() } })
    if (upd.count === 0) throw new Error("Izin sudah diproses pihak lain")
    await tx.izinApprovalLog.create({ data: { izinId, tahap, keputusan: "DITOLAK", actorUserId, catatan: String(alasan).trim() } })
  })

  await createAuditLog({ userId: actorUserId, action: `IZIN_${tahap}_DITOLAK`, entity: "IzinSantri", entityId: izinId, detail: { alasan } })
  const ulang = (await prisma.izinSantri.findUnique({ where: { id: izinId } }))!
  void notifikasiKeputusan(ulang, tahap, "DITOLAK", alasan)
  return ulang
}

// ─── TERBITKAN SURAT + TOKEN QR ───────────────────────────────────────

async function terbitkanSurat(tx: Omit<PrismaTx, never>, izinId: string) {
  const now = new Date()
  const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
  const prefix = `IZIN/${ym}/`
  const last = await tx.izinSantri.findFirst({ where: { suratNomor: { startsWith: prefix } }, orderBy: { suratNomor: "desc" }, select: { suratNomor: true } })
  const seq = last?.suratNomor ? parseInt(last.suratNomor.slice(prefix.length), 10) + 1 : 1
  const nomor = `${prefix}${String(seq).padStart(4, "0")}`
  const token = randomBytes(24).toString("hex")
  const izin = await tx.izinSantri.findUnique({ where: { id: izinId }, select: { rencanaKembali: true } })
  const expires = new Date((izin?.rencanaKembali ?? new Date()).getTime() + 24 * 3600 * 1000) // grace 24 jam
  await tx.izinSantri.update({ where: { id: izinId }, data: { suratNomor: nomor, suratToken: token, suratExpiresAt: expires } })
  await tx.izinApprovalLog.create({ data: { izinId, tahap: "SISTEM", keputusan: "SURAT_DITERBITKAN", catatan: `Nomor ${nomor}` } })
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// ─── CHECK-OUT / CHECK-IN GERBANG ─────────────────────────────────────

export async function checkoutIzin(params: { izinId?: string; token?: string }, actorUserId: string, opts?: { verifikasiPenjemput?: boolean }) {
  let izinId = params.izinId
  if (!izinId && params.token) {
    const byToken = await prisma.izinSantri.findUnique({ where: { suratToken: params.token }, select: { id: true } })
    if (!byToken) throw new Error("QR izin tidak valid")
    izinId = byToken.id
  }
  if (!izinId) throw new Error("Izin tidak ditemukan")

  // auto-perbarui status kedaluwarsa dulu
  await perbaruiIzinTerlambat()

  const hasil = await prisma.$transaction(async (tx) => {
    const izin = await tx.izinSantri.findUnique({ where: { id: izinId }, include: { santri: { select: { id: true, nama: true, status: true, keberadaan: true, userId: true } } } })
    if (!izin) throw new Error("Izin tidak ditemukan")
    if (izin.status !== "DISETUJUI") throw new Error(`Izin tidak dalam status disetujui (status: ${STATUS_IZIN_LABEL[izin.status]})`)
    if (izin.checkoutAt) throw new Error("Santri sudah pernah check-out untuk izin ini")
    if (izin.suratExpiresAt && izin.suratExpiresAt.getTime() < Date.now()) throw new Error("Surat izin sudah kedaluwarsa")
    if (izin.santri.status !== "AKTIF") throw new Error("Status administrasi santri bukan AKTIF")

    const keberadaanBaru: StatusKehadiranSantri = izin.jenis === "PULANG_RUMAH" ? "IZIN_PULANG" : "IZIN_KELUAR"
    const upd = await tx.izinSantri.updateMany({ where: { id: izinId, status: "DISETUJUI", checkoutAt: null }, data: { checkoutAt: new Date(), checkoutBy: actorUserId, ...(opts?.verifikasiPenjemput ? { penjemputVerifiedAt: new Date(), penjemputVerifiedBy: actorUserId } : {}) } })
    if (upd.count === 0) throw new Error("Check-out ganda dicegah — data tidak diubah")

    await tx.santri.update({ where: { id: izin.santri.id }, data: { keberadaan: keberadaanBaru } })
    await tx.santriStatusLog.create({ data: { santriId: izin.santri.id, jenis: "KEBERADAAN", dari: izin.santri.keberadaan, ke: keberadaanBaru, alasan: `Check-out izin ${JENIS_IZIN_LABEL[izin.jenis]} (${izin.suratNomor ?? izin.id})`, verifiedBy: actorUserId } })
    await tx.izinApprovalLog.create({ data: { izinId, tahap: "GERBANG_KELUAR", keputusan: "CHECKOUT", actorUserId, catatan: opts?.verifikasiPenjemput ? "Penjemput terverifikasi" : null } })
    return (await tx.izinSantri.findUnique({ where: { id: izinId } }))!
  })

  await createAuditLog({ userId: actorUserId, action: "IZIN_CHECKOUT", entity: "IzinSantri", entityId: izinId, detail: { suratNomor: hasil.suratNomor } })
  void notifikasiCheckout(hasil)
  return hasil
}

export async function checkinIzin(izinId: string, actorUserId: string) {
  await perbaruiIzinTerlambat()
  const hasil = await prisma.$transaction(async (tx) => {
    const izin = await tx.izinSantri.findUnique({ where: { id: izinId }, include: { santri: { select: { id: true, nama: true, keberadaan: true, userId: true } } } })
    if (!izin) throw new Error("Izin tidak ditemukan")
    if (izin.status !== "DISETUJUI") throw new Error(`Izin tidak dapat check-in (status: ${STATUS_IZIN_LABEL[izin.status]})`)
    if (!izin.checkoutAt) throw new Error("Santri belum check-out")
    if (izin.checkinAt) throw new Error("Check-in ganda dicegah — data tidak diubah")

    const upd = await tx.izinSantri.updateMany({ where: { id: izinId, status: "DISETUJUI", checkoutAt: { not: null }, checkinAt: null }, data: { checkinAt: new Date(), checkinBy: actorUserId, status: "SELESAI" } })
    if (upd.count === 0) throw new Error("Check-in ganda dicegah — data tidak diubah")

    await tx.santri.update({ where: { id: izin.santri.id }, data: { keberadaan: "DI_PONDOK" } })
    await tx.santriStatusLog.create({ data: { santriId: izin.santri.id, jenis: "KEBERADAAN", dari: izin.santri.keberadaan, ke: "DI_PONDOK", alasan: `Check-in kembali dari izin ${izin.suratNomor ?? izin.id}`, verifiedBy: actorUserId } })
    await tx.izinApprovalLog.create({ data: { izinId, tahap: "GERBANG_MASUK", keputusan: "CHECKIN", actorUserId } })
    return (await tx.izinSantri.findUnique({ where: { id: izinId } }))!
  })

  await createAuditLog({ userId: actorUserId, action: "IZIN_CHECKIN", entity: "IzinSantri", entityId: izinId, detail: {} })
  void notifikasiCheckin(hasil)
  return hasil
}

/** Konfirmasi "tiba di rumah" — opsional, TIDAK menggantikan check-in. */
export async function konfirmasiPerjalanan(izinId: string, userId: string) {
  const izin = await prisma.izinSantri.findUnique({ where: { id: izinId }, include: { santri: { select: { id: true, userId: true, keberadaan: true } } } })
  if (!izin) throw new Error("Izin tidak ditemukan")
  if (!izin.checkoutAt) throw new Error("Belum check-out")
  if (izin.checkinAt) throw new Error("Izin sudah selesai")
  const boleh = izin.santri.userId === userId || Boolean(izin.waliApprovedBy === userId) || Boolean(izin.musyrifApprovedBy === userId) || Boolean(izin.adminApprovedBy === userId)
  if (!boleh) throw new Error("Hanya santri/wali/petugas izin yang dapat konfirmasi")

  const hasil = await prisma.$transaction(async (tx) => {
    const upd = await tx.izinSantri.updateMany({ where: { id: izinId, checkoutAt: { not: null }, checkinAt: null, perjalananConfirmedAt: null }, data: { perjalananConfirmedAt: new Date() } })
    if (upd.count === 0) throw new Error("Konfirmasi perjalanan sudah tercatat")
    const keberadaanBaru: StatusKehadiranSantri = izin.jenis === "PULANG_RUMAH" ? "DI_RUMAH" : "KEGIATAN_LUAR"
    await tx.santri.update({ where: { id: izin.santri.id }, data: { keberadaan: keberadaanBaru } })
    await tx.santriStatusLog.create({ data: { santriId: izin.santri.id, jenis: "KEBERADAAN", dari: izin.santri.keberadaan, ke: keberadaanBaru, alasan: "Konfirmasi tiba di tujuan", verifiedBy: userId } })
    return tx.izinSantri.findUnique({ where: { id: izinId } })!
  })
  await createAuditLog({ userId, action: "IZIN_KONFIRMASI_PERJALANAN", entity: "IzinSantri", entityId: izinId, detail: {} })
  return hasil
}

// ─── STATUS OTOMATIS: KEDALUWARSA / TERLAMBAT ─────────────────────────

/** Lazy cron: tandai KEDALUWARSA (belum keluar) & TERLAMBAT_KEMBALI (sudah keluar). Idempoten. */
export async function perbaruiIzinTerlambat(): Promise<{ kedaluwarsa: number; terlambat: number }> {
  const now = new Date()
  let kedaluwarsa = 0
  let terlambat = 0

  const lewat = await prisma.izinSantri.findMany({
    where: { status: "DISETUJUI", rencanaKembali: { lt: now } },
    select: { id: true, checkoutAt: true, terlambatNotifiedAt: true, santriId: true, santri: { select: { keberadaan: true, userId: true, nama: true } }, jenis: true, suratNomor: true },
  })

  for (const izin of lewat) {
    if (!izin.checkoutAt) {
      // disetujui tapi tidak pernah keluar → kedaluwarsa
      const r = await prisma.$transaction(async (tx) => {
        const u = await tx.izinSantri.updateMany({ where: { id: izin.id, status: "DISETUJUI", checkoutAt: null }, data: { status: "KEDALUWARSA" } })
        if (u.count === 0) return false
        await tx.izinApprovalLog.create({ data: { izinId: izin.id, tahap: "SISTEM", keputusan: "KEDALUWARSA", catatan: "Melewati batas waktu tanpa check-out" } })
        return true
      })
      if (r) {
        kedaluwarsa++
        await createAuditLog({ userId: izin.santri.userId, action: "IZIN_KEDALUWARSA", entity: "IzinSantri", entityId: izin.id, detail: {} })
        void kirimNotifikasi([{ userId: izin.santri.userId, label: "santri", link: "/santri/izin" }], { judul: "Izin Kedaluwarsa", pesan: `Izin ${JENIS_IZIN_LABEL[izin.jenis]} ${izin.santri.nama} KEDALUWARSA — tidak ada check-out sebelum batas waktu.`, tipe: "INFO", eventKey: `izin-kedaluwarsa:${izin.id}` })
      }
    } else {
      // sudah keluar tapi belum check-in → terlambat kembali
      const r = await prisma.$transaction(async (tx) => {
        const u = await tx.izinSantri.updateMany({ where: { id: izin.id, status: "DISETUJUI", checkoutAt: { not: null }, checkinAt: null }, data: { terlambatNotifiedAt: new Date() } })
        if (u.count === 0) return false
        if (izin.santri.keberadaan !== "TERLAMBAT_KEMBALI") {
          await tx.santri.update({ where: { id: izin.santriId }, data: { keberadaan: "TERLAMBAT_KEMBALI" } })
          await tx.santriStatusLog.create({ data: { santriId: izin.santriId, jenis: "KEBERADAAN", dari: izin.santri.keberadaan, ke: "TERLAMBAT_KEMBALI", alasan: `Melewati batas kembali izin ${izin.suratNomor ?? izin.id}` } })
        }
        await tx.izinApprovalLog.create({ data: { izinId: izin.id, tahap: "SISTEM", keputusan: "TERLAMBAT_KEMBALI", catatan: "Melewati batas kembali tanpa check-in" } })
        return true
      })
      if (r) {
        terlambat++
        await createAuditLog({ userId: izin.santri.userId, action: "IZIN_TERLAMBAT_KEMBALI", entity: "IzinSantri", entityId: izin.id, detail: {} })
        void kirimNotifikasi(
          [
            { userId: izin.santri.userId, label: "santri", link: "/santri/izin" },
            ...(await penerimaWali(izin.santriId)),
          ],
          { judul: "Santri Terlambat Kembali", pesan: `${izin.santri.nama} melewati batas kembali izin (${izin.suratNomor ?? ""}) dan belum check-in. Status: TERLAMBAT KEMBALI.`, tipe: "ABSENSI", eventKey: `izin-terlambat:${izin.id}` }
        )
      }
    }
  }
  return { kedaluwarsa, terlambat }
}

// ─── NOTIFIKASI (fire-and-forget, dipanggil setelah transaksi) ────────

async function notifikasiDiajukan(izinId: string, namaSantri: string, jenis: JenisIzin) {
  const izin = await prisma.izinSantri.findUnique({ where: { id: izinId }, select: { status: true, santriId: true } })
  if (!izin) return
  const penerima: PenerimaNotifikasi[] = []
  penerima.push(...(await penerimaWali(izin.santriId)))
  const santri = await prisma.santri.findUnique({ where: { id: izin.santriId }, select: { asrama: { select: { musyrif: { select: { userId: true } } } } } })
  if (santri?.asrama?.musyrif) penerima.push({ userId: santri.asrama.musyrif.userId, label: "musyrif", link: "/guru/izin-musyrif" })
  const adminUsers = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true }, take: 5 })
  penerima.push(...adminUsers.map((u) => ({ userId: u.id, label: "admin", link: "/admin/izin" })))
  await kirimNotifikasi(penerima, {
    judul: "Pengajuan Izin Baru",
    pesan: `${namaSantri} mengajukan ${JENIS_IZIN_LABEL[jenis]}. Status: ${STATUS_IZIN_LABEL[izin.status]}.`,
    tipe: "INFO",
    eventKey: `izin-diajukan:${izinId}`,
  })
}

async function notifikasiKeputusan(izin: { id: string; jenis: JenisIzin; status: StatusIzinSantri; santriId: string; alasanKeputusan: string | null }, tahap: string, keputusan: "DISETUJUI" | "DITOLAK", catatan?: string) {
  const santri = await prisma.santri.findUnique({ where: { id: izin.santriId }, select: { nama: true, keberadaan: true, userId: true } })
  if (!santri) return
  const penerima: PenerimaNotifikasi[] = [{ userId: santri.userId, label: "santri", link: "/santri/izin" }, ...(await penerimaWali(izin.santriId))]
  if (keputusan === "DISETUJUI") {
    const tahapLabel = tahap === "WALI" ? "Wali" : tahap === "MUSYRIF" ? "Musyrif" : "Admin Pondok"
    await kirimNotifikasi(penerima, {
      judul: `Izin ${keputusan === "DISETUJUI" ? "Disetujui" : "Ditolak"} — Tahap ${tahapLabel}`,
      pesan: `Izin ${JENIS_IZIN_LABEL[izin.jenis]} ${santri.nama} telah DISETUJUI oleh ${tahapLabel}.${izin.status === "DISETUJUI" ? " Surat izin digital sudah diterbitkan. Santri masih tercatat berada di pondok sampai proses keluar dikonfirmasi petugas." : ` Status: ${STATUS_IZIN_LABEL[izin.status]}.`}`,
      tipe: "INFO",
      eventKey: `izin-keputusan-${tahap}:${izin.id}`,
    })
  } else {
    await kirimNotifikasi(penerima, {
      judul: "Izin Ditolak",
      pesan: `Izin ${JENIS_IZIN_LABEL[izin.jenis]} ${santri.nama} DITOLAK pada tahap ${tahap}. Alasan: ${catatan ?? izin.alasanKeputusan ?? "-"}.`,
      tipe: "INFO",
      eventKey: `izin-tolak-${tahap}:${izin.id}`,
    })
  }
}

async function notifikasiCheckout(izin: { id: string; jenis: JenisIzin; suratNomor: string | null; santriId: string; checkoutAt: Date | null }) {
  if (!izin.checkoutAt) return
  const santri = await prisma.santri.findUnique({ where: { id: izin.santriId }, select: { nama: true, userId: true } })
  if (!santri) return
  const jam = izin.checkoutAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  await kirimNotifikasi(
    [
      { userId: santri.userId, label: "santri", link: "/santri/izin" },
      ...(await penerimaWali(izin.santriId)),
    ],
    { judul: "Santri Check-Out", pesan: `${santri.nama} telah CHECK-OUT dari pondok pada pukul ${jam} WIB (surat ${izin.suratNomor ?? "-"}).`, tipe: "ABSENSI", eventKey: `izin-checkout:${izin.id}` }
  )
}

async function notifikasiCheckin(izin: { id: string; suratNomor: string | null; santriId: string; checkinAt: Date | null }) {
  if (!izin.checkinAt) return
  const santri = await prisma.santri.findUnique({ where: { id: izin.santriId }, select: { nama: true, userId: true } })
  if (!santri) return
  const jam = izin.checkinAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  await kirimNotifikasi(
    [
      { userId: santri.userId, label: "santri", link: "/santri/izin" },
      ...(await penerimaWali(izin.santriId)),
    ],
    { judul: "Santri Check-In", pesan: `${santri.nama} telah CHECK-IN kembali ke pondok pada pukul ${jam} WIB. Status kembali: DI PONDOK.`, tipe: "ABSENSI", eventKey: `izin-checkin:${izin.id}` }
  )
}

// ─── QUERY UNTUK DASHBOARD ────────────────────────────────────────────

export async function getIzinSaya(userId: string) {
  const santri = await getSantriByUserId(userId)
  if (!santri) throw new Error("Akun ini tidak terdaftar sebagai santri")
  await perbaruiIzinTerlambat()
  const rows = await prisma.izinSantri.findMany({
    where: { santriId: santri.id },
    orderBy: { createdAt: "desc" },
    include: { lampiran: { select: { id: true, filename: true } } },
  })
  return { santri, rows }
}

export async function getIzinUntukWali(waliId: string) {
  await perbaruiIzinTerlambat()
  const relasi = await prisma.santriWali.findMany({ where: { waliId }, select: { santriId: true, santri: { select: { id: true, nama: true, nisNo: true } } } })
  const santriIds = relasi.map((r) => r.santriId)
  if (santriIds.length === 0) return []
  return prisma.izinSantri.findMany({ where: { santriId: { in: santriIds } }, orderBy: { createdAt: "desc" }, include: { santri: { select: { nama: true, nisNo: true } } } })
}

export async function getIzinMenunggu(tahap: "MUSYRIF" | "ADMIN") {
  await perbaruiIzinTerlambat()
  const status = tahap === "MUSYRIF" ? "MENUNGGU_MUSYRIF" : "MENUNGGU_ADMIN"
  return prisma.izinSantri.findMany({
    where: { status },
    orderBy: [{ rencanaKeluar: "asc" }],
    include: { santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } } },
  })
}

export async function getRiwayatIzin(filters?: { santriId?: string; asramaId?: string; dari?: Date; sampai?: Date; page?: number; limit?: number }) {
  const page = filters?.page ?? 1
  const limit = filters?.limit ?? 20
  const where: Record<string, unknown> = {}
  if (filters?.santriId) where.santriId = filters.santriId
  if (filters?.asramaId) where.santri = { asramaId: filters.asramaId }
  if (filters?.dari || filters?.sampai) {
    where.createdAt = {}
    if (filters.dari) (where.createdAt as Record<string, unknown>).gte = filters.dari
    if (filters.sampai) (where.createdAt as Record<string, unknown>).lte = filters.sampai
  }
  const [data, total] = await Promise.all([
    prisma.izinSantri.findMany({ where: where as never, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } } } } } }),
    prisma.izinSantri.count({ where: where as never }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getStatistikIzin() {
  await perbaruiIzinTerlambat()
  const [totalSantri, diPondok, izinAktif, menunggu, sedangPulang, terlambat] = await Promise.all([
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "DI_PONDOK" } }),
    prisma.izinSantri.count({ where: { status: "DISETUJUI" } }),
    prisma.izinSantri.count({ where: { status: { in: STATUS_MENUNGGU } } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR", "DI_RUMAH", "DALAM_PERJALANAN", "KEGIATAN_LUAR"] } } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "TERLAMBAT_KEMBALI" } }),
  ])
  return { totalSantri, diPondok, izinAktif, menunggu, sedangPulang, terlambat }
}

// ─── VERIFIKASI QR (publik, data minimal) ─────────────────────────────

export async function verifikasiTokenIzin(token: string) {
  if (!token || token.length < 16) throw new Error("Token tidak valid")
  await perbaruiIzinTerlambat()
  const izin = await prisma.izinSantri.findUnique({
    where: { suratToken: token },
    select: {
      id: true, status: true, suratNomor: true, suratExpiresAt: true, checkoutAt: true, checkinAt: true,
      jenis: true, rencanaKembali: true,
      santri: { select: { nama: true, nisNo: true } },
    },
  })
  if (!izin) throw new Error("Token tidak ditemukan")
  const kedaluwarsa = Boolean(izin.suratExpiresAt && izin.suratExpiresAt.getTime() < Date.now())
  const valid = !kedaluwarsa && ["DISETUJUI", "SELESAI"].includes(izin.status)
  return {
    valid,
    kedaluwarsa,
    suratNomor: izin.suratNomor,
    jenis: JENIS_IZIN_LABEL[izin.jenis],
    namaSantri: izin.santri.nama,
    nisNo: izin.santri.nisNo,
    status: STATUS_IZIN_LABEL[izin.status],
    sudahCheckout: Boolean(izin.checkoutAt),
    sudahCheckin: Boolean(izin.checkinAt),
    berlakuSampai: izin.suratExpiresAt,
  }
}

// ─── INTEGRASI ABSENSI: dasar status izin + deteksi konflik ───────────

/** Izin disetujui yang menutupi tanggal tertentu untuk siswa (basis status IZIN). Tidak menimpa absensi aktual. */
export async function izinAktifUntukTanggal(siswaId: string, tanggal: Date): Promise<{ id: string; jenis: JenisIzin; status: StatusIzinSantri } | null> {
  const santri = await prisma.santri.findFirst({ where: { siswaId, deletedAt: null }, select: { id: true } })
  if (!santri) return null
  const mulai = new Date(tanggal); mulai.setHours(0, 0, 0, 0)
  const akhir = new Date(tanggal); akhir.setHours(23, 59, 59, 999)
  const izin = await prisma.izinSantri.findFirst({
    where: { santriId: santri.id, status: { in: ["DISETUJUI", "SELESAI"] }, rencanaKeluar: { lte: akhir }, rencanaKembali: { gte: mulai } },
    select: { id: true, jenis: true, status: true },
  })
  return izin
}

/** Deteksi konflik: siswa tercatat HADIR padahal sedang checkout izin di tanggal itu. Idempoten. */
export async function cekDanCatatKonflikAbsensi(params: { siswaId: string; tanggal: Date; statusHadir: boolean; absensiSiswaId?: string }): Promise<boolean> {
  if (!params.statusHadir) return false
  const santri = await prisma.santri.findFirst({ where: { siswaId: params.siswaId, deletedAt: null }, select: { id: true } })
  if (!santri) return false
  const mulai = new Date(params.tanggal); mulai.setHours(0, 0, 0, 0)
  const akhir = new Date(params.tanggal); akhir.setHours(23, 59, 59, 999)
  const izin = await prisma.izinSantri.findFirst({
    where: { santriId: santri.id, status: "DISETUJUI", checkoutAt: { not: null }, checkinAt: null, rencanaKeluar: { lte: akhir }, rencanaKembali: { gte: mulai } },
    select: { id: true },
  })
  if (!izin) return false
  const ada = await prisma.izinKonflikAbsensi.findFirst({ where: { izinId: izin.id, siswaId: params.siswaId, tanggal: mulai, resolvedAt: null } })
  if (ada) return true
  await prisma.izinKonflikAbsensi.create({
    data: { izinId: izin.id, siswaId: params.siswaId, absensiSiswaId: params.absensiSiswaId ?? null, tanggal: mulai, catatan: "Siswa tercatat HADIR pada absensi padahal sedang dalam masa izin keluar pondok — perlu pemeriksaan." },
  })
  return true
}
