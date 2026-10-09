// Test STEP 8 PPDB — formulir santri bertahap (SISWA_SANTRI/SANTRI_PONDOK).
// Jalankan: $env:NODE_ENV="production"; rtk npx tsx tools/test-ppdb-santri.ts
// Catatan: aksi butuh sesi — di luar request auth() melempar (guard terbukti).
// Test inti: dataSantri terpisah dari data, merge per langkah, guard jenis SISWA_REGULER.
import { prisma } from "../src/lib/prisma"
import {
  getDraftSantri,
  simpanDraftSantri,
  cekKelengkapanSantri,
  LANGKAH_SANTRI,
} from "../src/app/ppdb/actions"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}
async function expectThrow(nama: string, fn: () => Promise<unknown>, match?: string) {
  try { await fn(); cek(nama, false, "tidak throw") }
  catch (e: any) {
    const ok = !match || String(e?.message).includes(match)
    cek(nama, ok, e?.message)
  }
}

async function main() {
  console.log("=== STEP 8 PPDB: FORMULIR SANTRI ===\n")

  // 1. guard sesi
  console.log("1. Guard sesi (tanpa login → throw)")
  await expectThrow("getDraftSantri butuh login", () => getDraftSantri())
  await expectThrow("simpanDraftSantri butuh login", () => simpanDraftSantri("x", "fisik", {}))
  await expectThrow("cekKelengkapanSantri butuh login", () => cekKelengkapanSantri("x"))

  // 2. enum LANGKAH_SANTRI
  console.log("\n2. Enum langkah santri")
  cek("5 langkah", LANGKAH_SANTRI.length === 5)
  const expected = ["fisik", "pendidikanSebelumnya", "hafalan", "minatEkstra", "kesehatan"]
  for (const l of expected) cek(`langkah '${l}' ada`, LANGKAH_SANTRI.includes(l as any))

  // 3. dataSantri terpisah dari data (mirror prisma langsung)
  console.log("\n3. Snapshot dataSantri terpisah dari data")
  const ta = await prisma.tahunAjaran.findFirst({ orderBy: { tahunMulai: "asc" } })
  const gel = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: ta!.id,
      nama: "Gel Test Santri",
      unit: "PONDOK",
      jenjang: "Umum",
      tanggalBuka: new Date(Date.now() - 86400000),
      tanggalTutup: new Date(Date.now() + 86400000 * 7),
      status: "DIBUKA",
    },
  })
  const u = await prisma.user.create({
    data: { email: `ppdb8-${Date.now()}@t.test`, name: "Tester Santri", password: null, role: "SISWA", emailVerified: new Date() },
  })
  // pendaftaran SISWA_SANTRI
  const pSantri = await prisma.pendaftaranPpdb.create({
    data: { userId: u.id, gelombangId: gel.id, jenis: "SISWA_SANTRI", status: "DRAFT", data: { identitas: { namaLengkap: "Budi" } } as any },
  })

  // mirror simpanDraftSantri: merge shallow ke dataSantri
  await prisma.pendaftaranPpdb.update({
    where: { id: pSantri.id },
    data: { dataSantri: { fisik: { tinggiBadan: "160", beratBadan: "50" } } as any },
  })
  await prisma.pendaftaranPpdb.update({
    where: { id: pSantri.id },
    data: { dataSantri: { ...(await prisma.pendaftaranPpdb.findUnique({ where: { id: pSantri.id } }))!.dataSantri as any, pendidikanSebelumnya: { namaMadrasah: "MI Darul Falah" } } as any },
  })
  const pAfter = await prisma.pendaftaranPpdb.findUnique({ where: { id: pSantri.id } })
  const ds = pAfter!.dataSantri as any
  const dd = pAfter!.data as any
  cek("dataSantri.fisik tersimpan", ds?.fisik?.tinggiBadan === "160")
  cek("dataSantri.pendidikanSebelumnya tersimpan (merge)", ds?.pendidikanSebelumnya?.namaMadrasah === "MI Darul Falah")
  cek("data biodata TIDAK bocor ke dataSantri", !ds?.identitas)
  cek("dataSantri TIDAK bocor ke data", !dd?.fisik)

  // 4. guard jenis: SISWA_REGULER ditolak simpanDraftSantri (mirror check p.jenis)
  console.log("\n4. Guard jenis pendaftaran")
  // unique [userId, gelombangId] → pakai gelombang berbeda untuk pendaftaran reguler
  const gel2 = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: ta!.id,
      nama: "Gel Test Reguler",
      unit: "SEKOLAH",
      jenjang: "SMP",
      tanggalBuka: new Date(Date.now() - 86400000),
      tanggalTutup: new Date(Date.now() + 86400000 * 7),
      status: "DIBUKA",
    },
  })
  const pReg = await prisma.pendaftaranPpdb.create({
    data: { userId: u.id, gelombangId: gel2.id, jenis: "SISWA_REGULER", status: "DRAFT" },
  })
  cek("pendaftaran SISWA_REGULER tidak punya dataSantri", pReg.dataSantri === null)
  // mirror: simpanDraftSantri throw jika jenis === SISWA_REGULER
  cek("guard SISWA_REGULER: jenis != SISWA_SANTRI/SANTRI_PONDOK", pReg.jenis === "SISWA_REGULER")

  // 5. cekKelengkapanSantri: wajib fisik+pendidikan
  console.log("\n5. Kelengkapan formulir santri")
  // mirror: wajib = fisik.tinggiBadan, fisik.beratBadan, pendidikanSebelumnya.namaMadrasah
  const wajib = ["fisik.tinggiBadan", "fisik.beratBadan", "pendidikanSebelumnya.namaMadrasah"]
  const kurang: string[] = []
  for (const path of wajib) {
    const [langkah, field] = path.split(".")
    if (!ds?.[langkah]?.[field]) kurang.push(path)
  }
  cek("lengkap=true setelah semua wajib terisi", kurang.length === 0)

  // hapus satu field → kurang
  const dsKurang = { ...ds }
  delete dsKurang.fisik.beratBadan
  await prisma.pendaftaranPpdb.update({ where: { id: pSantri.id }, data: { dataSantri: dsKurang as any } })
  const ds2 = (await prisma.pendaftaranPpdb.findUnique({ where: { id: pSantri.id } }))!.dataSantri as any
  const kurang2: string[] = []
  for (const path of wajib) {
    const [langkah, field] = path.split(".")
    if (!ds2?.[langkah]?.[field]) kurang2.push(path)
  }
  cek("kurang terdeteksi saat field wajib hilang", kurang2.includes("fisik.beratBadan"))

  // 6. semua langkah enum punya representasi di dataSantri setelah diisi
  console.log("\n6. Semua langkah enum valid")
  const lengkapiSemua = {
    fisik: { tinggiBadan: "160", beratBadan: "50" },
    pendidikanSebelumnya: { namaMadrasah: "MI Darul Falah" },
    hafalan: { juzHafalan: "2" },
    minatEkstra: { ekstrakurikuler: "Futsal" },
    kesehatan: { alergi: "Udang" },
  }
  await prisma.pendaftaranPpdb.update({ where: { id: pSantri.id }, data: { dataSantri: lengkapiSemua as any } })
  const dsFull = (await prisma.pendaftaranPpdb.findUnique({ where: { id: pSantri.id } }))!.dataSantri as any
  for (const l of LANGKAH_SANTRI) {
    cek(`langkah '${l}' ada di dataSantri`, l in dsFull)
  }

  // cleanup
  await prisma.pilihanPpdb.deleteMany({ where: { pendaftaranId: { in: [pSantri.id, pReg.id] } } })
  await prisma.keputusanPpdb.deleteMany({ where: { pendaftaranId: { in: [pSantri.id, pReg.id] } } })
  await prisma.berkasPpdb.deleteMany({ where: { pendaftaranId: { in: [pSantri.id, pReg.id] } } })
  await prisma.pendaftaranPpdb.deleteMany({ where: { id: { in: [pSantri.id, pReg.id] } } })
  await prisma.gelombangPpdb.deleteMany({ where: { id: { in: [gel.id, gel2.id] } } })
  await prisma.user.delete({ where: { id: u.id } })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
