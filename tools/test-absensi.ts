import { prisma } from "../src/lib/prisma"
import { deteksiBentrokJadwal, getJadwalGuruDenganStatus, getRekapBulananGuru, absenMasukSesi, resolveHari, hitungRekap } from "../src/lib/absensi-guru"

async function main() {
  const hariIni = new Date().toISOString().slice(0, 10)
  console.log("Hari ini:", hariIni, "=", resolveHari(hariIni))

  const peng = await prisma.pengajaran.findFirst({
    where: { deletedAt: null },
    include: { guru: { select: { id: true, nama: true } }, kelas: { select: { nama: true } }, mataPelajaran: { select: { nama: true } } },
  })
  if (!peng) throw new Error("Tidak ada data pengajaran")
  console.log("Guru uji:", peng.guru.nama, "|", peng.kelas.nama, "-", peng.mataPelajaran.nama)

  // 1. Jadwal + status (baca)
  const sesi = await getJadwalGuruDenganStatus(peng.guru.id, hariIni)
  console.log(`1) Sesi hari ini: ${sesi.length}`, sesi.map((s) => `${s.jamMulai}-${s.jamSelesai} ${s.kelasNama}/${s.mataPelajaranNama}=${s.status}/${s.fase}`))

  // 2. Rekap bulanan (baca)
  const rekap = await getRekapBulananGuru(peng.guru.id, hariIni.slice(0, 7))
  console.log("2) Rekap bulan ini:", JSON.stringify(rekap))

  // 3. Deteksi bentrok: pakai jadwal milik kelas itu → harus terdeteksi bentrok dengan dirinya sendiri (tanpa exclude)
  const jadwal = await prisma.jadwalPelajaran.findFirst({ where: { kelasId: peng.kelasId, deletedAt: null } })
  if (jadwal) {
    const b = await deteksiBentrokJadwal({
      kelasId: jadwal.kelasId,
      hari: jadwal.hari,
      jamMulai: jadwal.jamMulai,
      jamSelesai: jadwal.jamSelesai,
      mataPelajaranId: jadwal.mataPelajaranId,
    })
    console.log("3) Cek bentrok (harus >0):", b.length, b[0] ?? "-")
    const b2 = await deteksiBentrokJadwal({
      kelasId: jadwal.kelasId,
      hari: jadwal.hari,
      jamMulai: jadwal.jamMulai,
      jamSelesai: jadwal.jamSelesai,
      mataPelajaranId: jadwal.mataPelajaranId,
      excludeId: jadwal.id,
    })
    console.log("3b) Cek bentrok dengan exclude (harus 0):", b2.length)
  }

  // 4. Validasi kepemilikan: guru lain tidak boleh absen di jadwal ini
  const lain = await prisma.guru.findFirst({ where: { id: { not: peng.guruId }, deletedAt: null }, select: { id: true, nama: true } })
  if (jadwal && lain) {
    try {
      await absenMasukSesi({ guruId: lain.id, jadwalPelajaranId: jadwal.id, tanggal: hariIni })
      console.log("4) GAGAL: guru lain bisa absen!")
    } catch (e: any) {
      console.log("4) Validasi kepemilikan OK:", e.message)
    }
  }

  // 5. Rekap hitungRekap
  console.log("5) hitungRekap:", JSON.stringify(hitungRekap([
    { status: "HADIR" }, { status: "TERLAMBAT", terlambatMenit: 10 }, { status: "TIDAK_HADIR" }, { status: "IZIN" },
  ])))

  await prisma.$disconnect()
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1) })
