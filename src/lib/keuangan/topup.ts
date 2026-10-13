import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { kirimNotifikasi } from "@/lib/notifikasi"
import { createAuditLog } from "@/lib/audit"
import { getOrCreateDompet, kreditDompet } from "./wallet"
import { jurnalTopup } from "./jurnal"

// ─── TOP-UP UANG SAKU OLEH WALI ──────────────────────────────────────
// Alur: wali buat permintaan → (opsional: bayar via gateway) → verifikasi
// manual bendahara ATAU webhook gateway terverifikasi → kredit ledger 1×.
// Idempotency key mencegah double kredit. Webhook diverifikasi HMAC-SHA256.

export const MIN_TOPUP = 1000
export const MAX_TOPUP = 2_000_000

function formatRupiah(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`
}

export async function penerimaWaliUntukSantri(santriId: string) {
  const walis = await prisma.santriWali.findMany({
    where: { santriId, santri: { deletedAt: null } },
    include: { wali: { select: { userId: true, nama: true } } },
  })
  return walis.filter((w) => w.wali.userId).map((w) => ({ userId: w.wali.userId!, label: "wali-santri", link: "/wali-santri/dompet" }))
}

/** Wali mengajukan top-up untuk anaknya. Idempoten via idempotencyKey. */
export async function buatTopupWali(params: {
  waliId: string
  santriId: string
  jumlah: number
  metode: "TRANSFER_BANK" | "QRIS" | "VIRTUAL_ACCOUNT"
  idempotencyKey: string
  buktiUrl?: string | null
}): Promise<{ ok: boolean; topupId?: string; status?: string; error?: string }> {
  const { waliId, santriId, jumlah, metode, idempotencyKey } = params
  if (!Number.isInteger(jumlah) || jumlah < MIN_TOPUP) return { ok: false, error: `Minimal top-up ${formatRupiah(MIN_TOPUP)}` }
  if (jumlah > MAX_TOPUP) return { ok: false, error: `Maksimal top-up ${formatRupiah(MAX_TOPUP)}` }

  // Validasi relasi wali → anak (IDOR protection)
  const rel = await prisma.santriWali.findFirst({
    where: { waliId, santriId, santri: { deletedAt: null } },
    select: { id: true, santri: { select: { userId: true, nama: true } }, wali: { select: { userId: true } } },
  })
  if (!rel) return { ok: false, error: "Anak ini bukan tanggung jawab Anda" }

  const dompet = await getOrCreateDompet(rel.santri.userId)

  // Idempoten: key sudah pernah dipakai → return existing
  const existing = await prisma.topupRequest.findUnique({ where: { idempotencyKey }, select: { id: true, status: true } })
  if (existing) return { ok: true, topupId: existing.id, status: existing.status }

  const topup = await prisma.topupRequest.create({
    data: {
      accountId: dompet.id,
      waliId,
      jumlah,
      metode,
      status: "MENUNGGU",
      buktiUrl: params.buktiUrl ?? null,
      idempotencyKey,
    },
    select: { id: true, status: true },
  })
  // Audit pakai User.id (bukan WaliSantri.id) agar FK valid
  await createAuditLog({ userId: rel.wali.userId, action: "TOPUP_DIAJUKAN", entity: "TopupRequest", entityId: topup.id, detail: { jumlah, metode, santriId } })
  return { ok: true, topupId: topup.id, status: topup.status }
}

/**
 * Verifikasi & setujui top-up (oleh bendahara/admin). Kredit ledger 1×.
 * Idempoten: bila sudah BERHASIL → sukses no-op.
 */
export async function verifikasiTopup(params: {
  topupId: string
  verifiedBy: string | null // User.id verifier; null = proses sistem (webhook gateway)
  setujui: boolean
  catatan?: string
}): Promise<{ ok: boolean; status?: string; ledgerId?: string; error?: string }> {
  const { topupId, verifiedBy, setujui, catatan } = params
  const topup = await prisma.topupRequest.findUnique({
    where: { id: topupId },
    include: { account: { select: { id: true, userId: true, nomor: true } } },
  })
  if (!topup) return { ok: false, error: "Top-up tidak ditemukan" }
  if (topup.status === "BERHASIL") return { ok: true, status: "BERHASIL", ledgerId: await ledgerIdDariTopup(topupId) ?? undefined }
  if (topup.status !== "MENUNGGU" && topup.status !== "DIPROSES") return { ok: false, error: `Status ${topup.status} tidak dapat diverifikasi` }

  if (!setujui) {
    await prisma.topupRequest.update({ where: { id: topupId }, data: { status: "DIBATALKAN", verifiedBy, verifiedAt: new Date(), catatan: catatan ?? "Ditolak" } })
    await createAuditLog({ userId: verifiedBy, action: "TOPUP_DITOLAK", entity: "TopupRequest", entityId: topupId, detail: { catatan } })
    return { ok: true, status: "DIBATALKAN" }
  }

  // Kredit ledger atomik (idempotencyKey = `topup:${topupId}`)
  const hasil = await kreditDompet({
    accountId: topup.accountId,
    jumlah: topup.jumlah,
    idempotencyKey: `topup:${topupId}`,
    tipe: "TOPUP",
    deskripsi: `Top-up ${formatRupiah(topup.jumlah)}`,
    refType: "TopupRequest",
    refId: topupId,
    actorUserId: verifiedBy ?? undefined,
  })
  if (!hasil.ok) return { ok: false, error: hasil.error }

  await prisma.topupRequest.update({ where: { id: topupId }, data: { status: "BERHASIL", verifiedBy, verifiedAt: new Date(), catatan: catatan ?? null } })
  await createAuditLog({ userId: verifiedBy, action: "TOPUP_DIVERIFIKASI", entity: "TopupRequest", entityId: topupId, detail: { jumlah: topup.jumlah, ledgerId: hasil.ledgerId } })

  // Jurnal: kas/bank naik + kewajiban dompet naik (bukan pendapatan)
  await jurnalTopup({
    kasAtauBank: topup.metode === "TRANSFER_BANK" || topup.metode === "VIRTUAL_ACCOUNT" ? "BANK" : "KAS",
    jumlah: topup.jumlah,
    refId: topupId,
    createdBy: verifiedBy ?? undefined,
    keterangan: `Top-up dompet ${topup.account.nomor}`,
  })

  // Notifikasi wali + pemilik dompet (setelah transaksi final)
  void kirimNotifikasi(await penerimaDompet(topup.accountId), {
    judul: "Top-up Berhasil",
    pesan: `Top-up uang saku sebesar ${formatRupiah(topup.jumlah)} berhasil. Saldo tersedia ${formatRupiah(hasil.saldoSesudah ?? 0)}.`,
    tipe: "INFO",
    link: "/siswa/dompet",
    eventKey: `topup-ok:${topupId}`,
  })
  return { ok: true, status: "BERHASIL", ledgerId: hasil.ledgerId }
}

async function ledgerIdDariTopup(topupId: string): Promise<string | null> {
  const l = await prisma.walletLedger.findUnique({ where: { idempotencyKey: `topup:${topupId}` }, select: { id: true } })
  return l?.id ?? null
}

async function penerimaDompet(accountId: string) {
  const akun = await prisma.walletAccount.findUnique({ where: { id: accountId }, select: { userId: true, nomor: true } })
  if (!akun) return []
  const list: { userId: string; label: string; link?: string }[] = [{ userId: akun.userId, label: "pemilik-dompet", link: "/siswa/dompet" }]
  const santri = await prisma.santri.findFirst({ where: { userId: akun.userId, deletedAt: null }, select: { id: true } })
  if (santri) {
    const walis = await penerimaWaliUntukSantri(santri.id)
    list.push(...walis)
  }
  return list
}

// ─── WEBHOOK GATEWAY (idempoten + terverifikasi) ─────────────────────
// Endpoint menerima POST dari payment gateway. Verifikasi HMAC-SHA256
// dengan secret dari env TOPUP_WEBHOOK_SECRET. Bila secret tidak diset,
// webhook DITOLAK (fail-closed) — jangan pernah kredit dari sukses frontend.

export type HasilWebhook = { ok: boolean; status?: string; error?: string; sudahDiproses?: boolean }

export async function prosesWebhookTopup(body: {
  externalId?: string
  topupId?: string
  status?: string
  amount?: number
  signature?: string
  timestamp?: string
}): Promise<HasilWebhook> {
  const secret = process.env.TOPUP_WEBHOOK_SECRET
  if (!secret) return { ok: false, error: "Webhook tidak dikonfigurasi (TOPUP_WEBHOOK_SECRET kosong)" }

  const topupId = body.topupId ?? body.externalId
  if (!topupId) return { ok: false, error: "topupId wajib" }

  // Verifikasi signature: HMAC-SHA256(`${topupId}.${timestamp}.${amount}`)
  const payload = `${topupId}.${body.timestamp ?? ""}.${body.amount ?? 0}`
  const expected = createHmac("sha256", secret).update(payload).digest("hex")
  const sig = String(body.signature ?? "")
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    await createAuditLog({ userId: null, action: "WEBHOOK_TOPUP_TTD_SALAH", entity: "TopupRequest", entityId: topupId, detail: { received: sig.slice(0, 16) } })
    return { ok: false, error: "Signature tidak valid" }
  }

  if (body.status && body.status !== "success" && body.status !== "settlement") {
    await prisma.topupRequest.updateMany({ where: { id: topupId, status: { in: ["MENUNGGU", "DIPROSES"] } }, data: { status: "GAGAL", catatan: `Gateway: ${body.status}` } })
    return { ok: true, status: "GAGAL" }
  }

  const topup = await prisma.topupRequest.findUnique({ where: { id: topupId }, select: { id: true, status: true, jumlah: true, waliId: true, accountId: true } })
  if (!topup) return { ok: false, error: "Top-up tidak ditemukan" }
  if (topup.status === "BERHASIL") return { ok: true, status: "BERHASIL", sudahDiproses: true }
  if (body.amount != null && body.amount !== topup.jumlah) {
    return { ok: false, error: "Jumlah tidak sesuai dengan permintaan" }
  }

  // verifiedBy: null — webhook adalah proses sistem, bukan verifier manusia
  const hasil = await verifikasiTopup({ topupId, verifiedBy: null, setujui: true, catatan: "Diverifikasi via webhook gateway" })
  if (!hasil.ok) return { ok: false, error: hasil.error }
  return { ok: true, status: hasil.status, sudahDiproses: hasil.status === "BERHASIL" }
}
