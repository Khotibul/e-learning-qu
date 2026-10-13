import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

// ─── JURNAL AKUNTANSI BERIMBANG ──────────────────────────────────────
// Prinsip: setiap jurnal total debit === total kredit.
// Pemisahan akuntansi:
//   Wallet Ledger  → mutasi saldo dompet (bukan pendapatan).
//   Billing Ledger → invoice/pembayaran tagihan.
//   Accounting     → jurnal_umum + jurnal_item (kas/bank/kewajiban/piutang/
//                    persediaan/pendapatan/HPP).
// Kewajiban dompet (KEWAJIBAN_DOMPET) = utang pengelola ke pemilik saldo;
// top-up TIDAK otomatis pendapatan — pendapatan hanya tercatat saat
// terjadinya konsumsi (penjualan kantin / pembayaran tagihan).

export type ItemJurnalInput = { kode: string; debit?: number; kredit?: number; keterangan?: string }

/** Akun standar yang dipakai seluruh modul. */
export const AKUN_STANDAR = [
  { kode: "KAS", nama: "Kas Tunai", tipe: "KAS" as const },
  { kode: "BANK", nama: "Bank", tipe: "BANK" as const },
  { kode: "KEWAJIBAN_DOMPET", nama: "Kewajiban Dompet Siswa/Santri", tipe: "KEWAJIBAN_DOMPET" as const },
  { kode: "PIUTANG", nama: "Piutang Siswa/Santri", tipe: "PIUTANG" as const },
  { kode: "PERSEDIAAN", nama: "Persediaan Kantin", tipe: "PERSEDIAAN" as const },
  { kode: "PENDAPATAN_KANTIN", nama: "Pendapatan Kantin", tipe: "PENDAPATAN" as const },
  { kode: "PENDAPATAN_SEKOLAH", nama: "Pendapatan Sekolah", tipe: "PENDAPATAN" as const },
  { kode: "PENDAPATAN_PONDOK", nama: "Pendapatan Pondok", tipe: "PENDAPATAN" as const },
  { kode: "HPP", nama: "Harga Pokok Penjualan", tipe: "BEBAN_HPP" as const },
] as const

/** Seed idempoten akun standar. */
export async function seedAkunLaporan(): Promise<number> {
  let dibuat = 0
  for (const a of AKUN_STANDAR) {
    const ada = await prisma.akunLaporan.findUnique({ where: { kode: a.kode } })
    if (!ada) {
      await prisma.akunLaporan.create({ data: { kode: a.kode, nama: a.nama, tipe: a.tipe } })
      dibuat++
    }
  }
  return dibuat
}

async function nomorJurnalBaru(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
  const prefix = `JRN-${ym}-`
  const last = await tx.jurnalUmum.findFirst({ where: { nomor: { startsWith: prefix } }, orderBy: { nomor: "desc" }, select: { nomor: true } })
  const seq = last?.nomor ? parseInt(last.nomor.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

/**
 * Posting jurnal atomik. Validasi: minimal 2 item, debit==kredit, tiap item
 * punya salah satu debit/kredit > 0. Mengupdate saldo materialisasi akun.
 */
export async function postingJurnal(params: {
  keterangan: string
  refType: string
  refId?: string
  items: ItemJurnalInput[]
  createdBy?: string
  tanggal?: Date
}): Promise<{ ok: boolean; jurnalId?: string; nomor?: string; error?: string }> {
  const { items } = params
  if (items.length < 2) return { ok: false, error: "Jurnal minimal 2 item" }
  let totalDebit = 0
  let totalKredit = 0
  for (const it of items) {
    const d = it.debit ?? 0
    const k = it.kredit ?? 0
    if (d < 0 || k < 0) return { ok: false, error: "Nilai debit/kredit tidak boleh negatif" }
    if ((d === 0 && k === 0) || (d > 0 && k > 0)) return { ok: false, error: `Item ${it.kode}: isi debit ATAU kredit` }
    totalDebit += d
    totalKredit += k
  }
  if (totalDebit !== totalKredit) {
    return { ok: false, error: `Jurnal tidak berimbang (debit ${totalDebit} ≠ kredit ${totalKredit})` }
  }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      const nomor = await nomorJurnalBaru(tx)
      const akunRows = await tx.akunLaporan.findMany({ where: { kode: { in: items.map((i) => i.kode) } }, select: { id: true, kode: true } })
      const byKode = new Map(akunRows.map((a) => [a.kode, a.id]))
      for (const it of items) {
        if (!byKode.has(it.kode)) throw new Error(`Akun ${it.kode} belum terdaftar — jalankan seedAkunLaporan`)
      }
      const jurnal = await tx.jurnalUmum.create({
        data: {
          nomor,
          tanggal: params.tanggal ?? new Date(),
          keterangan: params.keterangan,
          refType: params.refType,
          refId: params.refId ?? null,
          status: "POSTING",
          createdBy: params.createdBy ?? null,
          item: {
            create: items.map((it) => ({
              akunId: byKode.get(it.kode)!,
              debit: it.debit ?? 0,
              kredit: it.kredit ?? 0,
              keterangan: it.keterangan ?? null,
            })),
          },
        },
        select: { id: true, nomor: true },
      })
      // Update saldo materialisasi akun (debit +, kredit - tergantung tipe normal)
      for (const it of items) {
        const d = it.debit ?? 0
        const k = it.kredit ?? 0
        const meta = AKUN_STANDAR.find((a) => a.kode === it.kode)
        const tipe = meta?.tipe
        // Aset/Beban: saldo naik saat debit. Kewajiban/Pendapatan/Ekuitas: saldo naik saat kredit.
        const akun = tipe === "KAS" || tipe === "BANK" || tipe === "PIUTANG" || tipe === "PERSEDIAAN" || tipe === "BEBAN_HPP"
        const delta = akun ? d - k : k - d
        await tx.akunLaporan.update({ where: { id: byKode.get(it.kode)! }, data: { saldo: { increment: delta } } })
      }
      return jurnal
    })
    return { ok: true, jurnalId: hasil.id, nomor: hasil.nomor }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── POSTING TERSIAP (dipakai modul topup / kantin / billing) ────────

/** Top-up tunai/transfer diverifikasi: kas/bank naik, kewajiban dompet naik. */
export async function jurnalTopup(opts: { kasAtauBank: "KAS" | "BANK"; jumlah: number; refId: string; createdBy?: string; keterangan: string }) {
  return postingJurnal({
    keterangan: opts.keterangan,
    refType: "TopupRequest",
    refId: opts.refId,
    createdBy: opts.createdBy,
    items: [
      { kode: opts.kasAtauBank, debit: opts.jumlah },
      { kode: "KEWAJIBAN_DOMPET", kredit: opts.jumlah },
    ],
  })
}

/** Pembelian kantin e-wallet: kewajiban dompet turun, pendapatan naik, HPP + persediaan turun. */
export async function jurnalPenjualanEWallet(opts: { total: number; hpp: number; refId: string; createdBy?: string; keterangan: string }) {
  const items: ItemJurnalInput[] = [
    { kode: "KEWAJIBAN_DOMPET", debit: opts.total },
    { kode: "PENDAPATAN_KANTIN", kredit: opts.total },
  ]
  if (opts.hpp > 0) {
    items.push({ kode: "HPP", debit: opts.hpp })
    items.push({ kode: "PERSEDIAAN", kredit: opts.hpp })
  }
  return postingJurnal({ keterangan: opts.keterangan, refType: "KantinTransaksi", refId: opts.refId, createdBy: opts.createdBy, items })
}

/** Pembelian kantin tunai: kas naik, pendapatan naik, HPP + persediaan turun. */
export async function jurnalPenjualanTunai(opts: { total: number; hpp: number; refId: string; createdBy?: string; keterangan: string }) {
  const items: ItemJurnalInput[] = [
    { kode: "KAS", debit: opts.total },
    { kode: "PENDAPATAN_KANTIN", kredit: opts.total },
  ]
  if (opts.hpp > 0) {
    items.push({ kode: "HPP", debit: opts.hpp })
    items.push({ kode: "PERSEDIAAN", kredit: opts.hpp })
  }
  return postingJurnal({ keterangan: opts.keterangan, refType: "KantinTransaksi", refId: opts.refId, createdBy: opts.createdBy, items })
}

/** Refund e-wallet: kewajiban dompet naik kembali, pendapatan dikurangi. */
export async function jurnalRefundEWallet(opts: { jumlah: number; refId: string; createdBy?: string; keterangan: string }) {
  return postingJurnal({
    keterangan: opts.keterangan,
    refType: "KantinRefund",
    refId: opts.refId,
    createdBy: opts.createdBy,
    items: [
      { kode: "PENDAPATAN_KANTIN", debit: opts.jumlah },
      { kode: "KEWAJIBAN_DOMPET", kredit: opts.jumlah },
    ],
  })
}

/** Bayar tagihan via e-wallet: kewajiban dompet turun, pendapatan unit naik. */
export async function jurnalBayarTagihanEWallet(opts: { jumlah: number; unit: "SEKOLAH" | "PONDOK"; refId: string; createdBy?: string; keterangan: string }) {
  return postingJurnal({
    keterangan: opts.keterangan,
    refType: "PembayaranTagihan",
    refId: opts.refId,
    createdBy: opts.createdBy,
    items: [
      { kode: "KEWAJIBAN_DOMPET", debit: opts.jumlah },
      { kode: opts.unit === "PONDOK" ? "PENDAPATAN_PONDOK" : "PENDAPATAN_SEKOLAH", kredit: opts.jumlah },
    ],
  })
}

/** Bayar tagihan tunai: kas naik, pendapatan unit naik. */
export async function jurnalBayarTagihanTunai(opts: { jumlah: number; unit: "SEKOLAH" | "PONDOK"; refId: string; createdBy?: string; keterangan: string }) {
  return postingJurnal({
    keterangan: opts.keterangan,
    refType: "PembayaranTagihan",
    refId: opts.refId,
    createdBy: opts.createdBy,
    items: [
      { kode: "KAS", debit: opts.jumlah },
      { kode: opts.unit === "PONDOK" ? "PENDAPATAN_PONDOK" : "PENDAPATAN_SEKOLAH", kredit: opts.jumlah },
    ],
  })
}
