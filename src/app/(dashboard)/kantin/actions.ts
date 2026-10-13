"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePetugasKeuangan } from "@/lib/keuangan/guard"
import { checkoutKantin, batalTransaksiKantin, refundKantin, bukaShift, tutupShift, nomorStrukBaru } from "@/lib/keuangan/kantin"
import { rateLimit } from "@/lib/rate-limit"

// ─── SERVER ACTION: KANTIN / POS KASIR ───────────────────────────────

async function guardKasir(outletId?: string) {
  // Kasir harus punya penugasan di outlet tsb (atau admin)
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role === "ADMIN") return { userId: session.user.id, outletId: outletId ?? null }
  const asg = await prisma.keuanganStaff.findFirst({
    where: { userId: session.user.id, peran: "KASIR", aktif: true, ...(outletId ? { OR: [{ outletId }, { outletId: null }] } : {}) },
    select: { outletId: true },
  })
  if (!asg) throw new Error("Anda bukan kasir yang ditugaskan")
  return { userId: session.user.id, outletId: asg.outletId }
}

export async function getOutletKasir() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role === "ADMIN") return prisma.kantinOutlet.findMany({ where: { aktif: true }, select: { id: true, nama: true, kode: true, lokasi: true } })
  const asg = await prisma.keuanganStaff.findMany({ where: { userId: session.user.id, peran: "KASIR", aktif: true }, select: { outletId: true } })
  const outletIds = asg.map((a) => a.outletId).filter((x): x is string => Boolean(x))
  if (!outletIds.length) return []
  return prisma.kantinOutlet.findMany({ where: { id: { in: outletIds }, aktif: true }, select: { id: true, nama: true, kode: true, lokasi: true } })
}

export async function getProdukOutlet(outletId: string) {
  await guardKasir(outletId)
  return prisma.kantinProduk.findMany({
    where: { outletId, aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, sku: true, hargaJual: true, stok: true, satuan: true, aktif: true, kategori: { select: { nama: true } } },
  })
}

export async function getShiftAktifKasir(outletId: string) {
  const { userId } = await guardKasir(outletId)
  return prisma.kantinShift.findFirst({ where: { outletId, kasirUserId: userId, status: "AKTIF" }, select: { id: true, nomorShift: true, saldoAwal: true } })
}

export async function bukaShiftAction(params: { outletId: string; saldoAwal: number }) {
  const { userId } = await guardKasir(params.outletId)
  const hasil = await bukaShift({ outletId: params.outletId, kasirUserId: userId, saldoAwal: params.saldoAwal })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal membuka shift")
  revalidatePath("/kantin")
  return hasil
}

export async function tutupShiftAction(params: { shiftId: string; kasAkhir: number; catatan?: string }) {
  const shift = await prisma.kantinShift.findUnique({ where: { id: params.shiftId }, select: { outletId: true } })
  if (!shift) throw new Error("Shift tidak ditemukan")
  const { userId } = await guardKasir(shift.outletId)
  const hasil = await tutupShift({ shiftId: params.shiftId, kasirUserId: userId, kasAkhir: params.kasAkhir, catatan: params.catatan })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal menutup shift")
  revalidatePath("/kantin")
  return hasil
}

/** Cari dompet siswa (untuk pembayaran e-wallet) — kasir scan/ketik NIS/nama. */
export async function cariSiswaUntukBayar(q: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const rl = rateLimit(`cari-siswa-${session.user.id}`, 30, 60000)
  if (!rl.success) throw new Error("Terlalu banyak pencarian")
  const siswa = await prisma.siswa.findMany({
    where: { deletedAt: null, OR: [{ nama: { contains: q, mode: "insensitive" } }, { nis: { contains: q } }] },
    take: 10,
    select: { id: true, nama: true, nis: true, userId: true },
  })
  const hasil = []
  for (const s of siswa) {
    const dompet = await prisma.walletAccount.findUnique({ where: { userId: s.userId }, select: { id: true, nomor: true, saldo: true, status: true } })
    hasil.push({ siswaId: s.id, nama: s.nama, nis: s.nis, userId: s.userId, dompet: dompet ? { id: dompet.id, nomor: dompet.nomor, saldo: dompet.saldo, status: dompet.status } : null })
  }
  return hasil
}

export async function checkoutAction(params: {
  outletId: string
  shiftId?: string | null
  items: { produkId: string; qty: number }[]
  metode: "EWALLET" | "TUNAI"
  accountId?: string | null
  diskon?: number
}) {
  const { userId } = await guardKasir(params.outletId)
  const rl = rateLimit(`checkout-${userId}`, 30, 60000)
  if (!rl.success) throw new Error("Terlalu banyak transaksi — jeda sebentar")
  const idempotencyKey = await nomorStrukBaru()
  const hasil = await checkoutKantin({
    outletId: params.outletId,
    kasirUserId: userId,
    shiftId: params.shiftId ?? null,
    items: params.items,
    metode: params.metode,
    accountId: params.accountId ?? null,
    diskon: params.diskon ?? 0,
    idempotencyKey,
  })
  if (!hasil.ok) throw new Error(hasil.error ?? "Checkout gagal")
  revalidatePath("/kantin")
  return hasil
}

export async function batalTransaksiAction(params: { transaksiId: string; alasan: string }) {
  const trx = await prisma.kantinTransaksi.findUnique({ where: { id: params.transaksiId }, select: { outletId: true } })
  if (!trx) throw new Error("Transaksi tidak ditemukan")
  const { userId } = await guardKasir(trx.outletId)
  const hasil = await batalTransaksiKantin({ transaksiId: params.transaksiId, actorUserId: userId, alasan: params.alasan })
  if (!hasil.ok) throw new Error(hasil.error ?? "Gagal membatalkan")
  revalidatePath("/kantin")
  return hasil
}

export async function getRiwayatShift(shiftId: string) {
  const shift = await prisma.kantinShift.findUnique({ where: { id: shiftId }, select: { outletId: true } })
  if (!shift) throw new Error("Shift tidak ditemukan")
  await guardKasir(shift.outletId)
  return prisma.kantinTransaksi.findMany({
    where: { shiftId, status: { not: "DIBATALKAN" } },
    include: { item: { select: { namaSnapshot: true, qty: true, subtotal: true } } },
    orderBy: { createdAt: "desc" },
  })
}

// ─── ADMIN/PENGAWAS: MANAJEMEN PRODUK & OUTLET ──────────────────────

export async function kelolaProdukAction(params: {
  outletId: string
  produkId?: string // bila ada = update
  nama: string
  sku?: string
  hargaJual: number
  hargaModal?: number
  stok?: number
  stokMin?: number
  satuan?: string
  kategoriNama?: string
  aktif?: boolean
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  const asg = user?.role === "ADMIN" ? true : await prisma.keuanganStaff.findFirst({ where: { userId: session.user.id, peran: { in: ["KASIR", "BENDAHARA"] }, aktif: true }, select: { id: true } })
  if (!asg) throw new Error("Tidak memiliki akses kelola produk")

  let kategoriId: string | null = null
  if (params.kategoriNama) {
    const kat = await prisma.kantinKategori.upsert({
      where: { outletId_nama: { outletId: params.outletId, nama: params.kategoriNama } },
      create: { outletId: params.outletId, nama: params.kategoriNama },
      update: {},
      select: { id: true },
    })
    kategoriId = kat.id
  }

  if (params.produkId) {
    await prisma.kantinProduk.update({
      where: { id: params.produkId },
      data: {
        nama: params.nama,
        sku: params.sku ?? null,
        hargaJual: params.hargaJual,
        hargaModal: params.hargaModal ?? 0,
        ...(params.stok !== undefined ? { stok: params.stok } : {}),
        stokMin: params.stokMin ?? 0,
        satuan: params.satuan ?? "porsi",
        kategoriId,
        aktif: params.aktif ?? true,
      },
    })
  } else {
    await prisma.kantinProduk.create({
      data: {
        outletId: params.outletId,
        kategoriId,
        nama: params.nama,
        sku: params.sku ?? null,
        hargaJual: params.hargaJual,
        hargaModal: params.hargaModal ?? 0,
        stok: params.stok ?? 0,
        stokMin: params.stokMin ?? 0,
        satuan: params.satuan ?? "porsi",
      },
    })
  }
  revalidatePath("/kantin")
  return { ok: true }
}

export async function restockProdukAction(params: { produkId: string; delta: number; alasan: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  if (!Number.isInteger(params.delta)) throw new Error("Delta harus bilangan bulat")
  const produk = await prisma.kantinProduk.findUnique({ where: { id: params.produkId }, select: { outletId: true } })
  if (!produk) throw new Error("Produk tidak ditemukan")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") {
    const asg = await prisma.keuanganStaff.findFirst({ where: { userId: session.user.id, peran: { in: ["KASIR", "BENDAHARA"] }, aktif: true }, select: { id: true } })
    if (!asg) throw new Error("Tidak memiliki akses restock")
  }
  if (params.delta < 0) {
    const upd = await prisma.kantinProduk.updateMany({ where: { id: params.produkId, stok: { gte: -params.delta } }, data: { stok: { increment: params.delta } } })
    if (upd.count === 0) throw new Error("Stok tidak mencukupi untuk dikurangi")
  } else {
    await prisma.kantinProduk.update({ where: { id: params.produkId }, data: { stok: { increment: params.delta } } })
  }
  await prisma.kantinPenyesuaianStok.create({
    data: { produkId: params.produkId, delta: params.delta, alasan: params.alasan, refType: "Restock", actorUserId: session.user.id },
  })
  revalidatePath("/kantin")
  return { ok: true }
}
