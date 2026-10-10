"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  setujuiIzin, tolakIzin, getIzinMenunggu, getRiwayatIzin, getStatistikIzin,
  requireMusyrif, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL,
} from "@/lib/izin-santri"

export async function getAntreanMusyrif() {
  await requireMusyrif()
  const rows = await getIzinMenunggu("MUSYRIF")
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function getMonitoringPondokAction() {
  await requireMusyrif()
  const [statistik, diPondok, sedangIzin, terlambat] = await Promise.all([
    getStatistikIzin(),
    prisma.santri.findMany({ where: { status: "AKTIF", deletedAt: null, keberadaan: "DI_PONDOK" }, select: { id: true, nama: true, nisNo: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } }, orderBy: { nama: "asc" }, take: 100 }),
    prisma.santri.findMany({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR", "DI_RUMAH", "DALAM_PERJALANAN", "KEGIATAN_LUAR"] } }, select: { id: true, nama: true, nisNo: true, keberadaan: true, asrama: { select: { nama: true } }, izins: { where: { status: "DISETUJUI" }, select: { id: true, rencanaKembali: true, suratNomor: true, jenis: true }, take: 1 } }, orderBy: { nama: "asc" } }),
    prisma.santri.findMany({ where: { status: "AKTIF", deletedAt: null, keberadaan: "TERLAMBAT_KEMBALI" }, select: { id: true, nama: true, nisNo: true, asrama: { select: { nama: true } }, izins: { where: { status: "DISETUJUI" }, select: { id: true, rencanaKembali: true, suratNomor: true }, take: 1 } } }),
  ])
  return { statistik, diPondok, sedangIzin, terlambat, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function setujuiIzinMusyrifAction(izinId: string, catatan?: string) {
  const { userId } = await requireMusyrif()
  return setujuiIzin(izinId, "MUSYRIF", userId, catatan)
}

export async function tolakIzinMusyrifAction(izinId: string, alasan: string) {
  const { userId } = await requireMusyrif()
  return tolakIzin(izinId, "MUSYRIF", userId, alasan)
}

export async function getRiwayatMusyrif(filters?: { page?: number }) {
  await requireMusyrif()
  return getRiwayatIzin({ page: filters?.page ?? 1, limit: 20 })
}
