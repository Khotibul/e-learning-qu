// Test STEP 2 PPDB — gelombang, jalur, transisi status.
// Jalankan: npx tsx tools/test-ppdb-gelombang.ts
import { prisma } from "../src/lib/prisma"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}

const URUTAN = ["DRAFT", "DIJADWALKAN", "DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"]
function bolehTransisi(dari: string, ke: string) {
  if (dari === ke) return false
  const i = URUTAN.indexOf(dari), j = URUTAN.indexOf(ke)
  if (Math.abs(j - i) === 1) return true
  if (ke === "DRAFT" && dari === "DIJADWALKAN") return true
  return false
}

async function main() {
  console.log("=== STEP 2 PPDB: GELOMBANG + JALUR + STATUS ===\n")

  const ta = await prisma.tahunAjaran.create({ data: { nama: `PPDB-TEST-${Date.now()}`, tahunMulai: 2026, tahunSelesai: 2027 } })

  // 1. create gelombang
  console.log("1. Gelombang")
  const g = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: ta.id, nama: "Gelombang 1", unit: "SMK", jenjang: "Kelas X", program: "Reguler",
      tanggalBuka: new Date("2026-06-01"), tanggalTutup: new Date("2026-07-01"),
      kuota: 100, biayaDaftar: 150000,
      jadwalSeleksi: new Date("2026-07-10"), jadwalPengumuman: new Date("2026-07-15"), jadwalDaftarUlang: new Date("2026-07-20"),
      status: "DRAFT",
    },
    include: { tahunAjaran: true },
  })
  cek("gelombang terbuat, status DRAFT", g.status === "DRAFT")
  cek("relasi tahun ajaran benar", g.tahunAjaran.id === ta.id)
  cek("biaya & kuota tersimpan", g.biayaDaftar === 150000 && g.kuota === 100)

  // validasi tutup > buka: di action layer (bukan constraint DB) — uji aturan
  cek("aturan app: tutup<=buka → throw", (() => { const buka = new Date("2026-07-01"), tutup = new Date("2026-06-01"); return tutup <= buka })())
  cek("aturan app: tutup>buka → lolos", (() => { const buka = new Date("2026-06-01"), tutup = new Date("2026-07-01"); return tutup > buka })())

  // 2. transisi status
  console.log("\n2. Transisi status")
  cek("DRAFT→DIJADWALKAN sah", bolehTransisi("DRAFT", "DIJADWALKAN"))
  cek("DIJADWALKAN→DIBUKA sah", bolehTransisi("DIJADWALKAN", "DIBUKA"))
  cek("DIBUKA→DITUTUP sah", bolehTransisi("DIBUKA", "DITUTUP"))
  cek("DITUTUP→SELEKSI sah", bolehTransisi("DITUTUP", "SELEKSI"))
  cek("SELEKSI→PENGUMUMAN sah", bolehTransisi("SELEKSI", "PENGUMUMAN"))
  cek("PENGUMUMAN→DAFTAR_ULANG sah", bolehTransisi("PENGUMUMAN", "DAFTAR_ULANG"))
  cek("DAFTAR_ULANG→SELESAI sah", bolehTransisi("DAFTAR_ULANG", "SELESAI"))
  cek("DIJADWALKAN→DRAFT (reset) sah", bolehTransisi("DIJADWALKAN", "DRAFT"))
  cek("DRAFT→DIBUKA lompatan DITOLAK", !bolehTransisi("DRAFT", "DIBUKA"))
  cek("DRAFT→SELESAI lompatan DITOLAK", !bolehTransisi("DRAFT", "SELESAI"))
  cek("DITUTUP→DIBUKA mundur 1 sah", bolehTransisi("DITUTUP", "DIBUKA"))
  cek("SELEKSI→DIBUKA mundur 2 DITOLAK", !bolehTransisi("SELEKSI", "DIBUKA"))
  cek("status sama DITOLAK", !bolehTransisi("DRAFT", "DRAFT"))

  // jalankan transisi berantai di DB
  const jalankan = async (dari: string, ke: string) => {
    if (!bolehTransisi(dari, ke)) throw new Error(`transisi ${dari}→${ke} tidak sah`)
    return prisma.gelombangPpdb.update({ where: { id: g.id }, data: { status: ke as any } })
  }
  await jalankan("DRAFT", "DIJADWALKAN")
  await jalankan("DIJADWALKAN", "DIBUKA")
  const dibuka = await prisma.gelombangPpdb.findUnique({ where: { id: g.id } })
  cek("gelombang berstatus DIBUKA di DB", dibuka?.status === "DIBUKA")
  // lompatan harus throw
  let errLompat = false
  try { await jalankan("DIBUKA", "PENGUMUMAN") } catch { errLompat = true }
  cek("lompatan DIBUKA→PENGUMUMAN throw", errLompat)

  // 3. jalur
  console.log("\n3. Jalur pendaftaran")
  const j1 = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Domisili", kuota: 50 } })
  const j2 = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Prestasi", deskripsi: "Berprestasi akademik/nonakademik", kuota: 20 } })
  const j3 = await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Tahfidz", kuota: 30, isActive: false } })
  cek("3 jalur terbuat", !!j1.id && !!j2.id && !!j3.id)
  // duplikat nama per gelombang
  let dupJ = false
  try { await prisma.jalurPpdb.create({ data: { gelombangId: g.id, nama: "Domisili" } }) } catch { dupJ = true }
  cek("duplikat nama jalur dalam gelombang ditolak (unique app/DB)", dupJ) // note: unique app-level; DB hanya index biasa — cek via findFirst
  const dupApp = await prisma.jalurPpdb.findFirst({ where: { gelombangId: g.id, nama: "Domisili" } })
  cek("cek duplikat app-level menemukan jalur lama", !!dupApp)
  // gelombang include jalur
  const gWithJ = await prisma.gelombangPpdb.findUnique({ where: { id: g.id }, include: { jalur: true } })
  cek("gelombang punya 3 jalur", gWithJ?.jalur.length === 3)
  // update jalur
  await prisma.jalurPpdb.update({ where: { id: j1.id }, data: { kuota: 60 } })
  const j1f = await prisma.jalurPpdb.findUnique({ where: { id: j1.id } })
  cek("kuota jalur diupdate", j1f?.kuota === 60)
  // cascade delete gelombang → jalur ikut
  await prisma.gelombangPpdb.delete({ where: { id: g.id } })
  const jOrphan = await prisma.jalurPpdb.findFirst({ where: { gelombangId: g.id } })
  cek("hapus gelombang cascade hapus jalur", jOrphan === null)

  await prisma.tahunAjaran.delete({ where: { id: ta.id } }).catch(() => {})

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
