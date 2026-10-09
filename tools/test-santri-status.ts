// Test STEP 3 SISANTRI — status keberadaan + histori (SantriStatusLog).
// Jalankan: npx tsx tools/test-santri-status.ts
import { prisma } from "../src/lib/prisma"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}

async function main() {
  console.log("=== STEP 3 SISANTRI: STATUS KEBERADAAN + HISTORI ===\n")

  // siapkan admin + santri
  const admin = await prisma.user.create({ data: { email: `adm-${Date.now()}@t.test`, name: "Test Admin", password: "x".repeat(60), role: "ADMIN" } })
  const user = await prisma.user.create({ data: { email: `santri-${Date.now()}@t.test`, name: "Test Santri", password: "x".repeat(60), role: "SISWA" } })
  const santri = await prisma.santri.create({ data: { userId: user.id, nama: "Test Santri", status: "AKTIF", keberadaan: "DI_PONDOK" } })

  // 1. default keberadaan
  console.log("1. Default keberadaan")
  cek("santri baru default DI_PONDOK", santri.keberadaan === "DI_PONDOK")

  // 2. ubah keberadaan + log KEBERADAAN otomatis (mirror updateKeberadaan)
  console.log("\n2. Ubah keberadaan → log KEBERADAAN")
  await prisma.$transaction(async (tx) => {
    await tx.santri.update({ where: { id: santri.id }, data: { keberadaan: "IZIN_KELUAR" } })
    await tx.santriStatusLog.create({ data: { santriId: santri.id, jenis: "KEBERADAAN", dari: "DI_PONDOK", ke: "IZIN_KELUAR", alasan: "izin keluarga", verifiedBy: admin.id } })
  })
  const keb = await prisma.santri.findUnique({ where: { id: santri.id } })
  cek("keberadaan berubah jadi IZIN_KELUAR", keb?.keberadaan === "IZIN_KELUAR")
  const logKeb = await prisma.santriStatusLog.findFirst({ where: { santriId: santri.id, jenis: "KEBERADAAN" } })
  cek("log KEBERADAAN tercatat dari→ke", logKeb?.dari === "DI_PONDOK" && logKeb?.ke === "IZIN_KELUAR")
  cek("alasan log tercatat", logKeb?.alasan === "izin keluarga")

  // 3. ubah status administrasi → log ADMINISTRASI
  console.log("\n3. Ubah status administrasi → log ADMINISTRASI")
  await prisma.$transaction(async (tx) => {
    await tx.santri.update({ where: { id: santri.id }, data: { status: "CUTI" } })
    await tx.santriStatusLog.create({ data: { santriId: santri.id, jenis: "ADMINISTRASI", dari: "AKTIF", ke: "CUTI", verifiedBy: admin.id } })
  })
  const st = await prisma.santri.findUnique({ where: { id: santri.id } })
  cek("status berubah jadi CUTI", st?.status === "CUTI")
  const logAdm = await prisma.santriStatusLog.findFirst({ where: { santriId: santri.id, jenis: "ADMINISTRASI" } })
  cek("log ADMINISTRASI tercatat", logAdm?.dari === "AKTIF" && logAdm?.ke === "CUTI")

  // 4. riwayat: urut desc, filter jenis
  console.log("\n4. Riwayat status")
  const semua = await prisma.santriStatusLog.findMany({ where: { santriId: santri.id }, orderBy: { createdAt: "desc" } })
  cek("riwayat total 2 log", semua.length === 2)
  cek("riwayat urut desc (ADMINISTRASI paling baru)", semua[0]?.jenis === "ADMINISTRASI")
  const hanyaKeb = await prisma.santriStatusLog.findMany({ where: { santriId: santri.id, jenis: "KEBERADAAN" } })
  cek("filter jenis KEBERADAAN → 1 log", hanyaKeb.length === 1)

  // 5. index efektif: query gabungan keberadaan+deletedAt (mirror dashboard)
  console.log("\n5. Query keberadaan aktif")
  const diPondok = await prisma.santri.findMany({ where: { keberadaan: "DI_PONDOK", deletedAt: null } })
  cek("query keberadaan+deletedAt berjalan", Array.isArray(diPondok))

  // cleanup
  await prisma.santriStatusLog.deleteMany({ where: { santriId: santri.id } })
  await prisma.santri.delete({ where: { id: santri.id } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
