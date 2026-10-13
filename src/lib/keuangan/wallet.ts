import { prisma } from "@/lib/prisma"
import type { Prisma, TipeLedgerDompet, StatusDompet } from "@prisma/client"

// ─── DOMPET + LEDGER ATOMIK ──────────────────────────────────────────
// Sumber kebenaran saldo = WalletLedger. Field saldo di WalletAccount adalah
// materialisasi yang selalu dijaga konsisten dalam transaksi DB yang sama.
// Semua mutasi WAJIB lewat ledger dengan idempotencyKey unik.
// Cegah: saldo negatif, double debit, race condition, kredit ganda.

export type TipeLedger = TipeLedgerDompet

export type HasilMutasi = {
  ok: boolean
  ledgerId?: string
  saldoSebelum?: number
  saldoSesudah?: number
  error?: string
  sudahDiproses?: boolean // true bila idempotencyKey sudah pernah dipakai
}

/**
 * Mutasi ledger atomik. jumlah boleh positif (kredit) atau negatif (debit).
 * idempotencyKey unik global → panggilan ulang dengan key sama = no-op sukses.
 * Untuk KOREKSI, jumlah bebas tanda (yang membedakan).
 */
export async function catatLedger(params: {
  accountId: string
  idempotencyKey: string
  tipe: TipeLedger
  jumlah: number // tanda mengikuti tipe; utk KOREKSI bebas
  deskripsi?: string
  refType?: string
  refId?: string | null
  actorUserId?: string
  meta?: Prisma.InputJsonValue
  // untuk debit: wajib cukup; untuk kredit: langsung
  cekSaldoCukup?: boolean
}): Promise<HasilMutasi> {
  const { accountId, idempotencyKey, tipe, jumlah } = params
  if (!Number.isFinite(jumlah) || jumlah === 0) return { ok: false, error: "Nominal tidak valid" }
  if (tipe !== "KOREKSI" && !Number.isInteger(jumlah)) return { ok: false, error: "Nominal harus bilangan bulat" }

  // Arah mutasi ditentukan TANDA jumlah: positif = kredit (masuk), negatif = debit (keluar).
  // Pemanggil (debitDompet/kreditDompet) sudah menentukan tanda sesuai maksud.
  const kredit = jumlah > 0
  const nilai = Math.abs(jumlah)
  if (nilai <= 0) return { ok: false, error: "Nominal harus > 0" }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      // Idempotensi: cek dulu (lewat tx agar aman thd race insert concurrent)
      const ada = await tx.walletLedger.findUnique({ where: { idempotencyKey }, select: { id: true, saldoSebelum: true, saldoSesudah: true } })
      if (ada) return { ok: true, sudahDiproses: true, ledgerId: ada.id, saldoSebelum: ada.saldoSebelum, saldoSesudah: ada.saldoSesudah }

      const akun = await tx.walletAccount.findUnique({ where: { id: accountId }, select: { id: true, saldo: true, status: true, freezeSampai: true, userId: true } })
      if (!akun) throw new Error("Dompet tidak ditemukan")
      if (akun.status !== "AKTIF") throw new Error("Dompet tidak aktif")
      if (akun.freezeSampai && akun.freezeSampai.getTime() > Date.now()) throw new Error("Dompet dibekukan sementara")

      const debit = !kredit
      if (debit && params.cekSaldoCukup !== false) {
        if (akun.saldo < nilai) throw new Error("Saldo tidak mencukupi")
      }
      const saldoSebelum = akun.saldo
      const saldoSesudah = kredit ? saldoSebelum + nilai : saldoSebelum - nilai
      if (saldoSesudah < 0) throw new Error("Saldo tidak mencukupi")

      // Update saldo dengan syarat optimistic-lock: saldo tidak boleh berubah di luar tx ini.
      const upd = await tx.walletAccount.updateMany({
        where: { id: accountId, saldo: saldoSebelum, status: "AKTIF" },
        data: { saldo: saldoSesudah },
      })
      if (upd.count === 0) throw new Error("Saldo berubah — coba lagi") // race condition tertangkap

      const ledger = await tx.walletLedger.create({
        data: {
          accountId,
          idempotencyKey,
          tipe,
          jumlah: kredit ? nilai : -nilai,
          saldoSebelum,
          saldoSesudah,
          deskripsi: params.deskripsi ?? null,
          refType: params.refType ?? null,
          refId: params.refId ?? null,
          actorUserId: params.actorUserId ?? null,
          meta: params.meta,
        },
        select: { id: true },
      })
      return { ok: true, ledgerId: ledger.id, saldoSebelum, saldoSesudah }
    })
    return hasil as HasilMutasi
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // P2002 = race insert idempotencyKey → sudah diproses pihak lain
    if (msg.includes("P2002") || msg.toLowerCase().includes("unique")) {
      const ada = await prisma.walletLedger.findUnique({ where: { idempotencyKey }, select: { id: true, saldoSebelum: true, saldoSesudah: true } })
      if (ada) return { ok: true, sudahDiproses: true, ledgerId: ada.id, saldoSebelum: ada.saldoSebelum, saldoSesudah: ada.saldoSesudah }
    }
    return { ok: false, error: msg }
  }
}

/** Hitung ulang saldo dompet dari ledger — untuk deteksi inkonsistensi. */
export async function hitungSaldoDariLedger(accountId: string): Promise<number> {
  const agg = await prisma.walletLedger.aggregate({ where: { accountId }, _sum: { jumlah: true } })
  return agg._sum.jumlah ?? 0
}

/** Verifikasi konsistensi materialisasi vs ledger. */
export async function verifikasiKonsistensiSaldo(accountId: string): Promise<{ konsisten: boolean; materialisasi: number; ledger: number }> {
  const akun = await prisma.walletAccount.findUnique({ where: { id: accountId }, select: { saldo: true } })
  const ledger = await hitungSaldoDariLedger(accountId)
  const materialisasi = akun?.saldo ?? 0
  return { konsisten: materialisasi === ledger, materialisasi, ledger }
}

/** Debit dompet (keluar) — atomik + cek saldo + limit harian/per transaksi. */
export async function debitDompet(params: {
  accountId: string
  jumlah: number
  idempotencyKey: string
  deskripsi?: string
  refType?: string
  refId?: string | null
  actorUserId?: string
  meta?: Prisma.InputJsonValue
  tipe?: TipeLedger // default PEMBAYARAN_KANTIN
}): Promise<HasilMutasi> {
  const nilai = Math.abs(params.jumlah)
  const akun = await prisma.walletAccount.findUnique({ where: { id: params.accountId }, select: { limitPerTransaksi: true, limitHarian: true } })
  if (akun?.limitPerTransaksi && nilai > akun.limitPerTransaksi) {
    return { ok: false, error: `Melebihi limit per transaksi (maks Rp${akun.limitPerTransaksi.toLocaleString("id-ID")})` }
  }
  if (akun?.limitHarian) {
    const cekHarian = await cekLimitHarian(params.accountId)
    if (!cekHarian.ok) return { ok: false, error: cekHarian.error }
    if (cekHarian.sisa !== null && nilai > cekHarian.sisa) {
      return { ok: false, error: `Melebihi sisa limit harian (sisa Rp${cekHarian.sisa.toLocaleString("id-ID")})` }
    }
  }
  return catatLedger({
    accountId: params.accountId,
    idempotencyKey: params.idempotencyKey,
    tipe: params.tipe ?? "PEMBAYARAN_KANTIN",
    jumlah: -nilai,
    deskripsi: params.deskripsi,
    refType: params.refType,
    refId: params.refId,
    actorUserId: params.actorUserId,
    meta: params.meta,
    cekSaldoCukup: true,
  })
}

/** Kredit dompet (masuk) — atomik. */
export async function kreditDompet(params: {
  accountId: string
  jumlah: number
  idempotencyKey: string
  tipe: TipeLedger
  deskripsi?: string
  refType?: string
  refId?: string | null
  actorUserId?: string
  meta?: Prisma.InputJsonValue
}): Promise<HasilMutasi> {
  return catatLedger({ ...params, jumlah: Math.abs(params.jumlah), cekSaldoCukup: false })
}

/** Sisa limit harian berdasarkan ledger debit hari ini. */
export async function cekLimitHarian(accountId: string): Promise<{ ok: boolean; sisa: number | null; error?: string }> {
  const akun = await prisma.walletAccount.findUnique({ where: { id: accountId }, select: { limitHarian: true } })
  if (!akun?.limitHarian) return { ok: true, sisa: null }
  const awal = new Date(); awal.setHours(0, 0, 0, 0)
  const agg = await prisma.walletLedger.aggregate({
    where: { accountId, createdAt: { gte: awal }, jumlah: { lt: 0 } },
    _sum: { jumlah: true },
  })
  const terpakai = Math.abs(agg._sum.jumlah ?? 0)
  const sisa = akun.limitHarian - terpakai
  if (sisa <= 0) return { ok: false, sisa: 0, error: "Limit harian sudah terpakai habis" }
  return { ok: true, sisa }
}

/** Bekukan / aktifkan dompet. */
export async function setStatusDompet(accountId: string, status: StatusDompet, freezeSampai?: Date | null): Promise<void> {
  await prisma.walletAccount.update({
    where: { id: accountId },
    data: { status, freezeSampai: freezeSampai ?? null },
  })
}

/** Pastikan dompet ada untuk user (idempoten). Nomor urut dari counter aman. */
export async function getOrCreateDompet(userId: string): Promise<{ id: string; nomor: string; saldo: number; status: StatusDompet }> {
  const ada = await prisma.walletAccount.findUnique({ where: { userId }, select: { id: true, nomor: true, saldo: true, status: true } })
  if (ada) return ada
  // Buat dengan retry bila nomor bentrok (race create)
  for (let i = 0; i < 5; i++) {
    const jumlah = await prisma.walletAccount.count()
    const nomor = `DW-${String(jumlah + 1).padStart(6, "0")}`
    try {
      const baru = await prisma.walletAccount.create({ data: { userId, nomor, saldo: 0 }, select: { id: true, nomor: true, saldo: true, status: true } })
      return baru
    } catch {
      // nomor bentrok → coba lagi
    }
  }
  const ulang = await prisma.walletAccount.findUnique({ where: { userId }, select: { id: true, nomor: true, saldo: true, status: true } })
  if (ulang) return ulang
  throw new Error("Gagal membuat dompet")
}
