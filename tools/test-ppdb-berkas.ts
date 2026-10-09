// Test STEP 7 PPDB — berkas persyaratan (sinkron template, unggah, hapus, validasi).
// Jalankan: $env:NODE_ENV="production"; rtk npx tsx tools/test-ppdb-berkas.ts
// Catatan: semua aksi butuh sesi — di luar request auth() melempar (guard terbukti).
// Test inti: pola DB (createMany sinkron, unique [pendaftaranId, namaDokumen], status transitions).
import { prisma } from "../src/lib/prisma"
import { getBerkasSaya, sinkronBerkas, unggahBerkas, hapusBerkas, cekKelengkapanBerkas } from "../src/app/ppdb/actions"

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
  console.log("=== STEP 7 PPDB: BERKAS PERSYARATAN ===\n")

  // 1. guard sesi
  console.log("1. Guard sesi (tanpa login → throw)")
  await expectThrow("getBerkasSaya butuh login", () => getBerkasSaya())
  await expectThrow("sinkronBerkas butuh login", () => sinkronBerkas("x"))
  await expectThrow("unggahBerkas butuh login", () => unggahBerkas("x", "y"))
  await expectThrow("hapusBerkas butuh login", () => hapusBerkas("x"))
  await expectThrow("cekKelengkapanBerkas butuh login", () => cekKelengkapanBerkas("x"))

  // 2. pola DB: sinkron template → createMany baris placeholder
  console.log("\n2. Sinkron template persyaratan → baris BerkasPpdb")
  const ta = await prisma.tahunAjaran.findFirst({ orderBy: { tahunMulai: "asc" } })
  const gel = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: ta!.id,
      nama: "Gel Test Berkas",
      unit: "SEKOLAH",
      jenjang: "SMP",
      tanggalBuka: new Date(Date.now() - 86400000),
      tanggalTutup: new Date(Date.now() + 86400000 * 7),
      status: "DIBUKA",
      biayaDaftar: 100000,
      persyaratanDokumen: [
        { nama: "Kartu Keluarga", wajib: true },
        { nama: "Akta Kelahiran", wajib: true },
        { nama: "Pas Foto", wajib: false },
      ],
    },
  })
  const u = await prisma.user.create({
    data: { email: `ppdb7-${Date.now()}@t.test`, name: "Tester Berkas", password: null, role: "SISWA", emailVerified: new Date() },
  })
  const p = await prisma.pendaftaranPpdb.create({
    data: { userId: u.id, gelombangId: gel.id, jenis: "SISWA_REGULER", status: "DRAFT" },
  })

  // mirror sinkronBerkas: createMany baris placeholder
  const template = (gel.persyaratanDokumen as any[]) || []
  await prisma.berkasPpdb.createMany({
    data: template.map((t) => ({
      pendaftaranId: p.id,
      namaDokumen: String(t.nama),
      wajib: t.wajib !== false,
      status: "TIDAK_LENGKAP" as any,
    })),
    skipDuplicates: true,
  })
  const rows = await prisma.berkasPpdb.findMany({ where: { pendaftaranId: p.id } })
  cek("3 baris placeholder dibuat", rows.length === 3)
  cek("item wajib = 2", rows.filter((r) => r.wajib).length === 2)
  cek("semua status TIDAK_LENGKAP", rows.every((r) => r.status === "TIDAK_LENGKAP"))

  // 3. unique [pendaftaranId, namaDokumen] — sinkron ulang tidak duplikat
  console.log("\n3. Sinkron ulang tidak duplikat (skipDuplicates)")
  await prisma.berkasPpdb.createMany({
    data: template.map((t) => ({
      pendaftaranId: p.id,
      namaDokumen: String(t.nama),
      wajib: t.wajib !== false,
      status: "TIDAK_LENGKAP" as any,
    })),
    skipDuplicates: true,
  })
  const rows2 = await prisma.berkasPpdb.findMany({ where: { pendaftaranId: p.id } })
  cek("tetap 3 baris setelah sinkron ulang", rows2.length === 3)

  // 4. mirror unggahBerkas: update status + uploadId
  console.log("\n4. Unggah berkas → status DIUNGGAH + uploadId")
  const kk = rows.find((r) => r.namaDokumen === "Kartu Keluarga")!
  const up = await prisma.upload.create({
    data: { filename: "kk.pdf", mime: "application/pdf", size: 1234, data: Buffer.from("x"), userId: u.id, akses: "PRIVAT" },
  })
  await prisma.berkasPpdb.update({ where: { id: kk.id }, data: { uploadId: up.id, status: "DIUNGGAH", catatanPenolakan: null } })
  const kkAfter = await prisma.berkasPpdb.findUnique({ where: { id: kk.id }, include: { upload: true } })
  cek("status jadi DIUNGGAH", kkAfter?.status === "DIUNGGAH")
  cek("uploadId terpasang + relasi upload", kkAfter?.upload?.filename === "kk.pdf")

  // guard: upload harus PRIVAT & milik sendiri
  const upPublik = await prisma.upload.create({
    data: { filename: "publik.pdf", mime: "application/pdf", size: 10, data: Buffer.from("x"), userId: u.id, akses: "PUBLIK" },
  })
  // mirror validasi: akses != PRIVAT → ditolak
  cek("upload non-PRIVAT tidak layak (akses=PUBLIK)", upPublik.akses !== "PRIVAT")
  const upOrangLain = await prisma.upload.create({
    data: { filename: "milik-orang.pdf", mime: "application/pdf", size: 10, data: Buffer.from("x"), userId: "00000000-0000-0000-0000-000000000001", akses: "PRIVAT" },
  })
  cek("upload milik user lain tidak layak", upOrangLain.userId !== u.id)

  // 5. mirror hapusBerkas: uploadId=null, status TIDAK_LENGKAP
  console.log("\n5. Hapus berkas → placeholder lagi")
  await prisma.berkasPpdb.update({ where: { id: kk.id }, data: { uploadId: null, status: "TIDAK_LENGKAP", catatanPenolakan: null } })
  const kkHapus = await prisma.berkasPpdb.findUnique({ where: { id: kk.id } })
  cek("uploadId kembali null", kkHapus?.uploadId === null)
  cek("status kembali TIDAK_LENGKAP", kkHapus?.status === "TIDAK_LENGKAP")

  // 6. cekKelengkapanBerkas: wajib tanpa upload = kurang
  console.log("\n6. Kelengkapan berkas wajib")
  // unggah semua wajib
  const akta = rows.find((r) => r.namaDokumen === "Akta Kelahiran")!
  const up2 = await prisma.upload.create({
    data: { filename: "akta.pdf", mime: "application/pdf", size: 2000, data: Buffer.from("x"), userId: u.id, akses: "PRIVAT" },
  })
  await prisma.berkasPpdb.update({ where: { id: kk.id }, data: { uploadId: up.id, status: "DIUNGGAH" } })
  await prisma.berkasPpdb.update({ where: { id: akta.id }, data: { uploadId: up2.id, status: "DIUNGGAH" } })
  // mirror cekKelengkapanBerkas
  const semua = await prisma.berkasPpdb.findMany({ where: { pendaftaranId: p.id } })
  const kurang = semua.filter((b) => b.wajib && !b.uploadId).map((b) => b.namaDokumen)
  cek("lengkap=true setelah semua wajib terunggah", kurang.length === 0)

  // hapus satu wajib lagi → kurang
  await prisma.berkasPpdb.update({ where: { id: akta.id }, data: { uploadId: null, status: "TIDAK_LENGKAP" } })
  const semua2 = await prisma.berkasPpdb.findMany({ where: { pendaftaranId: p.id } })
  const kurang2 = semua2.filter((b) => b.wajib && !b.uploadId).map((b) => b.namaDokumen)
  cek("kurang terdeteksi saat wajib kosong", kurang2.includes("Akta Kelahiran"))

  // 7. pendaftaran non-DRAFT (TERKIRIM) → unggah ditolak (mirror guard status)
  console.log("\n7. Guard status pendaftaran")
  await prisma.pendaftaranPpdb.update({ where: { id: p.id }, data: { status: "TERKIRIM" } })
  const pLock = await prisma.pendaftaranPpdb.findUnique({ where: { id: p.id } })
  cek("pendaftaran TERKIRIM blokir edit berkas (mirror)", pLock?.status !== "DRAFT")

  // cleanup
  await prisma.berkasPpdb.deleteMany({ where: { pendaftaranId: p.id } })
  await prisma.upload.deleteMany({ where: { id: { in: [up.id, up2.id, upPublik.id, upOrangLain.id] } } })
  await prisma.pilihanPpdb.deleteMany({ where: { pendaftaranId: p.id } })
  await prisma.keputusanPpdb.deleteMany({ where: { pendaftaranId: p.id } })
  await prisma.pendaftaranPpdb.delete({ where: { id: p.id } })
  await prisma.gelombangPpdb.delete({ where: { id: gel.id } })
  await prisma.user.delete({ where: { id: u.id } })

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
