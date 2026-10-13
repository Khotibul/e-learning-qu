"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePemilikDompet, requireWaliKeuangan, waliBerhakAtasSantri } from "@/lib/keuangan/guard"
import { getOrCreateDompet, cekLimitHarian, verifikasiKonsistensiSaldo } from "@/lib/keuangan/wallet"
import { rateLimit } from "@/lib/rate-limit"

// ─── SERVER ACTION: DOMPET SISWA/SANTRI ──────────────────────────────

export async function getDompetSaya() {
  const userId = await requirePemilikDompet()
  const dompet = await getOrCreateDompet(userId)
  const limit = await cekLimitHarian(dompet.id)
  const konsistensi = await verifikasiKonsistensiSaldo(dompet.id)
  const riwayat = await prisma.walletLedger.findMany({
    where: { accountId: dompet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, tipe: true, jumlah: true, saldoSesudah: true, deskripsi: true, createdAt: true, refType: true },
  })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, siswa: { select: { nama: true } }, santri: { select: { nama: true } } } })
  return {
    dompet: { ...dompet, nama: user?.santri?.nama ?? user?.siswa?.nama ?? user?.name ?? "-" },
    limitHarian: { sisa: limit.sisa, ok: limit.ok },
    konsistensiSaldo: konsistensi.konsisten,
    riwayat,
  }
}

export async function getRiwayatTransaksiKantinSaya() {
  const userId = await requirePemilikDompet()
  const dompet = await prisma.walletAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!dompet) return []
  return prisma.kantinTransaksi.findMany({
    where: { accountId: dompet.id, status: { not: "DIBATALKAN" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { item: { select: { namaSnapshot: true, qty: true, subtotal: true } }, outlet: { select: { nama: true } } },
  })
}

export async function getTagihanSaya() {
  const userId = await requirePemilikDompet()
  return prisma.invoiceTagihan.findMany({
    where: { userId, status: { not: "DIBATALKAN" } },
    include: { jenis: { select: { kode: true, nama: true, unit: true } } },
    orderBy: [{ status: "asc" }, { jatuhTempo: "asc" }],
  })
}

// ─── AKSI WALI: ISI SALDO ANAK ───────────────────────────────────────

export async function getAnakUntukWali() {
  const waliId = await requireWaliKeuangan()
  const relasi = await prisma.santriWali.findMany({
    where: { waliId, santri: { deletedAt: null } },
    include: { santri: { select: { id: true, nama: true, userId: true, status: true } } },
  })
  const anakList = []
  for (const r of relasi) {
    const dompet = await prisma.walletAccount.findUnique({ where: { userId: r.santri.userId }, select: { id: true, nomor: true, saldo: true, status: true } })
    anakList.push({
      santriId: r.santri.id,
      nama: r.santri.nama,
      status: r.santri.status,
      userId: r.santri.userId,
      dompet: dompet ? { id: dompet.id, nomor: dompet.nomor, saldo: dompet.saldo, status: dompet.status } : null,
    })
  }
  return anakList
}

export async function ajukanTopupWali(params: { santriId: string; jumlah: number; metode: "TRANSFER_BANK" | "QRIS" | "VIRTUAL_ACCOUNT"; idempotencyKey: string; buktiUrl?: string }) {
  const rl = rateLimit(`topup-wali-${params.santriId}`, 10, 60000)
  if (!rl.success) throw new Error("Terlalu banyak permintaan top-up — coba lagi nanti")
  const waliId = await requireWaliKeuangan()
  const { buatTopupWali } = await import("@/lib/keuangan/topup")
  const hasil = await buatTopupWali({
    waliId,
    santriId: params.santriId,
    jumlah: params.jumlah,
    metode: params.metode,
    idempotencyKey: params.idempotencyKey,
    buktiUrl: params.buktiUrl ?? null,
  })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal mengajukan top-up")
  revalidatePath("/wali-santri/dompet")
  return hasil
}

export async function getRiwayatTopupWali() {
  const waliId = await requireWaliKeuangan()
  return prisma.topupRequest.findMany({
    where: { waliId },
    include: { account: { select: { nomor: true, user: { select: { santri: { select: { nama: true } } } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function setLimitDompetAnak(params: { santriId: string; limitHarian?: number | null; limitPerTransaksi?: number | null }) {
  const waliId = await requireWaliKeuangan()
  if (!(await waliBerhakAtasSantri(waliId, params.santriId))) throw new Error("Bukan anak Anda")
  const santri = await prisma.santri.findUnique({ where: { id: params.santriId }, select: { userId: true } })
  if (!santri) throw new Error("Santri tidak ditemukan")
  // Wali hanya boleh menetapkan limit LEBIH KETAT dari default; nilai negatif = tanpa batas
  const data: Record<string, unknown> = {}
  if (params.limitHarian !== undefined) data.limitHarian = params.limitHarian && params.limitHarian > 0 ? params.limitHarian : null
  if (params.limitPerTransaksi !== undefined) data.limitPerTransaksi = params.limitPerTransaksi && params.limitPerTransaksi > 0 ? params.limitPerTransaksi : null
  const dompet = await getOrCreateDompet(santri.userId)
  await prisma.walletAccount.update({ where: { id: dompet.id }, data: data as never })
  revalidatePath("/wali-santri/dompet")
  return { ok: true }
}

export async function bayarTagihanAnak(params: { invoiceId: string; jumlah: number; metode: "EWALLET" | "TUNAI"; idempotencyKey: string; santriId: string }) {
  const waliId = await requireWaliKeuangan()
  if (!(await waliBerhakAtasSantri(waliId, params.santriId))) throw new Error("Bukan anak Anda")
  const santri = await prisma.santri.findUnique({ where: { id: params.santriId }, select: { userId: true } })
  if (!santri) throw new Error("Santri tidak ditemukan")
  // Pastikan invoice milik anak ini
  const inv = await prisma.invoiceTagihan.findUnique({ where: { id: params.invoiceId }, select: { userId: true } })
  if (!inv || inv.userId !== santri.userId) throw new Error("Invoice bukan milik anak ini")
  const { bayarInvoice } = await import("@/lib/keuangan/billing")
  const dompet = await getOrCreateDompet(santri.userId)
  const hasil = await bayarInvoice({
    invoiceId: params.invoiceId,
    jumlah: params.jumlah,
    metode: params.metode,
    idempotencyKey: params.idempotencyKey,
    actorUserId: waliId,
    accountId: params.metode === "EWALLET" ? dompet.id : null,
  })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal membayar")
  revalidatePath("/wali-santri/dompet")
  return hasil
}

// ─── ADMIN/BENDAHARA: VERIFIKASI TOP-UP ──────────────────────────────

export async function getAntreanTopup() {
  await auth() // session required
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return prisma.topupRequest.findMany({
    where: { status: { in: ["MENUNGGU", "DIPROSES"] } },
    include: { account: { select: { nomor: true, user: { select: { santri: { select: { nama: true } }, siswa: { select: { nama: true } } } } } }, wali: { select: { nama: true } } },
    orderBy: { createdAt: "asc" },
  })
}

export async function verifikasiTopupAction(params: { topupId: string; setujui: boolean; catatan?: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") {
    // boleh juga bendahara via KeuanganStaff
    const asg = await prisma.keuanganStaff.findFirst({ where: { userId: session.user.id, peran: "BENDAHARA", aktif: true }, select: { id: true } })
    if (!asg) throw new Error("Hanya admin/bendahara yang dapat memverifikasi top-up")
  }
  const { verifikasiTopup } = await import("@/lib/keuangan/topup")
  const hasil = await verifikasiTopup({ topupId: params.topupId, verifiedBy: session.user.id, setujui: params.setujui, catatan: params.catatan })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal memverifikasi")
  revalidatePath("/bendahara")
  return hasil
}
