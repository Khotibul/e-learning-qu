import { prisma } from "@/lib/prisma"
import { debitDompet } from "./wallet"
import { jurnalBayarTagihanEWallet, jurnalBayarTagihanTunai } from "./jurnal"
import { createAuditLog } from "@/lib/audit"
import { kirimNotifikasi } from "@/lib/notifikasi"

// ─── BILLING SEKOLAH & PONDOK ────────────────────────────────────────
// Pisahkan dari dompet: invoice/tagihan adalah Billing Ledger terpisah.
// Pembayaran via e-wallet MENDEBIT dompet (kewajiban dompet turun) +
// mencatat pendapatan unit — bukan "ambil uang saku otomatis".
// Cicilan didukung: banyak PembayaranTagihan per Invoice, akumulasi terbayar.

export type MetodeBayar = "EWALLET" | "TUNAI" | "TRANSFER_BANK" | "QRIS"

async function nomorInvoiceBaru(periode: string): Promise<string> {
  const ym = periode.replace("-", "")
  const prefix = `INV-${ym}-`
  const last = await prisma.invoiceTagihan.findFirst({ where: { kode: { startsWith: prefix } }, orderBy: { kode: "desc" }, select: { kode: true } })
  const seq = last?.kode ? parseInt(last.kode.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

/** Buat invoice (idempoten per kode; kode di-generate). */
export async function buatInvoice(params: {
  userId: string
  jenisKode: string // SPP | ASRAMA | MAKAN | ...
  periode: string // "2026-10"
  nominal: number
  diskon?: number
  jatuhTempo?: Date
  keterangan?: string
  createdBy?: string
}): Promise<{ ok: boolean; invoiceId?: string; kode?: string; error?: string }> {
  const { userId, jenisKode, periode, nominal } = params
  if (!Number.isInteger(nominal) || nominal <= 0) return { ok: false, error: "Nominal tidak valid" }
  const diskon = Math.max(0, params.diskon ?? 0)
  const jenis = await prisma.jenisTagihan.findUnique({ where: { kode: jenisKode }, select: { id: true, aktif: true, unit: true } })
  if (!jenis || !jenis.aktif) return { ok: false, error: `Jenis tagihan ${jenisKode} tidak aktif` }
  const total = nominal - diskon
  if (total < 0) return { ok: false, error: "Diskon melebihi nominal" }

  const kode = await nomorInvoiceBaru(periode)
  const inv = await prisma.invoiceTagihan.create({
    data: {
      kode,
      userId,
      jenisId: jenis.id,
      periode,
      nominal,
      diskon,
      total,
      sisa: total,
      jatuhTempo: params.jatuhTempo ?? null,
      status: "BELUM_DIBAYAR",
      keterangan: params.keterangan ?? null,
      createdBy: params.createdBy ?? null,
    },
    select: { id: true, kode: true },
  })
  await createAuditLog({ userId: params.createdBy ?? userId, action: "INVOICE_DIBUAT", entity: "InvoiceTagihan", entityId: inv.id, detail: { kode, nominal, periode } })
  return { ok: true, invoiceId: inv.id, kode: inv.kode }
}

/**
 * Bayar invoice (cicilan didukung). Idempoten via idempotencyKey.
 * EWALLET: debit dompet atomik → alokasi → jurnal.
 * TUNAI/TRANSFER/QRIS: catat PENDING (menunggu verifikasi bendahara).
 */
export async function bayarInvoice(params: {
  invoiceId: string
  jumlah: number
  metode: MetodeBayar
  idempotencyKey: string
  actorUserId: string // siswa/wali yang membayar
  accountId?: string | null // dompet (wajib EWALLET)
  buktiUrl?: string | null
}): Promise<{ ok: boolean; pembayaranId?: string; status?: string; error?: string }> {
  const { invoiceId, jumlah, metode, idempotencyKey, actorUserId, accountId } = params
  if (!Number.isInteger(jumlah) || jumlah <= 0) return { ok: false, error: "Nominal tidak valid" }

  // Idempoten
  const existing = await prisma.pembayaranTagihan.findUnique({ where: { idempotencyKey }, select: { id: true, status: true } })
  if (existing) return { ok: true, pembayaranId: existing.id, status: existing.status }

  const inv = await prisma.invoiceTagihan.findUnique({
    where: { id: invoiceId },
    include: { jenis: { select: { unit: true, nama: true } } },
  })
  if (!inv) return { ok: false, error: "Invoice tidak ditemukan" }
  if (inv.status === "LUNAS") return { ok: false, error: "Invoice sudah lunas" }
  if (inv.status === "DIBATALKAN") return { ok: false, error: "Invoice dibatalkan" }
  if (jumlah > inv.sisa) return { ok: false, error: `Melebihi sisa tagihan (Rp${inv.sisa.toLocaleString("id-ID")})` }
  const unit = (inv.jenis.unit ?? "SEKOLAH") === "PONDOK" ? "PONDOK" : "SEKOLAH"

  if (metode === "EWALLET") {
    if (!accountId) return { ok: false, error: "Dompet wajib untuk pembayaran e-wallet" }
    const debit = await debitDompet({
      accountId,
      jumlah,
      idempotencyKey: `tagihan-debit:${idempotencyKey}`,
      deskripsi: `Bayar ${inv.jenis.nama} ${inv.kode}`,
      refType: "InvoiceTagihan",
      refId: invoiceId,
      actorUserId,
      tipe: "BAYAR_TAGIHAN",
    })
    if (!debit.ok) return { ok: false, error: debit.error }

    const bayar = await prisma.$transaction(async (tx) => {
      // Alokasi atomik: update invoice (optimistic: sisa tidak berubah di luar tx)
      const upd = await tx.invoiceTagihan.updateMany({
        where: { id: invoiceId, sisa: inv.sisa, status: { in: ["BELUM_DIBAYAR", "SEBAGIAN", "JATUH_TEMPO"] } },
        data: {
          terbayar: { increment: jumlah },
          sisa: { decrement: jumlah },
          status: jumlah >= inv.sisa ? "LUNAS" : "SEBAGIAN",
        },
      })
      if (upd.count === 0) throw new Error("Tagihan berubah — coba lagi")
      return tx.pembayaranTagihan.create({
        data: {
          invoiceId,
          jumlah,
          metode,
          status: "BERHASIL",
          accountId,
          ledgerId: debit.ledgerId ?? null,
          idempotencyKey,
          actorUserId,
          verifiedBy: actorUserId,
          verifiedAt: new Date(),
        },
        select: { id: true, status: true },
      })
    })

    await createAuditLog({ userId: actorUserId, action: "TAGIHAN_DIBAYAR", entity: "PembayaranTagihan", entityId: bayar.id, detail: { invoiceId, jumlah, metode } })
    await jurnalBayarTagihanEWallet({ jumlah, unit, refId: bayar.id, createdBy: actorUserId, keterangan: `Bayar ${inv.jenis.nama} ${inv.kode}` })
    void kirimNotifikasi([{ userId: inv.userId, label: "pembayar", link: "/siswa/dompet" }], {
      judul: "Pembayaran Tagihan Berhasil",
      pesan: `Pembayaran ${inv.jenis.nama} (${inv.kode}) sebesar Rp${jumlah.toLocaleString("id-ID")} berhasil. Sisa tagihan Rp${(inv.sisa - jumlah).toLocaleString("id-ID")}.`,
      tipe: "INFO",
      eventKey: `tagihan-bayar:${bayar.id}`,
    })
    return { ok: true, pembayaranId: bayar.id, status: bayar.status }
  }

  // Metode non-e-wallet: catat PENDING (perlu verifikasi bendahara)
  const bayar = await prisma.pembayaranTagihan.create({
    data: {
      invoiceId,
      jumlah,
      metode,
      status: "PENDING",
      buktiUrl: params.buktiUrl ?? null,
      idempotencyKey,
      actorUserId,
    },
    select: { id: true, status: true },
  })
  await createAuditLog({ userId: actorUserId, action: "TAGIHAN_DIAJUKAN", entity: "PembayaranTagihan", entityId: bayar.id, detail: { invoiceId, jumlah, metode } })
  return { ok: true, pembayaranId: bayar.id, status: bayar.status }
}

/** Verifikasi pembayaran tunai/transfer (oleh bendahara) → alokasi + jurnal. */
export async function verifikasiPembayaranTagihan(params: {
  pembayaranId: string
  verifiedBy: string
  setujui: boolean
  catatan?: string
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { pembayaranId, verifiedBy, setujui, catatan } = params
  const bayar = await prisma.pembayaranTagihan.findUnique({
    where: { id: pembayaranId },
    include: { invoice: { select: { id: true, sisa: true, kode: true, jenis: { select: { unit: true, nama: true } } } } },
  })
  if (!bayar) return { ok: false, error: "Pembayaran tidak ditemukan" }
  if (bayar.status !== "PENDING") return { ok: false, error: `Status ${bayar.status} tidak dapat diverifikasi` }

  if (!setujui) {
    await prisma.pembayaranTagihan.update({ where: { id: pembayaranId }, data: { status: "DIBATALKAN", verifiedBy, verifiedAt: new Date(), catatan: catatan ?? "Ditolak" } })
    await createAuditLog({ userId: verifiedBy, action: "TAGIHAN_DITOLAK", entity: "PembayaranTagihan", entityId: pembayaranId, detail: { catatan } })
    return { ok: true, status: "DIBATALKAN" }
  }

  const inv = bayar.invoice
  const unit = (inv.jenis.unit ?? "SEKOLAH") === "PONDOK" ? "PONDOK" : "SEKOLAH"
  const hasil = await prisma.$transaction(async (tx) => {
    const upd = await tx.invoiceTagihan.updateMany({
      where: { id: inv.id, sisa: inv.sisa, status: { in: ["BELUM_DIBAYAR", "SEBAGIAN", "JATUH_TEMPO"] } },
      data: {
        terbayar: { increment: bayar.jumlah },
        sisa: { decrement: bayar.jumlah },
        status: bayar.jumlah >= inv.sisa ? "LUNAS" : "SEBAGIAN",
      },
    })
    if (upd.count === 0) throw new Error("Tagihan berubah — coba lagi")
    return tx.pembayaranTagihan.update({
      where: { id: pembayaranId },
      data: { status: "BERHASIL", verifiedBy, verifiedAt: new Date(), catatan: catatan ?? null },
      select: { id: true, status: true },
    })
  })
  await createAuditLog({ userId: verifiedBy, action: "TAGIHAN_DIVERIFIKASI", entity: "PembayaranTagihan", entityId: pembayaranId, detail: { jumlah: bayar.jumlah } })
  if (bayar.metode === "TUNAI") {
    await jurnalBayarTagihanTunai({ jumlah: bayar.jumlah, unit, refId: pembayaranId, createdBy: verifiedBy, keterangan: `Bayar ${inv.jenis.nama} ${inv.kode}` })
  } else {
    await jurnalBayarTagihanEWallet({ jumlah: bayar.jumlah, unit, refId: pembayaranId, createdBy: verifiedBy, keterangan: `Bayar ${inv.jenis.nama} ${inv.kode}` })
  }
  return { ok: true, status: hasil.status }
}

/** Terlambat: tambahkan denda (oleh admin/bendahara). */
export async function tambahDendaInvoice(params: { invoiceId: string; denda: number; actorUserId: string; alasan: string }): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(params.denda) || params.denda < 0) return { ok: false, error: "Denda tidak valid" }
  const inv = await prisma.invoiceTagihan.findUnique({ where: { id: params.invoiceId }, select: { id: true, sisa: true } })
  if (!inv) return { ok: false, error: "Invoice tidak ditemukan" }
  await prisma.invoiceTagihan.update({
    where: { id: params.invoiceId },
    data: { denda: { increment: params.denda }, total: { increment: params.denda }, sisa: { increment: params.denda } },
  })
  await createAuditLog({ userId: params.actorUserId, action: "DENDA_DITAMBAHKAN", entity: "InvoiceTagihan", entityId: params.invoiceId, detail: { denda: params.denda, alasan: params.alasan } })
  return { ok: true }
}

/** Tandai jatuh tempo (batch, oleh sistem/admin). */
export async function tandaiJatuhTempo(): Promise<{ jumlah: number }> {
  const hasil = await prisma.invoiceTagihan.updateMany({
    where: { jatuhTempo: { lt: new Date() }, status: { in: ["BELUM_DIBAYAR", "SEBAGIAN"] } },
    data: { status: "JATUH_TEMPO" },
  })
  return { jumlah: hasil.count }
}
