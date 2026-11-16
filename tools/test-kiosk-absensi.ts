import {
  normalisasiKodeKiosk,
  kartuSiswa,
  kartuGuru,
  ringkasHasilKiosk,
} from "../src/lib/kiosk-absensi"
import { signKioskToken, signWajahToken, verifyKioskToken } from "../src/lib/wajah-token"

let lulus = 0
let gagal = 0
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) { lulus++; console.log(`  v ${nama}`) }
  else { gagal++; console.log(`  X ${nama}`, detail !== undefined ? JSON.stringify(detail) : "") }
}

async function main() {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "rahasia-uji-kiosk"

  console.log("1) Kode kiosk (NIS/NISN/NIP)")
  cek("kode valid dinormalisasi ke huruf besar", normalisasiKodeKiosk("  2024001 ") === "2024001")
  cek("NIP dengan titik tetap diterima", normalisasiKodeKiosk("1987.01.02") === "1987.01.02")
  cek("kode terlalu pendek ditolak", (() => { try { normalisasiKodeKiosk("ab"); return false } catch { return true } })())
  cek("kode dengan spasi ditolak", (() => { try { normalisasiKodeKiosk("NIS 123"); return false } catch { return true } })())
  cek("kode 31 karakter ditolak", (() => { try { normalisasiKodeKiosk("A".repeat(31)); return false } catch { return true } })())
  cek("kode kosong ditolak", (() => { try { normalisasiKodeKiosk(null); return false } catch { return true } })())

  console.log("2) Kartu identitas SISWA (foto, nama, kelas, jurusan, NIS, formal/non formal)")
  const siswa = kartuSiswa({
    nama: "Aisyah",
    nis: "2024001",
    image: "/api/upload/abc",
    kelasNama: "X IPA 1",
    jurusanNama: "IPA",
    santriAktif: true,
  })
  cek("tipe SISWA", siswa.tipe === "SISWA")
  cek("nama tampil", siswa.nama === "Aisyah")
  cek("foto identitas dipakai", siswa.fotoUrl === "/api/upload/abc", siswa.fotoUrl)
  cek("kelas tampil", siswa.kelas === "X IPA 1")
  cek("jurusan tampil", siswa.jurusan === "IPA")
  cek("NIS tampil", siswa.nis === "2024001")
  cek("sekolah formal = true", siswa.sekolahFormal === true)
  cek("santri aktif = sekolah non formal", siswa.sekolahNonFormal === true)
  cek("tanpa NIP/jabatan", siswa.nip === null && siswa.jabatan === null)
  const siswaTanpaFoto = kartuSiswa({ nama: "Budi", nis: null, image: "  ", kelasNama: null, jurusanNama: null, santriAktif: false })
  cek("foto kosong jadi null", siswaTanpaFoto.fotoUrl === null)
  cek("bukan santri = non formal false", siswaTanpaFoto.sekolahNonFormal === false)

  console.log("3) Kartu identitas GURU (foto, nama, jabatan, NIP, formal/non formal)")
  const guru = kartuGuru({
    nama: "Ustadz Fauzan",
    nip: "198701022010011001",
    jabatan: "Wali Kelas",
    image: "/api/upload/guru1",
    punyaPenugasanPondok: true,
  })
  cek("tipe GURU", guru.tipe === "GURU")
  cek("nama tampil", guru.nama === "Ustadz Fauzan")
  cek("foto identitas dipakai", guru.fotoUrl === "/api/upload/guru1", guru.fotoUrl)
  cek("jabatan tampil", guru.jabatan === "Wali Kelas")
  cek("NIP tampil", guru.nip === "198701022010011001")
  cek("sekolah formal = true", guru.sekolahFormal === true)
  cek("penugasan pondok = sekolah non formal", guru.sekolahNonFormal === true)
  cek("tanpa kelas/jurusan/NIS", guru.kelas === null && guru.jurusan === null && guru.nis === null)

  console.log("4) Banner hasil kiosk (bug: sukses tanpa kartu ≠ identitas tidak dikenal)")
  cek(
    "TIDAK_DIKENAL -> Identitas tidak ditemukan",
    ringkasHasilKiosk({ status: "TIDAK_DIKENAL", pesan: "NIS tidak ditemukan" }).judul === "Identitas tidak ditemukan"
  )
  const suksesTanpaKartu = ringkasHasilKiosk({ status: "SUKSES", pesan: "Absensi wajah tercatat" })
  cek("SUKSES tanpa kartu (mis. pegawai) -> Absensi tercatat", suksesTanpaKartu.judul === "Absensi tercatat")
  cek("SUKSES tanpa kartu berwarna sukses", suksesTanpaKartu.nada === "sukses")
  cek(
    "DITOLAK -> Absensi tidak tercatat",
    ringkasHasilKiosk({ status: "DITOLAK", pesan: "Sidik jari belum terdaftar" }).judul === "Absensi tidak tercatat"
  )
  cek(
    "GAGAL -> Absensi tidak tercatat",
    ringkasHasilKiosk({ status: "GAGAL", pesan: "Coba lagi" }).judul === "Absensi tidak tercatat"
  )
  cek(
    "DUPLIKAT -> Absensi tidak tercatat",
    ringkasHasilKiosk({ status: "DUPLIKAT", pesan: "Sudah absen" }).judul === "Absensi tidak tercatat"
  )

  console.log("5) Token kiosk (bukan token API umum)")
  const kiosk = await signKioskToken("U-1", "Admin")
  const verifikasi = await verifyKioskToken(kiosk)
  cek("token kiosk valid", verifikasi?.sub === "U-1" && verifikasi?.nama === "Admin")
  const wajah = await signWajahToken("U-1", "ADMIN")
  cek("token wajah TIDAK diterima sebagai token kiosk", (await verifyKioskToken(wajah)) === null)
  cek("token rusak ditolak", (await verifyKioskToken("bukan.token.valid")) === null)
  cek("token kosong ditolak", (await verifyKioskToken("")) === null)

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
  if (gagal > 0) process.exit(1)
}

main()
