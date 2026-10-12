"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePondok, requirePondokSantri, santriIdsDalamScope, getPondokAccess } from "@/lib/pondok-rbac"
import {
  getIzinMenunggu, setujuiIzin, tolakIzin, perbaruiIzinTerlambat,
  STATUS_IZIN_LABEL, JENIS_IZIN_LABEL, KEBERADAAN_LABEL,
} from "@/lib/izin-santri"
import { createAuditLog } from "@/lib/audit"
import type { StatusAbsensi } from "@prisma/client"

// ─── PENGURUS PONDOK — server actions ──────────────────────────────────
// Semua query santri dibatasi scope penugasan (default deny di luar scope).

type ScopeCtx = { userId: string; semua: boolean; ids: string[] }

async function scopeCtx(permission: "pondok.santri.view" | "pondok.izin.view" | "pondok.absensi.create" | "pondok.pembinaan.manage" | "pondok.kegiatan.manage" | "pondok.laporan.view"): Promise<ScopeCtx> {
  const userId = await requirePondok(permission)
  const s = await santriIdsDalamScope(userId)
  if (s === "SEMUA") return { userId, semua: true, ids: [] }
  return { userId, semua: false, ids: s }
}

function scopeWhere(ctx: ScopeCtx) {
  return ctx.semua ? {} : { santriId: { in: ctx.ids } }
}

export async function getDashboardPengurus() {
  await requirePondok("pondok.dashboard.view")
  await perbaruiIzinTerlambat()
  const ctx = await scopeCtx("pondok.santri.view")
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)

  const santriWhere = ctx.semua ? { status: "AKTIF" as const, deletedAt: null } : { id: { in: ctx.ids }, status: "AKTIF" as const, deletedAt: null }

  const [tanggungJawab, diPondok, sedangPulang, terlambat, izinMenunggu, izinAktif, kegiatanHariIni, absensiTerisiHariIni] = await Promise.all([
    prisma.santri.count({ where: santriWhere }),
    prisma.santri.count({ where: { ...santriWhere, keberadaan: "DI_PONDOK" } }),
    prisma.santri.count({ where: { ...santriWhere, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR", "DI_RUMAH", "DALAM_PERJALANAN"] } } }),
    prisma.santri.count({ where: { ...santriWhere, keberadaan: "TERLAMBAT_KEMBALI" } }),
    prisma.izinSantri.count({ where: { status: "MENUNGGU_PENGURUS", ...scopeWhere(ctx) } }),
    prisma.izinSantri.count({ where: { status: "DISETUJUI", checkoutAt: null, ...scopeWhere(ctx) } }),
    prisma.kegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
    prisma.absensiKegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
  ])

  return {
    tanggungJawab, diPondok, sedangPulang, terlambat,
    izinMenunggu, izinAktif,
    kegiatanHariIni,
    absensiBelumLengkap: Math.max(kegiatanHariIni - absensiTerisiHariIni, 0),
    scopeSemua: ctx.semua,
  }
}

export async function getSantriBinaan(search?: string) {
  const ctx = await scopeCtx("pondok.santri.view")
  const rows = await prisma.santri.findMany({
    where: {
      deletedAt: null, status: "AKTIF",
      ...(ctx.semua ? {} : { id: { in: ctx.ids } }),
      ...(search ? { nama: { contains: search, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, nama: true, nisNo: true, keberadaan: true, status: true,
      asrama: { select: { nama: true } }, kamar: { select: { nama: true } },
      halaqah: { select: { nama: true } }, kelasDiniyah: { select: { nama: true } },
    },
    orderBy: { nama: "asc" },
    take: 200,
  })
  return { rows, keberadaanLabel: KEBERADAAN_LABEL, scopeSemua: ctx.semua }
}

// ─── PERIZINAN PENGURUS ────────────────────────────────────────────────

export async function getAntreanIzinPengurus() {
  await requirePondok("pondok.izin.view")
  const ctx = await scopeCtx("pondok.izin.view")
  const semua = await getIzinMenunggu("PENGURUS")
  const rows = ctx.semua ? semua : semua.filter((i) => ctx.ids.includes(i.santriId))
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

/** Validasi kelengkapan = lolos tahap Pengurus. Butuh pondok.izin.recommend. */
export async function setujuiIzinPengurusAction(izinId: string, catatan?: string) {
  const userId = await requirePondok("pondok.izin.recommend")
  const hasil = await setujuiIzin(izinId, "PENGURUS", userId, catatan)
  revalidatePath("/pengurus")
  return hasil
}

export async function tolakIzinPengurusAction(izinId: string, alasan: string) {
  const userId = await requirePondok("pondok.izin.reject")
  const hasil = await tolakIzin(izinId, "PENGURUS", userId, alasan)
  revalidatePath("/pengurus")
  return hasil
}

export async function getIzinPulangPengurus() {
  await requirePondok("pondok.izin.view")
  const ctx = await scopeCtx("pondok.izin.view")
  const rows = await prisma.izinSantri.findMany({
    where: { status: "DISETUJUI", checkoutAt: { not: null }, checkinAt: null, ...scopeWhere(ctx) },
    orderBy: { rencanaKembali: "asc" },
    include: { santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } } } } },
    take: 100,
  })
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

// ─── KEGIATAN PONDOK ───────────────────────────────────────────────────

export async function getKegiatanPengurus(filters?: { tanggal?: string }) {
  await requirePondok("pondok.kegiatan.manage")
  const tanggal = filters?.tanggal ? new Date(filters.tanggal) : undefined
  const rows = await prisma.kegiatanPondok.findMany({
    where: tanggal ? { tanggal } : {},
    orderBy: [{ tanggal: "desc" }],
    take: 100,
    include: { penanggungJawab: { select: { name: true } }, _count: { select: { absensi: true } } },
  })
  return rows.map((k) => ({ id: k.id, nama: k.nama, tipe: k.tipe, tanggal: k.tanggal.toISOString(), jamMulai: k.jamMulai, jamSelesai: k.jamSelesai, lokasi: k.lokasi, deskripsi: k.deskripsi, wajib: k.wajib, penanggungJawab: k.penanggungJawab?.name ?? null, jumlahAbsensi: k._count.absensi }))
}

export async function createKegiatanAction(data: { nama: string; tipe?: string; tanggal: string; jamMulai?: string; jamSelesai?: string; lokasi?: string; deskripsi?: string; wajib?: boolean }) {
  const userId = await requirePondok("pondok.kegiatan.manage")
  if (String(data.nama || "").trim().length < 3) throw new Error("Nama kegiatan minimal 3 karakter")
  const tanggal = new Date(data.tanggal)
  if (isNaN(tanggal.getTime())) throw new Error("Tanggal kegiatan tidak valid")
  tanggal.setHours(0, 0, 0, 0)
  const row = await prisma.kegiatanPondok.create({
    data: {
      nama: String(data.nama).trim(), tipe: data.tipe ?? "HARIAN", tanggal,
      jamMulai: data.jamMulai || null, jamSelesai: data.jamSelesai || null,
      lokasi: data.lokasi || null, deskripsi: data.deskripsi || null, wajib: Boolean(data.wajib),
      penanggungJawabId: userId,
    },
  })
  await createAuditLog({ userId, action: "KEGIATAN_PONDOK_DIBUAT", entity: "KegiatanPondok", entityId: row.id, detail: { nama: row.nama } })
  revalidatePath("/pengurus")
  return row
}

export async function deleteKegiatanAction(id: string) {
  const userId = await requirePondok("pondok.kegiatan.manage")
  const row = await prisma.kegiatanPondok.findUnique({ where: { id }, select: { id: true } })
  if (!row) throw new Error("Kegiatan tidak ditemukan")
  await prisma.kegiatanPondok.delete({ where: { id } })
  await createAuditLog({ userId, action: "KEGIATAN_PONDOK_DIHAPUS", entity: "KegiatanPondok", entityId: id, detail: {} })
  revalidatePath("/pengurus")
  return { success: true }
}

// ─── ABSENSI KEGIATAN ──────────────────────────────────────────────────

export async function getAbsensiKegiatan(kegiatanId: string, tanggal: string) {
  await requirePondok("pondok.absensi.create")
  const ctx = await scopeCtx("pondok.santri.view")
  const tgl = new Date(tanggal); tgl.setHours(0, 0, 0, 0)
  const kegiatan = await prisma.kegiatanPondok.findUnique({ where: { id: kegiatanId }, select: { id: true, nama: true } })
  if (!kegiatan) throw new Error("Kegiatan tidak ditemukan")
  const santri = await prisma.santri.findMany({
    where: { deletedAt: null, status: "AKTIF", ...(ctx.semua ? {} : { id: { in: ctx.ids } }) },
    select: { id: true, nama: true, nisNo: true, keberadaan: true },
    orderBy: { nama: "asc" },
  })
  const absensi = await prisma.absensiKegiatanPondok.findMany({ where: { kegiatanId, tanggal: tgl } })
  const map = new Map(absensi.map((a) => [a.santriId, a]))
  return {
    kegiatan,
    tanggal: tgl.toISOString(),
    rows: santri.map((s) => ({
      santriId: s.id, nama: s.nama, nisNo: s.nisNo, keberadaan: s.keberadaan,
      status: map.get(s.id)?.status ?? null, keterangan: map.get(s.id)?.keterangan ?? null, id: map.get(s.id)?.id ?? null,
    })),
  }
}

export async function simpanAbsensiKegiatanAction(kegiatanId: string, tanggal: string, rows: { santriId: string; status: StatusAbsensi; keterangan?: string }[]) {
  const userId = await requirePondok("pondok.absensi.create")
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Data absensi kosong")
  const tgl = new Date(tanggal); tgl.setHours(0, 0, 0, 0)
  const ctx = await scopeCtx("pondok.absensi.create")

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (!ctx.semua && !ctx.ids.includes(r.santriId)) throw new Error("Santri di luar cakupan penugasan")
      await tx.absensiKegiatanPondok.upsert({
        where: { kegiatanId_tanggal_santriId: { kegiatanId, tanggal: tgl, santriId: r.santriId } },
        create: { kegiatanId, tanggal: tgl, santriId: r.santriId, status: r.status, keterangan: r.keterangan || null, pencatatId: userId },
        update: { status: r.status, keterangan: r.keterangan || null },
      })
    }
  })
  await createAuditLog({ userId, action: "ABSENSI_KEGIATAN_DISIMPAN", entity: "AbsensiKegiatanPondok", entityId: kegiatanId, detail: { jumlah: rows.length, tanggal: tgl.toISOString() } })
  revalidatePath("/pengurus")
  return { success: true, jumlah: rows.length }
}

export async function koreksiAbsensiKegiatanAction(absensiId: string, status: StatusAbsensi, alasan: string) {
  const userId = await requirePondok("pondok.absensi.correct")
  if (String(alasan || "").trim().length < 5) throw new Error("Alasan koreksi minimal 5 karakter")
  const upd = await prisma.absensiKegiatanPondok.update({ where: { id: absensiId }, data: { status, koreksiAlasan: String(alasan).trim(), koreksiBy: userId } })
  await createAuditLog({ userId, action: "ABSENSI_KEGIATAN_DIKOREKSI", entity: "AbsensiKegiatanPondok", entityId: absensiId, detail: { status, alasan } })
  revalidatePath("/pengurus")
  return upd
}

// ─── ASRAMA ────────────────────────────────────────────────────────────

export async function getAsramaPengurus() {
  const ctx = await scopeCtx("pondok.santri.view")
  const asramaIds = ctx.semua ? undefined : [...new Set((await getPondokAccess(ctx.userId)).scopes.map((s) => s.asramaId).filter((x): x is string => Boolean(x)))]
  const rows = await prisma.asrama.findMany({
    where: { aktif: true, ...(asramaIds ? { id: { in: asramaIds } } : {}) },
    orderBy: { nama: "asc" },
    include: {
      kamars: { include: { _count: { select: { santris: true } } }, orderBy: { nama: "asc" } },
      _count: { select: { santris: true } },
      musyrif: { select: { id: true, nama: true } },
    },
  })
  return rows.map((a) => ({
    id: a.id, nama: a.nama, musyrif: a.musyrif?.nama ?? null,
    totalPenghuni: a._count.santris,
    kamars: a.kamars.map((k) => ({ id: k.id, nama: k.nama, kapasitas: k.kapasitas, terisi: k._count.santris })),
  }))
}

export async function mutasiKamarAction(santriId: string, kamarId: string | null) {
  const userId = await requirePondokSantri("pondok.santri.update", santriId)
  let asramaId: string | null = null
  if (kamarId) {
    const kamar = await prisma.kamar.findUnique({ where: { id: kamarId }, select: { id: true, asramaId: true, kapasitas: true, _count: { select: { santris: true } } } })
    if (!kamar) throw new Error("Kamar tidak ditemukan")
    if (kamar.kapasitas && kamar._count.santris >= kamar.kapasitas) throw new Error("Kamar sudah penuh")
    asramaId = kamar.asramaId
  }
  const lama = await prisma.santri.findUnique({ where: { id: santriId }, select: { kamarId: true, asramaId: true } })
  await prisma.santri.update({ where: { id: santriId }, data: { kamarId, asramaId } })
  await createAuditLog({ userId, action: "MUTASI_KAMAR", entity: "Santri", entityId: santriId, detail: { dari: lama?.kamarId, ke: kamarId } })
  revalidatePath("/pengurus")
  return { success: true }
}

// ─── PEMBINAAN ─────────────────────────────────────────────────────────

export async function createPembinaanAction(data: { santriId: string; tipe: string; judul: string; deskripsi?: string; poin?: number; tindakLanjut?: string }) {
  const userId = await requirePondokSantri("pondok.pembinaan.manage", data.santriId)
  const tipe = ["PRESTASI", "PELANGGARAN", "CATATAN", "TINDAK_LANJUT"].includes(data.tipe) ? data.tipe : "CATATAN"
  if (String(data.judul || "").trim().length < 3) throw new Error("Judul minimal 3 karakter")
  const row = await prisma.pembinaanSantri.create({
    data: {
      santriId: data.santriId, tipe, judul: String(data.judul).trim(),
      deskripsi: data.deskripsi || null, poin: data.poin ?? null, tindakLanjut: data.tindakLanjut || null,
      petugasId: userId, status: tipe === "PELANGGARAN" || tipe === "TINDAK_LANJUT" ? "MENUNGGU" : "SELESAI",
    },
  })
  await createAuditLog({ userId, action: "PEMBINAAN_DICATAT", entity: "PembinaanSantri", entityId: row.id, detail: { tipe, judul: row.judul } })
  revalidatePath("/pengurus")
  return row
}

export async function getPembinaanSantriBinaan(santriId: string) {
  await requirePondokSantri("pondok.santri.view", santriId)
  return prisma.pembinaanSantri.findMany({ where: { santriId }, orderBy: { tanggal: "desc" }, include: { petugas: { select: { name: true } } } })
}

// ─── PENGUMUMAN (draft → MENUNGGU, disetujui Kepala Pondok) ────────────

export async function createDraftPengumumanAction(data: { judul: string; isi: string; tipe?: string }) {
  const userId = await requirePondok("pondok.pengumuman.publish")
  if (String(data.judul || "").trim().length < 3) throw new Error("Judul minimal 3 karakter")
  if (String(data.isi || "").trim().length < 5) throw new Error("Isi pengumuman minimal 5 karakter")
  const row = await prisma.pengumuman.create({
    data: { judul: String(data.judul).trim(), isi: String(data.isi).trim(), tipe: data.tipe ?? "UMUM", userId, status: "DRAFT" },
  })
  await createAuditLog({ userId, action: "PENGUMUMAN_DRAFT", entity: "Pengumuman", entityId: row.id, detail: { judul: row.judul } })
  revalidatePath("/pengurus")
  return row
}

export async function kirimPengumumanAction(id: string) {
  const userId = await requirePondok("pondok.pengumuman.publish")
  const upd = await prisma.pengumuman.updateMany({ where: { id, userId, status: "DRAFT", deletedAt: null }, data: { status: "MENUNGGU" } })
  if (upd.count === 0) throw new Error("Hanya draft milik sendiri yang dapat dikirim untuk disetujui")
  await createAuditLog({ userId, action: "PENGUMUMAN_DIKIRIM", entity: "Pengumuman", entityId: id, detail: {} })
  revalidatePath("/pengurus")
  return { success: true }
}

export async function getPengumumanPengurus() {
  await requirePondok("pondok.pengumuman.publish")
  const rows = await prisma.pengumuman.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } })
  return rows.map((r) => ({ id: r.id, judul: r.judul, isi: r.isi, tipe: r.tipe, status: r.status, pembuat: r.user.name, createdAt: r.createdAt.toISOString(), approvedAt: r.approvedAt?.toISOString() ?? null }))
}

// ─── LAPORAN ───────────────────────────────────────────────────────────

export async function getLaporanPengurus() {
  await requirePondok("pondok.laporan.view")
  const ctx = await scopeCtx("pondok.laporan.view")
  const mulaiBulan = new Date(); mulaiBulan.setDate(1); mulaiBulan.setHours(0, 0, 0, 0)
  const santriWhere = ctx.semua ? {} : { santriId: { in: ctx.ids } }
  const [kehadiran, izin, pembinaan] = await Promise.all([
    prisma.absensiKegiatanPondok.groupBy({ by: ["status"], where: { tanggal: { gte: mulaiBulan } }, _count: true }),
    prisma.izinSantri.groupBy({ by: ["status"], where: { createdAt: { gte: mulaiBulan }, ...scopeWhere(ctx) }, _count: true }),
    prisma.pembinaanSantri.groupBy({ by: ["tipe"], where: { tanggal: { gte: mulaiBulan }, ...santriWhere }, _count: true }),
  ])
  return {
    kehadiran: kehadiran.map((k) => ({ status: k.status, jumlah: k._count })),
    izin: izin.map((i) => ({ status: i.status, jumlah: i._count })),
    pembinaan: pembinaan.map((p) => ({ tipe: p.tipe, jumlah: p._count })),
    periodeDari: mulaiBulan.toISOString(),
    scopeSemua: ctx.semua,
  }
}

