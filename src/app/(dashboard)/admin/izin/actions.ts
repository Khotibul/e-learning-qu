"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  setujuiIzin, tolakIzin, getIzinMenunggu, getRiwayatIzin, getStatistikIzin,
  requireAdminIzin, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL, type PengaturanIzin,
} from "@/lib/izin-santri"
import { createAuditLog } from "@/lib/audit"
import type { JenisIzin } from "@prisma/client"

export async function getAntreanAdmin() {
  await requireAdminIzin()
  const rows = await getIzinMenunggu("ADMIN")
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function setujuiIzinAdminAction(izinId: string, catatan?: string) {
  const userId = await requireAdminIzin()
  const hasil = await setujuiIzin(izinId, "ADMIN", userId, catatan)
  revalidatePath("/admin/izin")
  return hasil
}

export async function tolakIzinAdminAction(izinId: string, alasan: string) {
  const userId = await requireAdminIzin()
  const hasil = await tolakIzin(izinId, "ADMIN", userId, alasan)
  revalidatePath("/admin/izin")
  return hasil
}

export async function getStatistikAdmin() {
  await requireAdminIzin()
  return { ...(await getStatistikIzin()), statusLabel: STATUS_IZIN_LABEL }
}

export async function getRiwayatAdmin(filters?: { santriId?: string; asramaId?: string; status?: string; page?: number }) {
  await requireAdminIzin()
  const base = await getRiwayatIzin({ santriId: filters?.santriId, asramaId: filters?.asramaId, page: filters?.page ?? 1, limit: 20 })
  let rows = base.data
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status)
  return { ...base, data: rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

// ─── PENGATURAN PERSETUJUAN PER JENIS ──────────────────────────────────

export async function getPengaturanIzin() {
  await requireAdminIzin()
  const rows = await prisma.izinPengaturan.findMany({ orderBy: { jenis: "asc" } })
  const semua: JenisIzin[] = Object.keys(JENIS_IZIN_LABEL) as JenisIzin[]
  const map = new Map(rows.map((r) => [r.jenis, r]))
  return semua.map((j) => map.get(j) ?? { jenis: j, butuhWali: true, butuhMusyrif: true, butuhAdmin: true, aktif: true })
}

export async function simpanPengaturanIzinAction(jenis: JenisIzin, cfg: Omit<PengaturanIzin, "aktif"> & { aktif: boolean }) {
  const userId = await requireAdminIzin()
  if (!(jenis in JENIS_IZIN_LABEL)) throw new Error("Jenis izin tidak dikenal")
  const row = await prisma.izinPengaturan.upsert({
    where: { jenis },
    create: { jenis, ...cfg },
    update: { ...cfg },
  })
  await createAuditLog({ userId, action: "UBAH_PENGATURAN_IZIN", entity: "IzinPengaturan", entityId: row.id, detail: { jenis, ...cfg } })
  revalidatePath("/admin/izin")
  return row
}

// ─── ASRAMA & KAMAR (fondasi SISANTRI) + PENEMPATAN SANTRI ────────────

export async function getAsramaOpts() {
  await requireAdminIzin()
  return prisma.asrama.findMany({
    where: { aktif: true },
    include: { musyrif: { select: { id: true, nama: true } }, kamars: { select: { id: true, nama: true, kapasitas: true } } },
    orderBy: { nama: "asc" },
  })
}

export async function createAsramaAction(data: { nama: string; deskripsi?: string; musyrifId?: string | null }) {
  const userId = await requireAdminIzin()
  const nama = String(data.nama || "").trim()
  if (nama.length < 2) throw new Error("Nama asrama minimal 2 karakter")
  const row = await prisma.asrama.create({ data: { nama, deskripsi: data.deskripsi || null, musyrifId: data.musyrifId || null } })
  await createAuditLog({ userId, action: "BUAT_ASRAMA", entity: "Asrama", entityId: row.id, detail: { nama } })
  revalidatePath("/admin/izin")
  return row
}

export async function createKamarAction(asramaId: string, data: { nama: string; kapasitas?: number | null }) {
  const userId = await requireAdminIzin()
  const nama = String(data.nama || "").trim()
  if (nama.length < 1) throw new Error("Nama kamar wajib diisi")
  const row = await prisma.kamar.create({ data: { asramaId, nama, kapasitas: data.kapasitas || null } })
  await createAuditLog({ userId, action: "BUAT_KAMAR", entity: "Kamar", entityId: row.id, detail: { asramaId, nama } })
  revalidatePath("/admin/izin")
  return row
}

export async function assignSantriTempatAction(santriId: string, asramaId: string | null, kamarId: string | null) {
  const userId = await requireAdminIzin()
  if (asramaId) {
    const asrama = await prisma.asrama.findUnique({ where: { id: asramaId }, select: { id: true } })
    if (!asrama) throw new Error("Asrama tidak ditemukan")
  }
  if (kamarId) {
    const kamar = await prisma.kamar.findUnique({ where: { id: kamarId }, select: { id: true, asramaId: true } })
    if (!kamar) throw new Error("Kamar tidak ditemukan")
    if (asramaId && kamar.asramaId !== asramaId) throw new Error("Kamar bukan milik asrama tersebut")
  }
  const upd = await prisma.santri.update({ where: { id: santriId }, data: { asramaId, kamarId } })
  await createAuditLog({ userId, action: "TEMPATKAN_SANTRI", entity: "Santri", entityId: santriId, detail: { asramaId, kamarId } })
  revalidatePath("/admin/izin")
  return upd
}

// ─── KONFLIK ABSENSI vs IZIN ───────────────────────────────────────────

export async function getKonflikAbsensiAction() {
  await requireAdminIzin()
  const rows = await prisma.izinKonflikAbsensi.findMany({
    where: { resolvedAt: null },
    include: { izin: { select: { suratNomor: true, jenis: true, rencanaKembali: true }, }, siswa: { select: { id: true, nama: true, nis: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return { rows, jenisLabel: JENIS_IZIN_LABEL }
}

export async function resolveKonflikAbsensiAction(konflikId: string) {
  const userId = await requireAdminIzin()
  const upd = await prisma.izinKonflikAbsensi.updateMany({ where: { id: konflikId, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedBy: userId } })
  if (upd.count === 0) throw new Error("Konflik sudah pernah diselesaikan")
  await createAuditLog({ userId, action: "SELESAIKAN_KONFLIK_IZIN_ABSENSI", entity: "IzinKonflikAbsensi", entityId: konflikId, detail: {} })
  return { success: true }
}
