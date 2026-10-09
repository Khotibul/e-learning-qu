// Test STEP 5 PPDB — registrasi akun, verifikasi email, lupa password, reset.
// Jalankan: npx tsx tools/test-ppdb-registrasi.ts
// Memanggil server action langsung (publik, tanpa sesi) — mode dev tanpa RESEND_API_KEY.
import { prisma } from "../src/lib/prisma"
import { daftarAkunPpdb, verifikasiAkunPpdb, lupaPasswordPpdb, resetPasswordPpdb, kirimUlangVerifikasi } from "../src/app/ppdb/actions"

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
  console.log("=== STEP 5 PPDB: REGISTRASI + VERIFIKASI EMAIL ===\n")
  const ts = Date.now()
  const email = `s5-${ts}@t.test`

  // 1. daftar akun
  console.log("1. Daftar akun pendaftar")
  const r1 = await daftarAkunPpdb({ email, nama: "Test S5", setujuPrivasi: true }) as any
  cek("daftar sukses", r1.ok === true)
  cek("devToken dikembalikan (tanpa RESEND_API_KEY)", typeof r1.devToken === "string" && r1.devToken.length === 64)
  const user = await prisma.user.findUnique({ where: { email }, include: { siswa: true } })
  cek("user dibuat role SISWA", user?.role === "SISWA")
  cek("user belum emailVerified", user?.emailVerified === null)
  cek("user belum punya password (aktif setelah verifikasi)", user?.password === null)
  const tokenRow = await prisma.ppdbToken.findFirst({ where: { email, jenis: "VERIFIKASI_EMAIL", usedAt: null } })
  cek("token verifikasi tersimpan", tokenRow?.token === r1.devToken)

  // validasi input
  await expectThrow("email tidak valid ditolak", () => daftarAkunPpdb({ email: "bukan-email", nama: "X", setujuPrivasi: true }), "tidak valid")
  await expectThrow("nama < 3 ditolak", () => daftarAkunPpdb({ email: `s5b-${ts}@t.test`, nama: "X", setujuPrivasi: true }), "minimal 3")
  await expectThrow("tanpa persetujuan privasi ditolak", () => daftarAkunPpdb({ email: `s5c-${ts}@t.test`, nama: "Test S5", setujuPrivasi: false }), "menyetujui")

  // duplikat: daftar lagi dengan email sama → sukses tapi "menunggu verifikasi" (kirim ulang)
  const r2 = await daftarAkunPpdb({ email, nama: "Test S5", setujuPrivasi: true }) as any
  cek("daftar ulang email sama → pesan menunggu verifikasi", r2.message?.includes("menunggu verifikasi"))
  const oldToken = await prisma.ppdbToken.findFirst({ where: { email, jenis: "VERIFIKASI_EMAIL", usedAt: null } })
  cek("token lama diganti token baru", oldToken?.token === r2.devToken)

  // 2. verifikasi
  console.log("\n2. Verifikasi email + buat password")
  await expectThrow("password < 8 ditolak", () => verifikasiAkunPpdb(r2.devToken, "pendek"), "minimal 8")
  const v1 = await verifikasiAkunPpdb(r2.devToken, "rahasia123") as any
  cek("verifikasi sukses", v1.ok === true)
  const userV = await prisma.user.findUnique({ where: { email } })
  cek("emailVerified terisi", userV?.emailVerified !== null)
  cek("password ter-hash (bukan plain)", !!userV?.password && userV.password !== "rahasia123" && userV.password.startsWith("$2"))
  const tUsed = await prisma.ppdbToken.findUnique({ where: { token: r2.devToken } })
  cek("token ditandai used", tUsed?.usedAt !== null)
  await expectThrow("token kedua kali ditolak", () => verifikasiAkunPpdb(r2.devToken, "rahasia123"), "sudah dipakai")
  await expectThrow("token palsu ditolak", () => verifikasiAkunPpdb("token-ngawur-" + ts, "rahasia123"), "tidak valid")

  // daftar lagi setelah terdaftar & verified
  await expectThrow("email verified → daftar ditolak (sudah terdaftar)", () => daftarAkunPpdb({ email, nama: "Test S5", setujuPrivasi: true }), "sudah terdaftar")
  await expectThrow("kirim ulang verified → ditolak", () => kirimUlangVerifikasi(email), "sudah terverifikasi")

  // 3. lupa + reset password
  console.log("\n3. Lupa & reset password")
  const l1 = await lupaPasswordPpdb(email) as any
  cek("lupa password kirim tautan", l1.ok === true)
  const resetToken = await prisma.ppdbToken.findFirst({ where: { email, jenis: "RESET_PASSWORD", usedAt: null } })
  cek("token reset tersimpan", !!resetToken?.token)
  await expectThrow("token reset dipakai utk verifikasi ditolak", () => verifikasiAkunPpdb(resetToken!.token, "rahasia123"), "tidak valid")
  const rr = await resetPasswordPpdb(resetToken!.token, "barubanget1") as any
  cek("reset password sukses", rr.ok === true)
  await expectThrow("token reset kedua kali ditolak", () => resetPasswordPdbName(resetToken!.token, "lagi12345"), "sudah dipakai")
  // login dengan password baru (bcrypt compare via action? test hash langsung)
  const bcrypt = await import("bcryptjs")
  const userR = await prisma.user.findUnique({ where: { email } })
  cek("password baru cocok (bcrypt)", await bcrypt.compare("barubanget1", userR!.password!))
  cek("password lama tidak cocok", !(await bcrypt.compare("rahasia123", userR!.password!)))

  // lupa password email tak terdaftar
  await expectThrow("lupa password email tak terdaftar ditolak", () => lupaPasswordPpdb(`hilang-${ts}@t.test`), "tidak terdaftar")

  // cleanup
  await prisma.ppdbToken.deleteMany({ where: { email: { contains: `s5` } } })
  await prisma.user.delete({ where: { id: user!.id } }).catch(() => {})

  console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

// wrapper agar tidak tertangkap expectThrow generik di atas (typo-safe)
async function resetPasswordPdbName(token: string, password: string) {
  return resetPasswordPpdb(token, password)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
