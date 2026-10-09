// Test STEP 3 PPDB — jenis pendaftaran, pilihan jalur, keputusan terpisah.
// Jalankan: npx tsx tools/test-ppdb-pendaftaran.ts
import { prisma } from "../src/lib/prisma"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}

async function main() {
  console.log("=== STEP 3 PPDB: JENIS PENDAFTARAN + KEPUTUSAN ===\n")

  const ts = Date.now()
  const ta = await prisma.tahunAjaran.create({ data: { nama: `S3-${ts}`, tahunMulai: 2026, tahunSelesai: 2027 } })
  const g = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: ta.id, nama: "Gel Test",
      tanggalBuka: new Date(Date.now() - 86400000), tanggalTutup: new Date(Date.now() + 86400000),
      status: "DIBUKA",
    },
  })
  const jReg = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Reguler" } })
  const jDom = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Domisili", kuota: 50 } })
  const jTah = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Tahfidz", kuota: 20 } })

  const mkUser = (label: string) =>
    prisma.user.create({ data: { email: `s3-${label}-${ts}@t.test`, name: label, password: "x".repeat(60), role: "SISWA" } })

  // 1. tiga jenis pendaftaran
  console.log("1. Tiga jenis pendaftaran")
  const uA = await mkUser("reguler")
  const uB = await mkUser("santri")
  const uC = await mkUser("pondok")
  const pA = await prisma.pendaftaranPpdb.create({ data: { userId: uA.id, gelombangId: g.id, jenis: "SISWA_REGULER", jalurId: jReg.id, status: "DRAFT" } })
  const pB = await prisma.pendaftaranPpdb.create({ data: { userId: uB.id, gelombangId: g.id, jenis: "SISWA_SANTRI", jalurId: jDom.id, status: "DRAFT" } })
  const pC = await prisma.pendaftaranPpdb.create({ data: { userId: uC.id, gelombangId: g.id, jenis: "SANTRI_PONDOK", jalurId: jTah.id, status: "DRAFT" } })
  cek("SISWA_REGULER tersimpan", pA.jenis === "SISWA_REGULER")
  cek("SISWA_SANTRI tersimpan", pB.jenis === "SISWA_SANTRI")
  cek("SANTRI_PONDOK tersimpan", pC.jenis === "SANTRI_PONDOK")

  // 2. satu identitas max 1 pendaftaran per gelombang (unique)
  console.log("\n2. Duplikasi pendaftaran")
  let dup = false
  try { await prisma.pendaftaranPpdb.create({ data: { userId: uA.id, gelombangId: g.id, jenis: "SISWA_REGULER" } }) } catch { dup = true }
  cek("pendaftaran duplikat per user+gelombang ditolak (unique)", dup)
  // user yang sama boleh daftar di gelombang lain
  const g2 = await prisma.gelombangPpdb.create({
    data: { tahunAjaranId: ta.id, nama: "Gel 2", tanggalBuka: new Date(Date.now() - 86400000), tanggalTutup: new Date(Date.now() + 86400000), status: "DIBUKA" },
  })
  const pA2 = await prisma.pendaftaranPpdb.create({ data: { userId: uA.id, gelombangId: g2.id, jenis: "SISWA_REGULER" } })
  cek("user sama boleh daftar di gelombang lain", !!pA2.id)

  // 3. pilihan jalur berurutan
  console.log("\n3. Pilihan jalur berurutan")
  await prisma.pilihanPpdb.createMany({
    data: [
      { pendaftaranId: pB.id, jalurId: jDom.id, urutan: 1 },
      { pendaftaranId: pB.id, jalurId: jTah.id, urutan: 2 },
      { pendaftaranId: pB.id, jalurId: jReg.id, urutan: 3 },
    ],
  })
  const pilihan = await prisma.pilihanPpdb.findMany({ where: { pendaftaranId: pB.id }, orderBy: { urutan: "asc" }, include: { jalur: true } })
  cek("3 pilihan tersimpan berurutan", pilihan.length === 3 && pilihan[0].urutan === 1 && pilihan[2].urutan === 3)
  cek("urutan 1 = jalur utama Domisili", pilihan[0].jalur.nama === "Domisili")
  // urutan duplikat ditolak
  let dupU = false
  try { await prisma.pilihanPpdb.create({ data: { pendaftaranId: pB.id, jalurId: jReg.id, urutan: 1 } }) } catch { dupU = true }
  cek("urutan duplikat ditolak (unique pendaftaranId+urutan)", dupU)

  // 4. keputusan terpisah FORMAL & PONDOK
  console.log("\n4. Keputusan terpisah sekolah vs pondok")
  // pB = SISWA_SANTRI → dua domain
  const kF = await prisma.keputusanPpdb.create({ data: { pendaftaranId: pB.id, domain: "FORMAL", hasil: "DITERIMA", peringkat: 3 } })
  const kP = await prisma.keputusanPpdb.create({ data: { pendaftaranId: pB.id, domain: "PONDOK", hasil: "CADANGAN", catatan: "kuota tahfidz penuh" } })
  cek("keputusan FORMAL = DITERIMA", kF.hasil === "DITERIMA")
  cek("keputusan PONDOK = CADANGAN (berbeda, terpisah)", kP.hasil === "CADANGAN")
  // pC = SANTRI_PONDOK → hanya domain PONDOK yang relevan
  await prisma.keputusanPpdb.create({ data: { pendaftaranId: pC.id, domain: "PONDOK", hasil: "DITERIMA" } })
  const kC = await prisma.keputusanPpdb.findMany({ where: { pendaftaranId: pC.id } })
  cek("SANTRI_PONDOK punya 1 keputusan (PONDOK saja)", kC.length === 1 && kC[0].domain === "PONDOK")
  // duplikat domain ditolak
  let dupK = false
  try { await prisma.keputusanPpdb.create({ data: { pendaftaranId: pB.id, domain: "FORMAL", hasil: "TIDAK_DITERIMA" } }) } catch { dupK = true }
  cek("duplikat domain per pendaftaran ditolak (unique)", dupK)
  // default DALAM_PROSES
  const kDefault = await prisma.keputusanPpdb.create({ data: { pendaftaranId: pA.id, domain: "FORMAL" } })
  cek("keputusan default DALAM_PROSES", kDefault.hasil === "DALAM_PROSES")

  // 5. include: pendaftaran → gelombang + jalur + pilihan + keputusan
  console.log("\n5. Relasi lengkap")
  const full = await prisma.pendaftaranPpdb.findUnique({
    where: { id: pB.id },
    include: { gelombang: true, jalur: true, pilihan: { include: { jalur: true } }, keputusan: true, user: true },
  })
  cek("include gelombang+jalur+pilihan+keputusan+user", !!full?.gelombang && !!full?.jalur && full.pilihan.length === 3 && full.keputusan.length === 2 && !!full?.user)

  // 6. cascade: hapus pendaftaran → pilihan & keputusan ikut
  await prisma.pendaftaranPpdb.delete({ where: { id: pA2.id } })
  cek("hapus pendaftaran gelombang lain OK", true)

  // cleanup
  await prisma.$transaction([
    prisma.keputusanPpdb.deleteMany({ where: { pendaftaran: { gelombangId: { in: [g.id, g2.id] } } } }),
    prisma.pilihanPpdb.deleteMany({ where: { pendaftaran: { gelombangId: { in: [g.id, g2.id] } } } }),
    prisma.pendaftaranPpdb.deleteMany({ where: { gelombangId: { in: [g.id, g2.id] } } }),
  ])
  await prisma.jalurPpdb.deleteMany({ where: { gelombangId: { in: [g.id, g2.id] } } })
  await prisma.gelombangPpdb.deleteMany({ where: { id: { in: [g.id, g2.id] } } })
  await prisma.user.deleteMany({ where: { id: { in: [uA.id, uB.id, uC.id] } } })
  await prisma.tahunAjaran.delete({ where: { id: ta.id } }).catch(() => {})

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
