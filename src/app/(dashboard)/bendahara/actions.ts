"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePetugasKeuangan } from "@/lib/keuangan/guard"
import { verifikasiTopup } from "@/lib/keuangan/topup"
import { verifikasiPembayaranTagihan, buatInvoice, tandaiJatuhTempo } from "@/lib/keuangan/billing"
import { seedAkunLaporan } from "@/lib/keuangan/jurnal"
import { createAuditLog } from "@/lib/audit"

// ─── SERVER ACTION: BENDAHARA (monitoring + verifikasi) ──────────────

async function guardBendahara() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role === "ADMIN") return session.user.id
  const asg = await prisma.keuanganStaff.findFirst({ where: { userId: session.user.id, peran: { in: ["BENDAHARA", "AUDITOR"] }, aktif: true }, select: { peran: true } })
  if (!asg) throw new Error("Hanya admin/bendahara/auditor")
  return session.user.id
}

export async function getDashboardBendahara() {
  await guardBendahara()
  const [topupMenunggu, tagihanPending, totalSaldo, totalKewajiban, totalPendapatanKantin, totalHpp, transaksiHariIni, invoiceBelumLunas] = await Promise.all([
    prisma.topupRequest.count({ where: { status: "MENUNGGU" } }),
    prisma.pembayaranTagihan.count({ where: { status: "PENDING" } }),
    prisma.walletAccount.aggregate({ _sum: { saldo: true }, _count: true }),
    prisma.akunLaporan.findUnique({ where: { kode: "KEWAJIBAN_DOMPET" }, select: { saldo: true } }),
    prisma.akunLaporan.findUnique({ where: { kode: "PENDAPATAN_KANTIN" }, select: { saldo: true } }),
    prisma.akunLaporan.findUnique({ where: { kode: "HPP" }, select: { saldo: true } }),
    prisma.kantinTransaksi.count({ where: { createdAt: { gte: hariIni() }, status: "SELESAI" } }),
    prisma.invoiceTagihan.count({ where: { status: { in: ["BELUM_DIBAYAR", "SEBAGIAN", "JATUH_TEMPO"] } } }),
  ])
  return {
    topupMenunggu,
    tagihanPending,
    totalSaldoDompet: totalSaldo._sum.saldo ?? 0,
    jumlahDompet: totalSaldo._count,
    kewajibanDompet: totalKewajiban?.saldo ?? 0,
    pendapatanKantin: totalPendapatanKantin?.saldo ?? 0,
    hpp: totalHpp?.saldo ?? 0,
    transaksiHariIni,
    invoiceBelumLunas,
  }
}

function hariIni() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

export async function getAkunLaporan() {
  await guardBendahara()
  return prisma.akunLaporan.findMany({ where: { aktif: true }, orderBy: { kode: "asc" } })
}

export async function getJurnalUmum(take = 50) {
  await guardBendahara()
  return prisma.jurnalUmum.findMany({
    include: { item: { include: { akun: { select: { kode: true, nama: true } } } } },
    orderBy: { tanggal: "desc" },
    take,
  })
}

export async function getAntreanVerifikasi() {
  await guardBendahara()
  const [topups, bayar] = await Promise.all([
    prisma.topupRequest.findMany({
      where: { status: "MENUNGGU" },
      include: { account: { select: { nomor: true, user: { select: { santri: { select: { nama: true } }, siswa: { select: { nama: true } } } } } }, wali: { select: { nama: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pembayaranTagihan.findMany({
      where: { status: "PENDING" },
      include: { invoice: { select: { kode: true, periode: true, jenis: { select: { nama: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ])
  return { topups, pembayaran: bayar }
}

export async function verifikasiTopupBendahara(params: { topupId: string; setujui: boolean; catatan?: string }) {
  const userId = await guardBendahara()
  const hasil = await verifikasiTopup({ topupId: params.topupId, verifiedBy: userId, setujui: params.setujui, catatan: params.catatan })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal")
  revalidatePath("/bendahara")
  return hasil
}

export async function verifikasiPembayaranBendahara(params: { pembayaranId: string; setujui: boolean; catatan?: string }) {
  const userId = await guardBendahara()
  const hasil = await verifikasiPembayaranTagihan({ pembayaranId: params.pembayaranId, verifiedBy: userId, setujui: params.setujui, catatan: params.catatan })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal")
  revalidatePath("/bendahara")
  return hasil
}

export async function buatInvoiceBatch(params: { userIds: string[]; jenisKode: string; periode: string; nominal: number; jatuhTempo?: string }) {
  const userId = await guardBendahara()
  const hasil = []
  for (const uid of params.userIds) {
    const r = await buatInvoice({
      userId: uid,
      jenisKode: params.jenisKode,
      periode: params.periode,
      nominal: params.nominal,
      jatuhTempo: params.jatuhTempo ? new Date(params.jatuhTempo) : undefined,
      createdBy: userId,
    })
    hasil.push(r)
  }
  revalidatePath("/bendahara")
  return { dibuat: hasil.filter((r) => r.ok).length, gagal: hasil.filter((r) => !r.ok).length }
}

export async function seedAkunAction() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") throw new Error("Hanya admin")
  const n = await seedAkunLaporan()
  await createAuditLog({ userId: session.user.id, action: "SEED_AKUN_LAPORAN", entity: "AkunLaporan", detail: { dibuat: n } })
  revalidatePath("/bendahara")
  return { dibuat: n }
}

export async function tandaiJatuhTempoAction() {
  const userId = await guardBendahara()
  const hasil = await tandaiJatuhTempo()
  await createAuditLog({ userId, action: "TANDAI_JATUH_TEMPO", entity: "InvoiceTagihan", detail: hasil })
  revalidatePath("/bendahara")
  return hasil
}

export async function getRekapTagihan(periode?: string) {
  await guardBendahara()
  return prisma.invoiceTagihan.groupBy({
    by: ["status"],
    where: periode ? { periode } : {},
    _count: true,
    _sum: { total: true, terbayar: true, sisa: true },
  })
}

export async function getRiwayatTransaksiKantin(outletId?: string, hariTerakhir = 7) {
  await guardBendahara()
  const sejak = new Date(); sejak.setDate(sejak.getDate() - hariTerakhir)
  return prisma.kantinTransaksi.findMany({
    where: { createdAt: { gte: sejak }, ...(outletId ? { outletId } : {}), status: { not: "DIBATALKAN" } },
    include: { outlet: { select: { nama: true } }, item: { select: { namaSnapshot: true, qty: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}
