import { galatSesaat, prisma, withRetry } from "../src/lib/prisma"

let lulus = 0
let gagal = 0
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) { lulus++; console.log(`  v ${nama}`) }
  else { gagal++; console.log(`  X ${nama}`, detail !== undefined ? JSON.stringify(detail) : "") }
}

async function main() {
  console.log("1) Klasifikasi galat sesaat (layak diulang)")
  cek("P1001 (DB tak terjangkau)", galatSesaat(new Error("P1001: Can't reach database server")))
  cek("P2024 (pool habis)", galatSesaat(new Error("P2024: Timed out fetching a new connection from the pool")))
  cek("P1017 (koneksi ditutup server)", galatSesaat(new Error("P1017: Server has closed the connection")))
  cek("ECONNRESET (jaringan putus)", galatSesaat(new Error("read ECONNRESET")))
  cek("P2002 unique TIDAK diulang", !galatSesaat(new Error("P2002: Unique constraint failed")))
  cek("P2025 not found TIDAK diulang", !galatSesaat(new Error("P2025: Record to update not found")))
  cek("galat validasi TIDAK diulang", !galatSesaat(new Error("Argument `where` is missing")))

  console.log("2) Mesin retry")
  let percobaan = 0
  const hasil = await withRetry(async () => {
    percobaan++
    if (percobaan < 3) throw new Error("P1001: Can't reach database server")
    return "pulih"
  })
  cek("gagal sesaat diulang sampai berhasil", hasil === "pulih" && percobaan === 3, { hasil, percobaan })

  let percobaanNonTransien = 0
  let pesan = ""
  try {
    await withRetry(async () => {
      percobaanNonTransien++
      throw new Error("P2002: Unique constraint failed")
    })
  } catch (e) {
    pesan = String((e as Error).message)
  }
  cek("galat non-sesaat langsung dilempar", percobaanNonTransien === 1, percobaanNonTransien)
  cek("pesan galat asli dipertahankan", pesan.includes("P2002"), pesan)

  let percobaanHabis = 0
  try {
    await withRetry(async () => {
      percobaanHabis++
      throw new Error("P1001: Can't reach database server")
    }, 1)
  } catch {}
  cek("berhenti setelah batas percobaan", percobaanHabis === 2, percobaanHabis)

  console.log("3) Klien Prisma hasil ekstensi tetap utuh")
  cek("delegate user tersedia", typeof prisma.user?.findMany === "function")
  cek("delegate siswa tersedia", typeof prisma.siswa?.findUnique === "function")
  cek("$transaction tersedia", typeof prisma.$transaction === "function")
  cek("$queryRaw tersedia", typeof prisma.$queryRaw === "function")

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
  if (gagal > 0) process.exit(1)
  process.exit(0)
}

main()
