/**
 * Data contoh penilaian & raport untuk satu kelas.
 *
 * Jalankan: npx tsx scripts/seed-raport-contoh.ts
 *
 * Aman diulang: komponen bernama "Contoh ..." dan raport bercatatan "[CONTOH]"
 * dihapus lalu dibuat ulang. Data lain tidak disentuh.
 */
import { prisma } from "../src/lib/prisma"
import {
  DEFAULT_PENGATURAN,
  deskripsiCapaian,
  hitungNilaiAkhir,
  predikatDari,
  rataRata,
  type JenisKomponen,
} from "../src/lib/raport"

const NAMA_KELAS = "X TKJ 2"
const PREFIX = "Contoh"
const TANDA_CONTOH = "[CONTOH]"

const KOMPONEN: { nama: string; jenis: JenisKomponen; bobot: number; geser: number }[] = [
  { nama: "Contoh Formatif 1", jenis: "FORMATIF", bobot: 1, geser: 0 },
  { nama: "Contoh Formatif 2", jenis: "FORMATIF", bobot: 1, geser: 4 },
  { nama: "Contoh Sumatif 1", jenis: "SUMATIF", bobot: 2, geser: -2 },
  { nama: "Contoh Proyek P5", jenis: "PROYEK", bobot: 1, geser: 3 },
  { nama: "Contoh Praktik", jenis: "PRAKTIK", bobot: 1, geser: 1 },
]

const CATATAN = [
  "Menunjukkan sikap belajar yang konsisten dan aktif dalam diskusi kelas. Pertahankan kebiasaan baik ini.",
  "Sudah menguasai sebagian besar materi dengan baik. Tingkatkan ketelitian pada tugas proyek dan latihan mandiri.",
  "Memiliki kemauan belajar yang tinggi. Manfaatkan waktu belajar tambahan untuk memperkuat materi yang masih sulit.",
]

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

async function main() {
  const semester =
    (await prisma.semester.findFirst({ where: { isAktif: true, deletedAt: null } })) ??
    (await prisma.semester.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }))
  if (!semester) throw new Error("Belum ada semester")

  const kelas = await prisma.kelas.findFirst({
    where: { nama: NAMA_KELAS, deletedAt: null },
    select: { id: true, nama: true, guruId: true, guru: { select: { nama: true } } },
  })
  if (!kelas) throw new Error(`Kelas ${NAMA_KELAS} tidak ditemukan`)

  const [siswas, pengajarans] = await Promise.all([
    prisma.siswa.findMany({
      where: { kelasId: kelas.id, deletedAt: null },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: "asc" },
    }),
    prisma.pengajaran.findMany({
      where: {
        kelasId: kelas.id,
        deletedAt: null,
        mataPelajaran: { semesterId: semester.id, deletedAt: null },
      },
      select: {
        guruId: true,
        mataPelajaran: { select: { id: true, nama: true, kode: true } },
      },
    }),
  ])
  if (siswas.length === 0) throw new Error(`Kelas ${NAMA_KELAS} belum memiliki siswa`)
  if (pengajarans.length === 0) throw new Error("Belum ada mata pelajaran yang diajar di kelas ini")

  // Satu mapel bisa punya lebih dari satu baris pengajaran; ambil unik.
  const mapelMap = new Map<string, { id: string; nama: string; kode: string; guruId: string }>()
  for (const p of pengajarans) {
    mapelMap.set(p.mataPelajaran.id, { ...p.mataPelajaran, guruId: p.guruId })
  }
  const mapels = [...mapelMap.values()].sort((a, b) => a.nama.localeCompare(b.nama))

  // ── Pengaturan raport semester ──
  const pengaturanData = {
    bobotFormatif: DEFAULT_PENGATURAN.bobotFormatif,
    bobotSumatif: DEFAULT_PENGATURAN.bobotSumatif,
    bobotProyek: DEFAULT_PENGATURAN.bobotProyek,
    bobotPraktik: DEFAULT_PENGATURAN.bobotPraktik,
    kktp: DEFAULT_PENGATURAN.kktp,
    ambangA: DEFAULT_PENGATURAN.ambangA,
    ambangB: DEFAULT_PENGATURAN.ambangB,
    ambangC: DEFAULT_PENGATURAN.ambangC,
    tampilkanPeringkat: true,
    namaKepalaSekolah: "Drs. H. Ahmad Fauzi, M.Pd.",
    nipKepalaSekolah: "19700101 199501 1 001",
    catatanKepala: "Teruskan semangat belajar dan jaga akhlak yang baik.",
  }
  await prisma.pengaturanRaport.upsert({
    where: { semesterId: semester.id },
    create: { semesterId: semester.id, ...pengaturanData },
    update: pengaturanData,
  })

  // ── Bersihkan data contoh sebelumnya ──
  await prisma.komponenNilai.deleteMany({
    where: { kelasId: kelas.id, semesterId: semester.id, nama: { startsWith: `${PREFIX} ` } },
  })
  await prisma.raport.deleteMany({
    where: {
      kelasId: kelas.id,
      semesterId: semester.id,
      catatanWali: { startsWith: TANDA_CONTOH },
    },
  })

  // ── Komponen & nilai ──
  const nilaiAkhir = new Map<string, Map<string, number>>() // siswaId -> mapelId -> nilai
  for (const siswa of siswas) nilaiAkhir.set(siswa.id, new Map())

  for (let m = 0; m < mapels.length; m++) {
    const mapel = mapels[m]
    for (const komponen of KOMPONEN) {
      const dibuat = await prisma.komponenNilai.create({
        data: {
          nama: komponen.nama,
          jenis: komponen.jenis,
          bobot: komponen.bobot,
          tanggal: new Date(Date.now() - (KOMPONEN.length - KOMPONEN.indexOf(komponen)) * 86400000),
          mapelId: mapel.id,
          kelasId: kelas.id,
          semesterId: semester.id,
          guruId: mapel.guruId,
        },
        select: { id: true },
      })

      const rows = siswas.map((siswa, i) => {
        const dasar = 74 + ((i * 7 + m * 5) % 20)
        return {
          komponenId: dibuat.id,
          siswaId: siswa.id,
          nilai: clamp(dasar + komponen.geser + ((i + m) % 5) - 2, 60, 98),
        }
      })
      await prisma.nilaiKomponen.createMany({ data: rows })
    }

    // Hitung nilai akhir mapel untuk tiap siswa memakai aturan yang sama dengan aplikasi.
    for (let i = 0; i < siswas.length; i++) {
      const siswa = siswas[i]
      const dasar = 74 + ((i * 7 + m * 5) % 20)
      const komponenNilai = KOMPONEN.map((k) => ({
        jenis: k.jenis,
        bobot: k.bobot,
        nilai: clamp(dasar + k.geser + ((i + m) % 5) - 2, 60, 98),
      }))
      const akhir = hitungNilaiAkhir(komponenNilai, pengaturanData)
      if (akhir != null) nilaiAkhir.get(siswa.id)!.set(mapel.id, akhir)
    }
  }

  // ── Raport ──
  const rataSiswa = siswas.map((siswa) => {
    const nilaiMap = nilaiAkhir.get(siswa.id)!
    const daftar = mapels.map((mapel) => nilaiMap.get(mapel.id) ?? 0)
    return { siswa, rata: rataRata(daftar) ?? 0 }
  })
  const urut = [...rataSiswa].sort((a, b) => b.rata - a.rata)
  const peringkat = new Map(urut.map((row, i) => [row.siswa.id, i + 1]))
  const jumlahTerbit = Math.min(6, siswas.length)

  for (let i = 0; i < siswas.length; i++) {
    const siswa = siswas[i]
    const nilaiMap = nilaiAkhir.get(siswa.id)!
    const baris = mapels
      .filter((mapel) => nilaiMap.has(mapel.id))
      .map((mapel) => {
        const nilai = nilaiMap.get(mapel.id)!
        const predikat = predikatDari(nilai, pengaturanData)
        return {
          mapelId: mapel.id,
          nilaiAkhir: nilai,
          predikat,
          deskripsi: deskripsiCapaian(mapel.nama, nilai, predikat),
        }
      })
    const rata = rataRata(baris.map((b) => b.nilaiAkhir)) ?? 0
    const rank = peringkat.get(siswa.id) ?? 0
    const terbit = rank <= jumlahTerbit

    await prisma.raport.create({
      data: {
        siswaId: siswa.id,
        kelasId: kelas.id,
        semesterId: semester.id,
        waliKelasId: kelas.guruId,
        status: terbit ? "TERBIT" : "DRAFT",
        rataRata: rata,
        peringkat: rank,
        catatanWali: `${TANDA_CONTOH} ${CATATAN[i % CATATAN.length]}`,
        sikapPredikat: i % 3 === 0 ? "Sangat Baik" : "Baik",
        sikapDeskripsi:
          i % 3 === 0
            ? "Menunjukkan sikap santun, disiplin, dan peduli terhadap teman."
            : "Menunjukkan sikap baik dalam pembelajaran dan kegiatan kelas.",
        prestasi: i === 0 ? "Juara 1 LKS tingkat sekolah (contoh)" : null,
        sakit: i % 3,
        izin: (i + 1) % 3,
        alpa: i % 4 === 0 ? 1 : 0,
        terbitAt: terbit ? new Date(Date.now() - (i % 4) * 86400000) : null,
        nilais: { createMany: { data: baris } },
      },
    })
  }

  console.log(`Kelas          : ${kelas.nama} (${kelas.guru?.nama ?? "tanpa wali"})`)
  console.log(`Semester       : ${semester.nama}`)
  console.log(`Siswa          : ${siswas.length}`)
  console.log(`Mata pelajaran : ${mapels.length} — ${mapels.map((m) => m.nama).join(", ")}`)
  console.log(`Komponen/mapel : ${KOMPONEN.length} (Formatif 2, Sumatif 1, Proyek 1, Praktik 1)`)
  console.log(`Raport         : ${siswas.length} (${jumlahTerbit} sudah terbit, sisanya draft)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
