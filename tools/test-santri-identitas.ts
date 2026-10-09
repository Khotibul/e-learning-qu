// Test STEP 2 SISANTRI — identitas terpadu: Santri + WaliSantri + SantriWali.
// Jalankan: npx tsx tools/test-santri-identitas.ts
import { prisma } from "../src/lib/prisma"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}

async function cleanup(userId?: string) {
  if (userId) {
    const santri = await prisma.santri.findFirst({ where: { userId } })
    if (santri) {
      await prisma.santriWali.deleteMany({ where: { santriId: santri.id } })
      await prisma.santri.delete({ where: { id: santri.id } }).catch(() => {})
    }
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }
  // wali sisa
  await prisma.waliSantri.deleteMany({ where: { nama: { startsWith: "TEST-WALI" } } })
}

async function main() {
  console.log("=== STEP 2 SISANTRI: IDENTITAS TERPADU ===\n")

  // ── 1. Santri NONFORMAL: buat User baru role SISWA + Santri ──
  console.log("1. Santri nonformal (tanpa siswa sekolah)")
  const email = `test-santri-${Date.now()}@elearningqu.test`
  const user = await prisma.user.create({
    data: { email, name: "Test Santri NF", password: "x".repeat(60), role: "SISWA" },
  })
  const nisNo = `TEST-NIS-${Date.now()}`
  const santriNF = await prisma.santri.create({
    data: { userId: user.id, nisNo, nama: "Test Santri NF", status: "AKTIF" },
  })
  cek("santri nonformal terbuat, status AKTIF", santriNF.status === "AKTIF")
  cek("santri terhubung ke user", (await prisma.santri.findUnique({ where: { id: santriNF.id }, include: { user: true } }))?.user.email === email)

  // duplikasi nisNo harus gagal
  let dupErr = false
  try { await prisma.santri.create({ data: { userId: user.id, nisNo, nama: "Dup" } }) } catch { dupErr = true }
  cek("duplikasi NISantri ditolak (unique)", dupErr)

  // ── 2. Santri SEKOLAH: link ke siswa existing ──
  console.log("\n2. Santri sekaligus siswa (existing siswa)")
  const siswa = await prisma.siswa.findFirst({ where: { deletedAt: null, santri: null } })
  if (siswa) {
    const santriSekolah = await prisma.santri.create({
      data: { userId: siswa.userId, siswaId: siswa.id, nama: siswa.nama, status: "AKTIF" },
    })
    cek("santri terhubung ke siswa", (await prisma.santri.findUnique({ where: { id: santriSekolah.id }, include: { siswa: true } }))?.siswa?.id === siswa.id)
    cek("siswa punya relasi santri", (await prisma.siswa.findUnique({ where: { id: siswa.id }, include: { santri: true } }))?.santri?.id === santriSekolah.id)
    // duplikasi siswaId harus gagal
    let dupS = false
    try { await prisma.santri.create({ data: { userId: siswa.userId, siswaId: siswa.id, nama: "Dup2" } }) } catch { dupS = true }
    cek("duplikasi siswaId ditolak (unique)", dupS)
    await prisma.santriWali.deleteMany({ where: { santriId: santriSekolah.id } })
    await prisma.santri.delete({ where: { id: santriSekolah.id } })
  } else {
    console.log("  SKIP: tidak ada siswa existing untuk uji (DB kosong)")
  }

  // ── 3. Wali + relasi SantriWali ──
  console.log("\n3. Wali santri + tautan")
  const wali = await prisma.waliSantri.create({
    data: { nama: "TEST-WALI-Ayah", hubungan: "AYAH", noTelp: "0812" },
  })
  cek("wali terbuat", !!wali.id)
  await prisma.santriWali.create({ data: { santriId: santriNF.id, waliId: wali.id, isPrimary: true } })
  const withWali = await prisma.santri.findUnique({ where: { id: santriNF.id }, include: { walis: { include: { wali: true } } } })
  cek("santri punya 1 wali", withWali?.walis.length === 1)
  cek("wali utama tercatat", withWali?.walis[0]?.isPrimary === true)
  // duplikasi relasi ditolak
  let dupW = false
  try { await prisma.santriWali.create({ data: { santriId: santriNF.id, waliId: wali.id } }) } catch { dupW = true }
  cek("duplikasi tautan santri-wali ditolak", dupW)
  // cascade hapus santri → tautan ikut hilang
  await prisma.santri.delete({ where: { id: santriNF.id } })
  const orphan = await prisma.santriWali.findFirst({ where: { waliId: wali.id } })
  cek("hapus santri cascade hapus tautan wali", orphan === null)

  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.waliSantri.deleteMany({ where: { nama: { startsWith: "TEST-WALI" } } })

  // ── 4. Filter pencarian (mirror getSantris where) ──
  console.log("\n4. Filter status & soft-delete")
  const u2 = await prisma.user.create({ data: { email: `t-${Date.now()}@t.test`, name: "Cuti", password: "x".repeat(60), role: "SISWA" } })
  const s2 = await prisma.santri.create({ data: { userId: u2.id, nama: "Santri Cuti", status: "CUTI" } })
  const found = await prisma.santri.findFirst({ where: { status: "CUTI", deletedAt: null, id: s2.id } })
  cek("filter status CUTI menemukan santri", found?.id === s2.id)
  await prisma.santri.update({ where: { id: s2.id }, data: { deletedAt: new Date() } })
  const gone = await prisma.santri.findFirst({ where: { id: s2.id, deletedAt: null } })
  cek("soft-delete menyembunyikan dari daftar aktif", gone === null)
  await prisma.santri.delete({ where: { id: s2.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: u2.id } }).catch(() => {})

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
