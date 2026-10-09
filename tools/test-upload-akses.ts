import { bolehAksesUpload } from "../src/lib/upload-akses"

let lulus = 0
let gagal = 0
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) { lulus++; console.log(`  v ${nama}`) }
  else { gagal++; console.log(`  X ${nama}`, detail !== undefined ? JSON.stringify(detail) : "") }
}

function main() {
  const admin = { id: "U-ADMIN", role: "ADMIN" }
  const pemilik = { id: "U-PEMILIK", role: "SISWA" }
  const lain = { id: "U-LAIN", role: "GURU" }

  console.log("1) File PUBLIK")
  cek("PUBLIK tanpa login -> izin", bolehAksesUpload({ userId: "X", akses: "PUBLIK" }, null) === true)
  cek("PUBLIK untuk user mana pun -> izin", bolehAksesUpload({ userId: "X", akses: "PUBLIK" }, lain) === true)

  console.log("2) File PRIVAT (bukti foto absensi — data pribadi)")
  cek("PRIVAT tanpa login -> tolak (401/403)", bolehAksesUpload({ userId: pemilik.id, akses: "PRIVAT" }, null) === false)
  cek("PRIVAT pemilik sendiri -> izin", bolehAksesUpload({ userId: pemilik.id, akses: "PRIVAT" }, pemilik) === true)
  cek("PRIVAT user lain (IDOR) -> tolak", bolehAksesUpload({ userId: pemilik.id, akses: "PRIVAT" }, lain) === false)
  cek("PRIVAT Admin non-pemilik -> izin", bolehAksesUpload({ userId: pemilik.id, akses: "PRIVAT" }, admin) === true)

  console.log("3) File INTERNAL (materi, foto pelanggaran lintas guru)")
  cek("INTERNAL user login mana pun -> izin", bolehAksesUpload({ userId: pemilik.id, akses: "INTERNAL" }, lain) === true)
  cek("INTERNAL tanpa login -> tolak", bolehAksesUpload({ userId: pemilik.id, akses: "INTERNAL" }, null) === false)

  console.log("4) Baris lama (userId null — kompatibilitas link lama)")
  cek("baris lama + user login -> izin", bolehAksesUpload({ userId: null, akses: "PRIVAT" }, lain) === true)
  cek("baris lama + tanpa login -> tolak", bolehAksesUpload({ userId: null, akses: "PRIVAT" }, null) === false)

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
  if (gagal > 0) process.exit(1)
}

main()
