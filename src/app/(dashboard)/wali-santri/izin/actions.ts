"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setujuiIzin, tolakIzin, getIzinUntukWali, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL } from "@/lib/izin-santri"

export async function getIzinAnakAction() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const wali = await prisma.waliSantri.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { id: true, nama: true, hubungan: true } })
  if (!wali) throw new Error("Akun ini tidak terdaftar sebagai wali santri")
  const rows = await getIzinUntukWali(wali.id)
  return { wali, rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function setujuiIzinWaliAction(izinId: string, catatan?: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const wali = await prisma.waliSantri.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { id: true } })
  if (!wali) throw new Error("Akun ini tidak terdaftar sebagai wali santri")
  // pastikan izin milik anak wali ini
  const rel = await prisma.santriWali.findFirst({
    where: { waliId: wali.id, santri: { izins: { some: { id: izinId } } } },
    select: { id: true },
  })
  if (!rel) throw new Error("Izin ini bukan milik anak yang Anda wali")
  return setujuiIzin(izinId, "WALI", session.user.id, catatan)
}

export async function tolakIzinWaliAction(izinId: string, alasan: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const wali = await prisma.waliSantri.findFirst({ where: { userId: session.user.id, deletedAt: null }, select: { id: true } })
  if (!wali) throw new Error("Akun ini tidak terdaftar sebagai wali santri")
  const rel = await prisma.santriWali.findFirst({
    where: { waliId: wali.id, santri: { izins: { some: { id: izinId } } } },
    select: { id: true },
  })
  if (!rel) throw new Error("Izin ini bukan milik anak yang Anda wali")
  return tolakIzin(izinId, "WALI", session.user.id, alasan)
}
