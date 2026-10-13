import { prisma } from "@/lib/prisma"
import { debitDompet } from "./wallet"
import { jurnalPenjualanEWallet, jurnalPenjualanTunai, jurnalRefundEWallet } from "./jurnal"
import { createAuditLog } from "@/lib/audit"
import { kirimNotifikasi } from "@/lib/notifikasi"
import { penerimaWaliUntukSantri } from "./topup"

// ─── E-KANTIN / POS CASHLESS ─────────────────────────────────────────
// Alur cashless: kasir pilih produk → backend cek stok+saldo+limit →
// debit dompet atomik (idempotency) → kurangi stok atomik → struk → jurnal.
// Stok tidak boleh negatif (dicek via updateMany gte). Tunai: tanpa debit
// dompet, hanya stok + jurnal kas.

export type ItemKeranjang = { produkId: string; qty: number }

export type HasilCheckout = {
  ok: boolean
  transaksiId?: string
  nomorStruk?: string
  total?: number
  saldoSesudah?: number
  error?: string
  sudahDiproses?: boolean
}

export async function nomorStrukBaru(): Promise<string> {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const prefix = `STR-${ymd}-`
  const last = await prisma.kantinTransaksi.findFirst({ where: { nomorStruk: { startsWith: prefix } }, orderBy: { nomorStruk: "desc" }, select: { nomorStruk: true } })
  const seq = last?.nomorStruk ? parseInt(last.nomorStruk.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

/**
 * Checkout POS. Atomik: stok + (debit dompet bila EWALLET) + transaksi + item.
 * idempotencyKey mencegah double bayar (kasir klik dobel / retry jaringan).
 */
export async function checkoutKantin(params: {
  outletId: string
  kasirUserId: string
  shiftId?: string | null
  items: ItemKeranjang[]
  metode: "EWALLET" | "TUNAI"
  accountId?: string | null // dompet siswa (wajib bila EWALLET)
  diskon?: number
  idempotencyKey: string
}): Promise<HasilCheckout> {
  const { outletId, kasirUserId, items, metode, accountId, idempotencyKey } = params
  if (!items.length) return { ok: false, error: "Keranjang kosong" }
  for (const it of items) {
    if (!Number.isInteger(it.qty) || it.qty <= 0) return { ok: false, error: "Qty tidak valid" }
  }
  if (metode === "EWALLET" && !accountId) return { ok: false, error: "Dompet siswa wajib untuk pembayaran e-wallet" }

  // Cek idempoten dulu (luar tx agar cepat)
  const existing = await prisma.kantinTransaksi.findUnique({ where: { nomorStruk: idempotencyKey }, select: { id: true, nomorStruk: true, total: true } })
  if (existing) return { ok: true, sudahDiproses: true, transaksiId: existing.id, nomorStruk: existing.nomorStruk, total: existing.total }

  // Load produk + validasi outlet
  const produkIds = [...new Set(items.map((i) => i.produkId))]
  const produkRows = await prisma.kantinProduk.findMany({
    where: { id: { in: produkIds }, outletId, aktif: true },
    select: { id: true, nama: true, hargaJual: true, hargaModal: true, stok: true },
  })
  if (produkRows.length !== produkIds.length) return { ok: false, error: "Produk tidak ditemukan / tidak aktif" }
  const byId = new Map(produkRows.map((p) => [p.id, p]))

  let subtotal = 0
  let hppTotal = 0
  for (const it of items) {
    const p = byId.get(it.produkId)!
    if (p.stok < it.qty) return { ok: false, error: `Stok ${p.nama} tidak cukup (tersisa ${p.stok})` }
    subtotal += p.hargaJual * it.qty
    hppTotal += p.hargaModal * it.qty
  }
  const diskon = Math.max(0, params.diskon ?? 0)
  const total = subtotal - diskon
  if (total <= 0) return { ok: false, error: "Total tidak valid" }

  // Debit dompet dulu (atomik, dengan cek saldo + limit) sebelum kurangi stok
  let saldoSesudah: number | undefined
  if (metode === "EWALLET" && accountId) {
    const debit = await debitDompet({
      accountId,
      jumlah: total,
      idempotencyKey: `kantin-debit:${idempotencyKey}`,
      deskripsi: `Pembelian kantin ${total}`,
      refType: "KantinTransaksi",
      // Transaksi belum dibuat saat debit; kaitkan lewat idempotencyKey (nomorStruk).
      refId: null,
      actorUserId: kasirUserId,
      tipe: "PEMBAYARAN_KANTIN",
    })
    if (!debit.ok) return { ok: false, error: debit.error }
    saldoSesudah = debit.saldoSesudah
  }

  // Buat transaksi + kurangi stok atomik
  try {
    const hasil = await prisma.$transaction(async (tx) => {
      // Kurangi stok dengan syarat stok >= qty (mencegah negatif + race)
      for (const it of items) {
        const p = byId.get(it.produkId)!
        const upd = await tx.kantinProduk.updateMany({
          where: { id: it.produkId, stok: { gte: it.qty } },
          data: { stok: { decrement: it.qty } },
        })
        if (upd.count === 0) throw new Error(`Stok ${p.nama} berubah — kurangi/tinjau keranjang`)
        await tx.kantinPenyesuaianStok.create({
          data: { produkId: it.produkId, delta: -it.qty, alasan: `Penjualan struk ${idempotencyKey}`, refType: "KantinTransaksi", actorUserId: kasirUserId },
        })
      }
      // idempotencyKey dipakai sekaligus sebagai nomorStruk unik (@unique).
      const trx = await tx.kantinTransaksi.create({
        data: {
          nomorStruk: idempotencyKey,
          outletId,
          shiftId: params.shiftId ?? null,
          kasirUserId,
          accountId: metode === "EWALLET" ? accountId : null,
          metode,
          subtotal,
          diskon,
          total,
          hppTotal,
          status: "SELESAI",
          item: {
            create: items.map((it) => {
              const p = byId.get(it.produkId)!
              return {
                produkId: it.produkId,
                namaSnapshot: p.nama,
                hargaSnapshot: p.hargaJual,
                modalSnapshot: p.hargaModal,
                qty: it.qty,
                subtotal: p.hargaJual * it.qty,
              }
            }),
          },
        },
        select: { id: true, nomorStruk: true, total: true },
      })
      return trx
    })

    await createAuditLog({ userId: kasirUserId, action: "KANTIN_TRANSAKSI", entity: "KantinTransaksi", entityId: hasil.id, detail: { total, metode, items: items.length } })

    // Jurnal (setelah transaksi final)
    if (metode === "EWALLET") {
      await jurnalPenjualanEWallet({ total, hpp: hppTotal, refId: hasil.id, createdBy: kasirUserId, keterangan: `Penjualan ${hasil.nomorStruk}` })
    } else {
      await jurnalPenjualanTunai({ total, hpp: hppTotal, refId: hasil.id, createdBy: kasirUserId, keterangan: `Penjualan ${hasil.nomorStruk}` })
    }

    // Notifikasi wali+pemilik dompet (e-wallet saja, setelah final)
    if (metode === "EWALLET" && accountId) {
      const akun = await prisma.walletAccount.findUnique({ where: { id: accountId }, select: { userId: true } })
      if (akun) {
        const list: { userId: string; label: string; link?: string }[] = [{ userId: akun.userId, label: "pemilik-dompet", link: "/siswa/dompet" }]
        const santri = await prisma.santri.findFirst({ where: { userId: akun.userId, deletedAt: null }, select: { id: true } })
        if (santri) list.push(...(await penerimaWaliUntukSantri(santri.id)))
        void kirimNotifikasi(list, {
          judul: "Pembelian Kantin",
          pesan: `Pembelian di kantin sebesar Rp${total.toLocaleString("id-ID")}. Saldo tersisa Rp${(saldoSesudah ?? 0).toLocaleString("id-ID")}.`,
          tipe: "INFO",
          link: "/siswa/dompet",
          eventKey: `kantin:${hasil.id}`,
        })
      }
    }

    return { ok: true, transaksiId: hasil.id, nomorStruk: hasil.nomorStruk, total: hasil.total, saldoSesudah }
  } catch (e) {
    // Bila debit dompet sudah terjadi tapi pembuatan transaksi/stok gagal →
    // kredit balik secara otomatis (kompensasi) agar saldo tidak menggantung.
    if (metode === "EWALLET" && accountId) {
      const { kreditDompet } = await import("./wallet")
      await kreditDompet({
        accountId,
        jumlah: total,
        idempotencyKey: `kantin-kompensasi:${idempotencyKey}`,
        tipe: "KOREKSI",
        deskripsi: "Kompensasi transaksi kantin gagal (saldo dikembalikan)",
        refType: "KantinTransaksi",
        actorUserId: kasirUserId,
      }).catch(() => null)
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Batalkan transaksi (hanya SELESAI). Kredit balik dompet + stok kembali + jurnal balik. */
export async function batalTransaksiKantin(params: {
  transaksiId: string
  actorUserId: string
  alasan: string
}): Promise<{ ok: boolean; error?: string }> {
  const trx = await prisma.kantinTransaksi.findUnique({
    where: { id: params.transaksiId },
    include: { item: true },
  })
  if (!trx) return { ok: false, error: "Transaksi tidak ditemukan" }
  if (trx.status !== "SELESAI") return { ok: false, error: "Hanya transaksi SELESAI yang dapat dibatalkan" }
  if (String(params.alasan).trim().length < 5) return { ok: false, error: "Alasan minimal 5 karakter" }

  await prisma.$transaction(async (tx) => {
    await tx.kantinTransaksi.update({
      where: { id: trx.id },
      data: { status: "DIBATALKAN", alasanBatal: params.alasan, batalBy: params.actorUserId, batalPada: new Date() },
    })
    // Kembalikan stok
    for (const it of trx.item) {
      await tx.kantinProduk.update({ where: { id: it.produkId }, data: { stok: { increment: it.qty } } })
      await tx.kantinPenyesuaianStok.create({
        data: { produkId: it.produkId, delta: it.qty, alasan: `Pembatalan struk ${trx.nomorStruk}`, refType: "KantinTransaksi", refId: trx.id, actorUserId: params.actorUserId },
      })
    }
  })

  // Kredit balik dompet bila EWALLET
  if (trx.metode === "EWALLET" && trx.accountId) {
    const { kreditDompet } = await import("./wallet")
    await kreditDompet({
      accountId: trx.accountId,
      jumlah: trx.total,
      idempotencyKey: `kantin-batal:${trx.id}`,
      tipe: "REFUND_KANTIN",
      deskripsi: `Pembatalan struk ${trx.nomorStruk}`,
      refType: "KantinTransaksi",
      refId: trx.id,
      actorUserId: params.actorUserId,
    })
    await jurnalRefundEWallet({ jumlah: trx.total, refId: trx.id, createdBy: params.actorUserId, keterangan: `Batal ${trx.nomorStruk}` })
  } else {
    // Tunai: jurnal kas keluar (balik pendapatan)
    const { postingJurnal } = await import("./jurnal")
    await postingJurnal({
      keterangan: `Batal tunai ${trx.nomorStruk}`,
      refType: "KantinTransaksi",
      refId: trx.id,
      createdBy: params.actorUserId,
      items: [
        { kode: "PENDAPATAN_KANTIN", debit: trx.total },
        { kode: "KAS", kredit: trx.total },
      ],
    })
  }
  await createAuditLog({ userId: params.actorUserId, action: "KANTIN_BATAL", entity: "KantinTransaksi", entityId: trx.id, detail: { alasan: params.alasan } })
  return { ok: true }
}

/** Refund sebagian ke dompet (produk tetap / retur tanpa kembalikan stok). */
export async function refundKantin(params: {
  transaksiId: string
  jumlah: number
  alasan: string
  keDompet: boolean
  actorUserId: string
}): Promise<{ ok: boolean; error?: string; refundId?: string }> {
  const trx = await prisma.kantinTransaksi.findUnique({ where: { id: params.transaksiId }, select: { id: true, total: true, status: true, accountId: true, nomorStruk: true } })
  if (!trx) return { ok: false, error: "Transaksi tidak ditemukan" }
  if (trx.status !== "SELESAI") return { ok: false, error: "Hanya transaksi SELESAI yang dapat di-refund" }
  if (!Number.isInteger(params.jumlah) || params.jumlah <= 0 || params.jumlah > trx.total) return { ok: false, error: "Jumlah refund tidak valid" }
  if (params.keDompet && !trx.accountId) return { ok: false, error: "Transaksi bukan e-wallet" }

  if (params.keDompet && trx.accountId) {
    const { kreditDompet } = await import("./wallet")
    const kredit = await kreditDompet({
      accountId: trx.accountId,
      jumlah: params.jumlah,
      idempotencyKey: `kantin-refund:${trx.id}:${params.jumlah}`,
      tipe: "REFUND_KANTIN",
      deskripsi: `Refund struk ${trx.nomorStruk}`,
      refType: "KantinTransaksi",
      refId: trx.id,
      actorUserId: params.actorUserId,
    })
    if (!kredit.ok) return { ok: false, error: kredit.error }
    if (kredit.sudahDiproses) {
      // Refund key sama sudah pernah diproses → no-op sukses tanpa baris baru
      const existing = await prisma.kantinRefund.findFirst({ where: { transaksiId: trx.id, jumlah: params.jumlah, keDompet: true }, select: { id: true } })
      return { ok: true, refundId: existing?.id }
    }
  }

  const refund = await prisma.kantinRefund.create({
    data: {
      transaksiId: trx.id,
      jumlah: params.jumlah,
      alasan: params.alasan,
      keDompet: params.keDompet,
      actorUserId: params.actorUserId,
    },
    select: { id: true },
  })
  if (params.keDompet) {
    await jurnalRefundEWallet({ jumlah: params.jumlah, refId: refund.id, createdBy: params.actorUserId, keterangan: `Refund ${trx.nomorStruk}` })
  }
  await createAuditLog({ userId: params.actorUserId, action: "KANTIN_REFUND", entity: "KantinRefund", entityId: refund.id, detail: { jumlah: params.jumlah, transaksiId: trx.id } })
  return { ok: true, refundId: refund.id }
}

/** Buka shift kasir (idempoten: hanya 1 shift AKTIF per kasir+outlet). */
export async function bukaShift(params: { outletId: string; kasirUserId: string; saldoAwal: number }): Promise<{ ok: boolean; shiftId?: string; error?: string }> {
  const aktif = await prisma.kantinShift.findFirst({ where: { outletId: params.outletId, kasirUserId: params.kasirUserId, status: "AKTIF" }, select: { id: true } })
  if (aktif) return { ok: true, shiftId: aktif.id }
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const jumlahHariIni = await prisma.kantinShift.count({ where: { outletId: params.outletId, dibukaPada: { gte: hariIni } } })
  const shift = await prisma.kantinShift.create({
    data: { outletId: params.outletId, kasirUserId: params.kasirUserId, nomorShift: jumlahHariIni + 1, saldoAwal: Math.max(0, params.saldoAwal), status: "AKTIF" },
    select: { id: true },
  })
  return { ok: true, shiftId: shift.id }
}

/** Tutup shift + hitung kas. */
export async function tutupShift(params: { shiftId: string; kasirUserId: string; kasAkhir: number; catatan?: string }): Promise<{ ok: boolean; selisih?: number; error?: string }> {
  const shift = await prisma.kantinShift.findUnique({ where: { id: params.shiftId }, select: { id: true, status: true, kasirUserId: true, saldoAwal: true } })
  if (!shift) return { ok: false, error: "Shift tidak ditemukan" }
  if (shift.status !== "AKTIF") return { ok: false, error: "Shift sudah ditutup" }
  if (shift.kasirUserId !== params.kasirUserId) return { ok: false, error: "Shift bukan milik Anda" }

  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const agg = await prisma.kantinTransaksi.aggregate({
    where: { shiftId: params.shiftId, metode: "TUNAI", status: "SELESAI", createdAt: { gte: hariIni } },
    _sum: { total: true },
  })
  const kasHarusnya = shift.saldoAwal + (agg._sum.total ?? 0)
  const selisih = params.kasAkhir - kasHarusnya
  await prisma.kantinShift.update({
    where: { id: params.shiftId },
    data: { status: "TUTUP", ditutupPada: new Date(), kasAkhir: params.kasAkhir, kasHarusnya, selisih, catatanTutup: params.catatan ?? null },
  })
  await createAuditLog({ userId: params.kasirUserId, action: "KANTIN_SHIFT_TUTUP", entity: "KantinShift", entityId: params.shiftId, detail: { kasHarusnya, kasAkhir: params.kasAkhir, selisih } })
  return { ok: true, selisih }
}
