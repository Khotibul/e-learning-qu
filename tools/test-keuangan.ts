// Test MODUL KEUANGAN (dompet, top-up, kantin, billing, jurnal) — 19 skenario STEP 16.
// Jalankan: npx tsx tools/test-keuangan.ts
import { createHmac } from "crypto"
import { prisma } from "../src/lib/prisma"
import { getOrCreateDompet, debitDompet, kreditDompet, verifikasiKonsistensiSaldo, cekLimitHarian } from "../src/lib/keuangan/wallet"
import { buatTopupWali, verifikasiTopup, prosesWebhookTopup, MIN_TOPUP } from "../src/lib/keuangan/topup"
import { checkoutKantin, batalTransaksiKantin, refundKantin, bukaShift, tutupShift } from "../src/lib/keuangan/kantin"
import { buatInvoice, bayarInvoice, verifikasiPembayaranTagihan } from "../src/lib/keuangan/billing"
import { seedAkunLaporan } from "../src/lib/keuangan/jurnal"
import { requireWaliKeuangan, requirePetugasKeuangan, requireMonitoringKeuanganPondok, waliBerhakAtasSantri } from "../src/lib/keuangan/guard"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}
async function expectThrow(nama: string, fn: () => Promise<unknown>, match?: string) {
  try { await fn(); cek(nama, false, "tidak melempar error") }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cek(nama, match ? msg.toLowerCase().includes(match.toLowerCase()) : true, msg)
  }
}
const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function jurnalBerimbang(refType: string, refId: string): Promise<boolean> {
  const items = await prisma.jurnalItem.findMany({ where: { jurnal: { refType, refId } }, select: { debit: true, kredit: true } })
  if (!items.length) return false
  const d = items.reduce((s, i) => s + i.debit, 0)
  const k = items.reduce((s, i) => s + i.kredit, 0)
  return d === k && d > 0
}

async function main() {
  console.log("=== TEST MODUL KEUANGAN — 19 SKENARIO ===\n")
  const ts = Date.now()
  await seedAkunLaporan()
  const awal = new Date()

  // ── Fixtures ───────────────────────────────────────────────────────
  const santri1u = await prisma.user.create({ data: { email: `keu-s1-${ts}@t.test`, name: "Santri Keuangan 1", password: "x".repeat(60), role: "SISWA" } })
  const santri1 = await prisma.santri.create({ data: { userId: santri1u.id, nisNo: `NIS-K-${ts}-1`, nama: "Santri Keuangan 1", status: "AKTIF" } })
  const wali1u = await prisma.user.create({ data: { email: `keu-w1-${ts}@t.test`, name: "Wali Keuangan 1", password: "x".repeat(60), role: "SISWA" } })
  const wali1 = await prisma.waliSantri.create({ data: { userId: wali1u.id, nama: "Wali Keuangan 1", hubungan: "IBU" } })
  await prisma.santriWali.create({ data: { santriId: santri1.id, waliId: wali1.id, isPrimary: true } })

  const waliAsingU = await prisma.user.create({ data: { email: `keu-wx-${ts}@t.test`, name: "Wali Asing", password: "x".repeat(60), role: "SISWA" } })
  const waliAsing = await prisma.waliSantri.create({ data: { userId: waliAsingU.id, nama: "Wali Asing", hubungan: "AYAH" } })

  const santri2u = await prisma.user.create({ data: { email: `keu-s2-${ts}@t.test`, name: "Santri Keuangan 2", password: "x".repeat(60), role: "SISWA" } })
  const santri2 = await prisma.santri.create({ data: { userId: santri2u.id, nisNo: `NIS-K-${ts}-2`, nama: "Santri Keuangan 2", status: "AKTIF" } })

  const kasirU = await prisma.user.create({ data: { email: `keu-kasir-${ts}@t.test`, name: "Kasir Test", password: "x".repeat(60), role: "GURU" } })
  const kasir2U = await prisma.user.create({ data: { email: `keu-kasir2-${ts}@t.test`, name: "Kasir Test 2", password: "x".repeat(60), role: "GURU" } })
  const bendaharaU = await prisma.user.create({ data: { email: `keu-bend-${ts}@t.test`, name: "Bendahara Test", password: "x".repeat(60), role: "GURU" } })
  await prisma.keuanganStaff.create({ data: { userId: kasirU.id, peran: "KASIR" } })
  await prisma.keuanganStaff.create({ data: { userId: bendaharaU.id, peran: "BENDAHARA" } })

  const outlet = await prisma.kantinOutlet.create({ data: { nama: `Kantin Test ${ts}`, kode: `KT-${ts}` } })
  const produkA = await prisma.kantinProduk.create({ data: { outletId: outlet.id, nama: "Nasi Test", sku: `NS-${ts}`, hargaJual: 10_000, hargaModal: 6_000, stok: 10 } })
  const produkB = await prisma.kantinProduk.create({ data: { outletId: outlet.id, nama: "Es Test", sku: `ES-${ts}`, hargaJual: 3_000, hargaModal: 1_000, stok: 5 } })
  const produkRace = await prisma.kantinProduk.create({ data: { outletId: outlet.id, nama: "Race Item", sku: `RC-${ts}`, hargaJual: 5_000, hargaModal: 2_000, stok: 1 } })

  const jenisSekolah = await prisma.jenisTagihan.upsert({ where: { kode: "SPP" }, create: { kode: "SPP", nama: "SPP Bulanan", unit: "SEKOLAH", nominalDefault: 500_000 }, update: {} })
  const jenisPondok = await prisma.jenisTagihan.upsert({ where: { kode: "ASRAMA" }, create: { kode: "ASRAMA", nama: "Biaya Asrama", unit: "PONDOK", nominalDefault: 300_000 }, update: {} })
  await prisma.jenisTagihan.upsert({ where: { kode: "KEGIATAN" }, create: { kode: "KEGIATAN", nama: "Kegiatan", unit: null, nominalDefault: 100_000 }, update: {} })

  // ── 1. Dompet dibuat idempoten, saldo 0, konsistensi awal ───────────
  console.log("\n─ SKENARIO 1: Dompet & konsistensi awal ─")
  const dompet1 = await getOrCreateDompet(santri1u.id)
  const dompet1b = await getOrCreateDompet(santri1u.id)
  cek("getOrCreateDompet idempoten (nomor sama)", dompet1.id === dompet1b.id && dompet1.nomor === dompet1b.nomor)
  cek("Saldo awal 0", dompet1.saldo === 0)
  const konsAwal = await verifikasiKonsistensiSaldo(dompet1.id)
  cek("Konsistensi materialisasi == ledger (0)", konsAwal.konsisten && konsAwal.materialisasi === 0)
  const dompet2 = await getOrCreateDompet(santri2u.id)

  // ── 2. Wali ajukan top-up → MENUNGGU, saldo belum berubah ───────────
  console.log("\n─ SKENARIO 2: Pengajuan top-up ─")
  const topup1 = await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: 100_000, metode: "TRANSFER_BANK", idempotencyKey: `tu-${ts}-1` })
  cek("Top-up dibuat MENUNGGU", topup1.ok && topup1.status === "MENUNGGU")
  const topup1dup = await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: 100_000, metode: "TRANSFER_BANK", idempotencyKey: `tu-${ts}-1` })
  cek("Idempoten: key sama → topupId sama, tidak dobel", topup1dup.ok && topup1dup.topupId === topup1.topupId)
  cek("Saldo belum berubah saat MENUNGGU", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 0)
  cek("Validasi minimal top-up", !(await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: MIN_TOPUP - 1, metode: "QRIS", idempotencyKey: `tu-min-${ts}` })).ok)

  // ── 3. IDOR: wali asing tidak bisa top-up anak orang ────────────────
  console.log("\n─ SKENARIO 3: IDOR proteksi wali ─")
  const idor = await buatTopupWali({ waliId: waliAsing.id, santriId: santri1.id, jumlah: 50_000, metode: "QRIS", idempotencyKey: `tu-idor-${ts}` })
  cek("Wali asing ditolak (bukan anaknya)", !idor.ok && (idor.error ?? "").toLowerCase().includes("tanggung jawab"))
  cek("waliBerhakAtasSantri false utk wali asing", (await waliBerhakAtasSantri(waliAsing.id, santri1.id)) === false)
  cek("waliBerhakAtasSantri true utk wali resmi", (await waliBerhakAtasSantri(wali1.id, santri1.id)) === true)

  // ── 4. Verifikasi top-up → kredit 1× + ledger + jurnal berimbang ────
  console.log("\n─ SKENARIO 4: Verifikasi top-up sukses ─")
  const ver1 = await verifikasiTopup({ topupId: topup1.topupId!, verifiedBy: bendaharaU.id, setujui: true })
  cek("Verifikasi sukses BERHASIL", ver1.ok && ver1.status === "BERHASIL")
  const saldo1 = (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo
  cek("Saldo kredit tepat 100.000", saldo1 === 100_000)
  const ledgerTopup = await prisma.walletLedger.findUnique({ where: { idempotencyKey: `topup:${topup1.topupId}` } })
  cek("Ledger TOPUP tercatat +100.000", ledgerTopup?.tipe === "TOPUP" && ledgerTopup.jumlah === 100_000 && ledgerTopup.saldoSesudah === 100_000)
  cek("Jurnal top-up berimbang (KAS debit / KEWAJIBAN kredit)", await jurnalBerimbang("TopupRequest", topup1.topupId!))
  const kwDompet = await prisma.akunLaporan.findUnique({ where: { kode: "KEWAJIBAN_DOMPET" }, select: { saldo: true } })
  cek("Akun KEWAJIBAN_DOMPET naik 100.000", (kwDompet?.saldo ?? 0) >= 100_000)

  // ── 5. Verifikasi ulang idempoten → tidak dobel kredit ──────────────
  console.log("\n─ SKENARIO 5: Verifikasi idempoten ─")
  const ver1ulang = await verifikasiTopup({ topupId: topup1.topupId!, verifiedBy: bendaharaU.id, setujui: true })
  cek("Verifikasi ulang sukses (sudah BERHASIL)", ver1ulang.ok && ver1ulang.status === "BERHASIL")
  cek("Saldo TIDAK dobel", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 100_000)
  cek("Hanya 1 ledger TOPUP untuk topup ini", await prisma.walletLedger.count({ where: { idempotencyKey: `topup:${topup1.topupId}` } }) === 1)

  // ── 6. Top-up ditolak → saldo tidak berubah ─────────────────────────
  console.log("\n─ SKENARIO 6: Top-up ditolak ─")
  const topup2 = await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: 50_000, metode: "QRIS", idempotencyKey: `tu-${ts}-2` })
  const ver2 = await verifikasiTopup({ topupId: topup2.topupId!, verifiedBy: bendaharaU.id, setujui: false, catatan: "Bukti tidak jelas" })
  cek("Ditolak → status DIBATALKAN", ver2.ok && ver2.status === "DIBATALKAN")
  cek("Saldo tidak berubah setelah penolakan", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 100_000)

  // ── 7. Webhook signature salah → ditolak (fail-closed) ──────────────
  console.log("\n─ SKENARIO 7: Webhook signature salah ─")
  process.env.TOPUP_WEBHOOK_SECRET = "rahasia-test-123"
  const topup3 = await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: 25_000, metode: "VIRTUAL_ACCOUNT", idempotencyKey: `tu-${ts}-3` })
  const whSalah = await prosesWebhookTopup({ topupId: topup3.topupId!, status: "success", amount: 25_000, timestamp: String(ts), signature: "0".repeat(64) })
  cek("Signature salah ditolak", !whSalah.ok && (whSalah.error ?? "").toLowerCase().includes("signature"))
  cek("Saldo tidak berubah akibat webhook salah", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 100_000)

  // ── 8. Webhook valid → BERHASIL; duplikat → sudahDiproses ───────────
  console.log("\n─ SKENARIO 8: Webhook valid + duplikat ─")
  const tsW = String(ts + 1)
  const sigW = createHmac("sha256", "rahasia-test-123").update(`${topup3.topupId}.${tsW}.25000`).digest("hex")
  const wh1 = await prosesWebhookTopup({ topupId: topup3.topupId!, status: "settlement", amount: 25_000, timestamp: tsW, signature: sigW })
  cek("Webhook valid → BERHASIL", wh1.ok && wh1.status === "BERHASIL")
  cek("Saldo naik 25.000 → 125.000", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 125_000)
  const wh2 = await prosesWebhookTopup({ topupId: topup3.topupId!, status: "success", amount: 25_000, timestamp: tsW, signature: sigW })
  cek("Webhook duplikat → sudahDiproses", wh2.ok && wh2.sudahDiproses === true)
  cek("Saldo TIDAK dobel setelah duplikat", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 125_000)

  // ── 9. Webhook status gagal → topup GAGAL, saldo tak berubah ────────
  console.log("\n─ SKENARIO 9: Webhook status gagal ─")
  const topup4 = await buatTopupWali({ waliId: wali1.id, santriId: santri1.id, jumlah: 10_000, metode: "QRIS", idempotencyKey: `tu-${ts}-4` })
  const tsG = String(ts + 2)
  const sigG = createHmac("sha256", "rahasia-test-123").update(`${topup4.topupId}.${tsG}.10000`).digest("hex")
  const whG = await prosesWebhookTopup({ topupId: topup4.topupId!, status: "pending", amount: 10_000, timestamp: tsG, signature: sigG })
  cek("Status pending → GAGAL", whG.ok && whG.status === "GAGAL")
  cek("Saldo tidak berubah", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === 125_000)

  // ── 10. Pembelian kantin e-wallet → saldo turun, stok turun, jurnal ─
  console.log("\n─ SKENARIO 10: Pembelian kantin e-wallet ─")
  const byr1 = await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkA.id, qty: 2 }, { produkId: produkB.id, qty: 1 }], metode: "EWALLET", accountId: dompet1.id, idempotencyKey: `STR-T10-${ts}` })
  cek("Checkout e-wallet sukses", byr1.ok && byr1.total === 23_000)
  cek("Saldo turun 125.000 → 102.000", byr1.saldoSesudah === 102_000)
  cek("Stok produkA turun 10 → 8", (await prisma.kantinProduk.findUnique({ where: { id: produkA.id }, select: { stok: true } }))?.stok === 8)
  cek("Jurnal penjualan e-wallet berimbang", await jurnalBerimbang("KantinTransaksi", byr1.transaksiId!))
  cek("Struk tersimpan + item snapshot", (await prisma.kantinTransaksiItem.count({ where: { transaksiId: byr1.transaksiId! } })) === 2)

  // ── 11. Pembelian tunai → tanpa dompet, jurnal kas ──────────────────
  console.log("\n─ SKENARIO 11: Pembelian kantin tunai ─")
  const byrTunai = await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkB.id, qty: 1 }], metode: "TUNAI", idempotencyKey: `STR-T11-${ts}` })
  cek("Checkout tunai sukses", byrTunai.ok && byrTunai.total === 3_000)
  cek("Stok Es turun lagi", (await prisma.kantinProduk.findUnique({ where: { id: produkB.id }, select: { stok: true } }))?.stok === 3)
  cek("Jurnal tunai berimbang (KAS)", await jurnalBerimbang("KantinTransaksi", byrTunai.transaksiId!))

  // ── 12. Saldo kurang → checkout gagal, saldo tidak negatif ──────────
  console.log("\n─ SKENARIO 12: Saldo kurang ─")
  const byrGagal = await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkA.id, qty: 1 }], metode: "EWALLET", accountId: dompet2.id, idempotencyKey: `STR-T12-${ts}` })
  cek("Checkout ditolak (saldo 0)", !byrGagal.ok && (byrGagal.error ?? "").toLowerCase().includes("saldo"))
  cek("Saldo dompet2 tetap 0 (tidak negatif)", (await prisma.walletAccount.findUnique({ where: { id: dompet2.id }, select: { saldo: true } }))?.saldo === 0)
  cek("Stok tidak berubah saat gagal", (await prisma.kantinProduk.findUnique({ where: { id: produkA.id }, select: { stok: true } }))?.stok === 8)

  // ── 13. Limit harian & per transaksi ────────────────────────────────
  console.log("\n─ SKENARIO 13: Limit dompet ─")
  // Pakai dompet2 (belum pernah debit hari ini) agar limit harian tidak tercampur
  await kreditDompet({ accountId: dompet2.id, jumlah: 100_000, idempotencyKey: `limit-fund-${ts}`, tipe: "KOREKSI", deskripsi: "Modal test limit" })
  await prisma.walletAccount.update({ where: { id: dompet2.id }, data: { limitHarian: 30_000, limitPerTransaksi: 60_000 } })
  const byrLimitTx = await debitDompet({ accountId: dompet2.id, jumlah: 70_000, idempotencyKey: `lim-tx-${ts}` })
  cek("Debit > limit per transaksi ditolak", !byrLimitTx.ok && (byrLimitTx.error ?? "").toLowerCase().includes("per transaksi"))
  const d1 = await debitDompet({ accountId: dompet2.id, jumlah: 25_000, idempotencyKey: `lim-1-${ts}` })
  cek("Debit 25.000 dalam limit harian 30.000 sukses", d1.ok, d1.error)
  const d2 = await debitDompet({ accountId: dompet2.id, jumlah: 10_000, idempotencyKey: `lim-2-${ts}` })
  cek("Debit berikut melebihi sisa limit harian ditolak", !d2.ok && (d2.error ?? "").toLowerCase().includes("limit harian"), d2.error)
  cek("cekLimitHarian menyisa 5.000", (await cekLimitHarian(dompet2.id)).sisa === 5_000)
  await prisma.walletAccount.update({ where: { id: dompet2.id }, data: { limitHarian: null, limitPerTransaksi: null } })

  // ── 14. Stok kurang → checkout gagal ────────────────────────────────
  console.log("\n─ SKENARIO 14: Stok kurang ─")
  const byrStok = await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkRace.id, qty: 5 }], metode: "TUNAI", idempotencyKey: `STR-T14-${ts}` })
  cek("Checkout stok kurang ditolak", !byrStok.ok && (byrStok.error ?? "").toLowerCase().includes("stok"))
  cek("Stok race tetap 1", (await prisma.kantinProduk.findUnique({ where: { id: produkRace.id }, select: { stok: true } }))?.stok === 1)

  // ── 15. Race: 2 kasir paralel, stok 1 → hanya 1 sukses ──────────────
  console.log("\n─ SKENARIO 15: Race condition 2 kasir ─")
  const akunRace1 = await getOrCreateDompet(santri1u.id)
  const akunRace2 = await getOrCreateDompet(santri2u.id)
  await kreditDompet({ accountId: akunRace2.id, jumlah: 50_000, idempotencyKey: `race-fund-${ts}`, tipe: "KOREKSI", deskripsi: "Modal test race" })
  const saldoSebelumRace1 = (await prisma.walletAccount.findUnique({ where: { id: akunRace1.id }, select: { saldo: true } }))?.saldo ?? 0
  const saldoSebelumRace2 = (await prisma.walletAccount.findUnique({ where: { id: akunRace2.id }, select: { saldo: true } }))?.saldo ?? 0
  const [r1, r2] = await Promise.all([
    checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkRace.id, qty: 1 }], metode: "EWALLET", accountId: akunRace1.id, idempotencyKey: `STR-R1-${ts}` }),
    checkoutKantin({ outletId: outlet.id, kasirUserId: kasir2U.id, items: [{ produkId: produkRace.id, qty: 1 }], metode: "EWALLET", accountId: akunRace2.id, idempotencyKey: `STR-R2-${ts}` }),
  ])
  const sukses = [r1, r2].filter((r) => r.ok).length
  cek("Tepat 1 transaksi sukses (stok 1)", sukses === 1, { r1: r1.error, r2: r2.error })
  cek("Stok race habis (0)", (await prisma.kantinProduk.findUnique({ where: { id: produkRace.id }, select: { stok: true } }))?.stok === 0)
  const gagalRace = r1.ok ? r2 : r1
  const akunGagal = r1.ok ? akunRace2 : akunRace1
  const saldoSebelumGagal = r1.ok ? saldoSebelumRace2 : saldoSebelumRace1
  const saldoAkhirGagal = (await prisma.walletAccount.findUnique({ where: { id: akunGagal.id }, select: { saldo: true } }))?.saldo
  cek("Kompensasi: saldo yang kalah kembali utuh", gagalRace.ok ? true : saldoAkhirGagal === saldoSebelumGagal, { saldoAkhirGagal, saldoSebelumGagal })
  const saldoMenang = (await prisma.walletAccount.findUnique({ where: { id: (r1.ok ? akunRace1 : akunRace2).id }, select: { saldo: true } }))?.saldo
  const saldoSebelumMenang = r1.ok ? saldoSebelumRace1 : saldoSebelumRace2
  cek("Pemenang terdebit 5.000", saldoMenang === saldoSebelumMenang - 5_000, { saldoMenang, saldoSebelumMenang })

  // ── 16. Refund sebagian → saldo naik + jurnal refund ────────────────
  console.log("\n─ SKENARIO 16: Refund sebagian ─")
  const sebelumRefund = (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo ?? 0
  const ref1 = await refundKantin({ transaksiId: byr1.transaksiId!, jumlah: 5_000, alasan: "Es hangat", keDompet: true, actorUserId: bendaharaU.id })
  cek("Refund sukses", ref1.ok)
  cek("Saldo naik 5.000", ((await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo ?? 0) === sebelumRefund + 5_000)
  cek("Baris KantinRefund tercatat", Boolean(await prisma.kantinRefund.findUnique({ where: { id: ref1.refundId! } })))
  const refDup = await refundKantin({ transaksiId: byr1.transaksiId!, jumlah: 5_000, alasan: "Es hangat", keDompet: true, actorUserId: bendaharaU.id })
  cek("Refund duplikat (key sama) tidak dobel kredit", refDup.ok)
  cek("Saldo naik hanya sekali", ((await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo ?? 0) === sebelumRefund + 5_000)
  cek("Refund melebihi total transaksi ditolak", !(await refundKantin({ transaksiId: byr1.transaksiId!, jumlah: 999_999, alasan: "Terlalu besar", keDompet: true, actorUserId: bendaharaU.id })).ok)

  // ── 17. Batal transaksi → stok kembali + saldo kembali ──────────────
  console.log("\n─ SKENARIO 17: Pembatalan transaksi ─")
  const byrBatal = await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, items: [{ produkId: produkA.id, qty: 1 }], metode: "EWALLET", accountId: dompet1.id, idempotencyKey: `STR-T17-${ts}` })
  const stokSebelumBatal = (await prisma.kantinProduk.findUnique({ where: { id: produkA.id }, select: { stok: true } }))?.stok
  const saldoSebelumBatal = (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo
  const batal = await batalTransaksiKantin({ transaksiId: byrBatal.transaksiId!, actorUserId: bendaharaU.id, alasan: "Salah input pesanan" })
  cek("Pembatalan sukses", batal.ok)
  cek("Status DIBATALKAN", (await prisma.kantinTransaksi.findUnique({ where: { id: byrBatal.transaksiId! }, select: { status: true } }))?.status === "DIBATALKAN")
  cek("Stok kembali +1", (await prisma.kantinProduk.findUnique({ where: { id: produkA.id }, select: { stok: true } }))?.stok === (stokSebelumBatal ?? 0) + 1)
  cek("Saldo e-wallet kembali", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === (saldoSebelumBatal ?? 0) + 10_000)
  cek("Batal tanpa alasan ditolak", !(await batalTransaksiKantin({ transaksiId: byr1.transaksiId!, actorUserId: bendaharaU.id, alasan: "x" })).ok)

  // ── 18. Shift buka/tutup + hitung kas ───────────────────────────────
  console.log("\n─ SKENARIO 18: Shift kasir ─")
  const sh1 = await bukaShift({ outletId: outlet.id, kasirUserId: kasirU.id, saldoAwal: 20_000 })
  cek("Buka shift sukses", sh1.ok && Boolean(sh1.shiftId))
  const sh1dup = await bukaShift({ outletId: outlet.id, kasirUserId: kasirU.id, saldoAwal: 20_000 })
  cek("Buka shift idempoten (shift aktif sama)", sh1dup.shiftId === sh1.shiftId)
  await checkoutKantin({ outletId: outlet.id, kasirUserId: kasirU.id, shiftId: sh1.shiftId, items: [{ produkId: produkB.id, qty: 1 }], metode: "TUNAI", idempotencyKey: `STR-T18-${ts}` })
  const tutup = await tutupShift({ shiftId: sh1.shiftId!, kasirUserId: kasirU.id, kasAkhir: 22_000 })
  cek("Tutup shift sukses + selisih -1.000", tutup.ok && tutup.selisih === -1_000)
  cek("Status shift TUTUP", (await prisma.kantinShift.findUnique({ where: { id: sh1.shiftId! }, select: { status: true } }))?.status === "TUTUP")
  cek("Tutup shift dua kali ditolak", !(await tutupShift({ shiftId: sh1.shiftId!, kasirUserId: kasirU.id, kasAkhir: 22_000 })).ok)
  cek("Kasir lain tidak bisa tutup shift orang", !(await tutupShift({ shiftId: (await bukaShift({ outletId: outlet.id, kasirUserId: kasir2U.id, saldoAwal: 0 })).shiftId!, kasirUserId: kasirU.id, kasAkhir: 0 })).ok)

  // ── 19. Billing: sekolah lunas + pondok cicilan; audit akhir ────────
  console.log("\n─ SKENARIO 19: Billing sekolah & pondok + audit akhir ─")
  const invSekolah = await buatInvoice({ userId: santri1u.id, jenisKode: "SPP", periode: "2026-10", nominal: 50_000, createdBy: bendaharaU.id })
  cek("Invoice SPP sekolah dibuat", invSekolah.ok)
  const saldoSebelumSpp = (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo ?? 0
  const bayarSpp = await bayarInvoice({ invoiceId: invSekolah.invoiceId!, jumlah: 50_000, metode: "EWALLET", idempotencyKey: `bayar-spp-${ts}`, actorUserId: santri1u.id, accountId: dompet1.id })
  cek("Bayar SPP e-wallet sukses", bayarSpp.ok && bayarSpp.status === "BERHASIL")
  cek("Invoice LUNAS", (await prisma.invoiceTagihan.findUnique({ where: { id: invSekolah.invoiceId! }, select: { status: true, sisa: true } }))?.status === "LUNAS")
  cek("Jurnal pembayaran sekolah berimbang", await jurnalBerimbang("PembayaranTagihan", bayarSpp.pembayaranId!))
  const ps = await prisma.pembayaranTagihan.findUnique({ where: { idempotencyKey: `bayar-spp-${ts}` }, select: { id: true, status: true } })
  const bayarSppDup = await bayarInvoice({ invoiceId: invSekolah.invoiceId!, jumlah: 50_000, metode: "EWALLET", idempotencyKey: `bayar-spp-${ts}`, actorUserId: santri1u.id, accountId: dompet1.id })
  cek("Bayar idempoten (key sama → row sama)", bayarSppDup.ok && bayarSppDup.pembayaranId === ps?.id)
  cek("Saldo berkurang tepat 50.000 (tidak dobel)", (await prisma.walletAccount.findUnique({ where: { id: dompet1.id }, select: { saldo: true } }))?.saldo === saldoSebelumSpp - 50_000, { saldoSebelumSpp })

  const invPondok = await buatInvoice({ userId: santri2u.id, jenisKode: "ASRAMA", periode: "2026-10", nominal: 60_000, createdBy: bendaharaU.id })
  cek("Invoice ASRAMA pondok dibuat", invPondok.ok)
  const bayarCicil = await bayarInvoice({ invoiceId: invPondok.invoiceId!, jumlah: 20_000, metode: "TUNAI", idempotencyKey: `bayar-cicil-${ts}`, actorUserId: santri2u.id })
  cek("Cicilan tunai → PENDING (menunggu verifikasi)", bayarCicil.ok && bayarCicil.status === "PENDING")
  cek("Invoice SEBAGIAN (belum dihitung sebelum verifikasi)", (await prisma.invoiceTagihan.findUnique({ where: { id: invPondok.invoiceId! }, select: { status: true } }))?.status === "BELUM_DIBAYAR")
  const verCicil = await verifikasiPembayaranTagihan({ pembayaranId: bayarCicil.pembayaranId!, verifiedBy: bendaharaU.id, setujui: true })
  cek("Verifikasi cicilan sukses", verCicil.ok && verCicil.status === "BERHASIL")
  cek("Invoice SEBAGIAN (sisa 40.000)", (await prisma.invoiceTagihan.findUnique({ where: { id: invPondok.invoiceId! }, select: { status: true, sisa: true } }))?.status === "SEBAGIAN")
  cek("Jurnal pembayaran pondok berimbang", await jurnalBerimbang("PembayaranTagihan", bayarCicil.pembayaranId!))
  const bayarSisa = await bayarInvoice({ invoiceId: invPondok.invoiceId!, jumlah: 40_000, metode: "TUNAI", idempotencyKey: `bayar-sisa-${ts}`, actorUserId: santri2u.id })
  await verifikasiPembayaranTagihan({ pembayaranId: bayarSisa.pembayaranId!, verifiedBy: bendaharaU.id, setujui: true })
  cek("Pelunasan sisa → LUNAS", (await prisma.invoiceTagihan.findUnique({ where: { id: invPondok.invoiceId! }, select: { status: true } }))?.status === "LUNAS")
  cek("Invoice lunas tidak bisa dibayar lagi", !(await bayarInvoice({ invoiceId: invPondok.invoiceId!, jumlah: 1_000, metode: "TUNAI", idempotencyKey: `bayar-lunas-${ts}`, actorUserId: santri2u.id })).ok)
  const invCek = await buatInvoice({ userId: santri2u.id, jenisKode: "KEGIATAN", periode: "2026-11", nominal: 10_000, createdBy: bendaharaU.id })
  cek("Bayar melebihi sisa ditolak", !(await bayarInvoice({ invoiceId: invCek.invoiceId!, jumlah: 20_000, metode: "TUNAI", idempotencyKey: `bayar-lebih-${ts}`, actorUserId: santri2u.id })).ok)

  // Konsistensi akhir semua dompet
  const kons1 = await verifikasiKonsistensiSaldo(dompet1.id)
  const kons2 = await verifikasiKonsistensiSaldo(dompet2.id)
  cek("Konsistensi akhir dompet1 (ledger == materialisasi)", kons1.konsisten, kons1)
  cek("Konsistensi akhir dompet2", kons2.konsisten, kons2)

  // Seluruh jurnal keuangan berimbang
  const semuaJurnal = await prisma.jurnalUmum.findMany({ where: { createdAt: { gte: awal } }, select: { id: true, nomor: true } })
  let jurnalOke = true
  for (const j of semuaJurnal) {
    const items = await prisma.jurnalItem.findMany({ where: { jurnalId: j.id }, select: { debit: true, kredit: true } })
    const d = items.reduce((s, i) => s + i.debit, 0)
    const k = items.reduce((s, i) => s + i.kredit, 0)
    if (d !== k) { jurnalOke = false; console.log(`    Jurnal tidak berimbang: ${j.nomor} (D=${d} K=${k})`) }
  }
  cek(`Semua ${semuaJurnal.length} jurnal berimbang (debit == kredit)`, jurnalOke && semuaJurnal.length > 0)

  // Notifikasi wali & pemilik dompet (fire-and-forget → beri waktu)
  await tidur(800)
  const notifTopup = await prisma.notification.count({ where: { eventKey: `topup-ok:${topup1.topupId}`, userId: { in: [santri1u.id, wali1u.id] } } })
  cek("Notifikasi top-up terkirim ke pemilik + wali", notifTopup >= 2, { notifTopup })
  const notifKantin = await prisma.notification.count({ where: { eventKey: `kantin:${byr1.transaksiId}` } })
  cek("Notifikasi pembelian kantin terkirim", notifKantin >= 1)
  const notifTagihan = await prisma.notification.count({ where: { eventKey: `tagihan-bayar:${bayarSpp.pembayaranId}` } })
  cek("Notifikasi pembayaran tagihan terkirim", notifTagihan >= 1)

  // Audit log tercatat
  const auditTopup = await prisma.auditLog.count({ where: { action: "TOPUP_DIVERIFIKASI", entityId: topup1.topupId } })
  const auditKantin = await prisma.auditLog.count({ where: { action: "KANTIN_TRANSAKSI", entityId: byr1.transaksiId } })
  cek("Audit log top-up & kantin tercatat", auditTopup >= 1 && auditKantin >= 1)

  // RBAC guard: melempar di luar request (default deny)
  await expectThrow("requireWaliKeuangan melempar di luar request", () => requireWaliKeuangan())
  await expectThrow("requirePetugasKeuangan melempar di luar request", () => requirePetugasKeuangan("KASIR"))
  await expectThrow("requireMonitoringKeuanganPondok melempar di luar request", () => requireMonitoringKeuanganPondok())

  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`)
  process.exitCode = fail > 0 ? 1 : 0
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) }).finally(() => prisma.$disconnect())
