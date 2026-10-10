"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  checkoutIzin, checkinIzin, verifikasiTokenIzin, requireGerbang, perbaruiIzinTerlambat,
  STATUS_IZIN_LABEL, JENIS_IZIN_LABEL, KEBERADAAN_LABEL,
} from "@/lib/izin-santri"

export async function cariIzinAktifAction(query: string) {
  await requireGerbang()
  await perbaruiIzinTerlambat()
  const q = String(query || "").trim()
  if (q.length < 2) throw new Error("Minimal 2 karakter")
  const rows = await prisma.izinSantri.findMany({
    where: {
      status: { in: ["DISETUJUI", "SELESAI"] },
      OR: [
        { suratToken: q },
        { suratNomor: q },
        { santri: { OR: [{ nisNo: { contains: q, mode: "insensitive" } }, { nama: { contains: q, mode: "insensitive" } }] } },
      ],
    },
    include: {
      santri: { select: { id: true, nama: true, nisNo: true, keberadaan: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL, keberadaanLabel: KEBERADAAN_LABEL }
}

export async function verifikasiQRIzinAction(token: string) {
  await requireGerbang()
  return verifikasiTokenIzin(String(token || "").trim())
}

export async function checkoutAction(params: { izinId?: string; token?: string }, verifikasiPenjemput?: boolean) {
  const actorUserId = await requireGerbang()
  const hasil = await checkoutIzin(params, actorUserId, { verifikasiPenjemput })
  return { ...hasil, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function checkinAction(izinId: string) {
  const actorUserId = await requireGerbang()
  const hasil = await checkinIzin(izinId, actorUserId)
  return { ...hasil, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function getRiwayatGerbangAction(params?: { santriId?: string }) {
  await requireGerbang()
  const where: Record<string, unknown> = { checkoutAt: { not: null } }
  if (params?.santriId) where.santriId = params.santriId
  const rows = await prisma.izinSantri.findMany({
    where: where as never,
    include: { santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } } } } },
    orderBy: [{ checkoutAt: "desc" }, { checkinAt: "desc" }],
    take: 50,
  })
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function getProfilGerbang() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return { userId: session.user.id }
}
