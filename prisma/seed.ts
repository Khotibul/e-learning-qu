import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@e-learning.qu"
const ADMIN_PASSWORD = "admin123"
const ADMIN_NAME = "Administrator"

const defaultFeatures = [
  { icon: "FileText", title: "Bank Soal Digital", description: "Kumpulan soal terstruktur dengan berbagai tipe: PG, Essay, True/False, dan Matching.", order: 1 },
  { icon: "GraduationCap", title: "Ujian Online", description: "Ujian dan latihan interaktif real-time dengan pengawasan otomatis.", order: 2 },
  { icon: "BarChart3", title: "Monitoring Nilai", description: "Pantau perkembangan nilai siswa secara detail dan akurat.", order: 3 },
  { icon: "Users", title: "Manajemen Kelas", description: "Kelola kelas, mata pelajaran, dan jadwal dengan mudah.", order: 4 },
  { icon: "Target", title: "Analitik & Laporan", description: "Visualisasi data pembelajaran untuk evaluasi yang lebih baik.", order: 5 },
  { icon: "BookOpen", title: "Belajar Mandiri", description: "Akses materi dan latihan kapan saja, di mana saja.", order: 6 },
]

async function seedAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log(`Admin user already exists (${ADMIN_EMAIL})`)
    return
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "ADMIN",
      password: hashedPassword,
      isActive: true,
      emailVerified: new Date(),
    },
  })

  console.log(`Admin user created: ${admin.email} / ${ADMIN_PASSWORD}`)
}

async function seedSiteConfig() {
  const existing = await prisma.siteConfig.findFirst()
  if (!existing) {
    await prisma.siteConfig.create({ data: {} })
    console.log("Seeded SiteConfig")
  } else {
    console.log("SiteConfig already exists")
  }
}

async function seedFeatures() {
  const count = await prisma.landingFeature.count()
  if (count === 0) {
    for (const f of defaultFeatures) {
      await prisma.landingFeature.create({ data: f })
    }
    console.log("Seeded default features")
  } else {
    console.log("Features already exist")
  }
}

async function seedSampleData() {
  const jurusanCount = await prisma.jurusan.count()
  if (jurusanCount > 0) {
    console.log("Sample data already exists")
    return
  }

  const jurusanTKJ = await prisma.jurusan.create({
    data: { kode: "TKJ", nama: "Teknik Komputer dan Jaringan", deskripsi: "Jurusan Teknik Komputer dan Jaringan" },
  })
  const jurusanRPL = await prisma.jurusan.create({
    data: { kode: "RPL", nama: "Rekayasa Perangkat Lunak", deskripsi: "Jurusan Rekayasa Perangkat Lunak" },
  })
  console.log("Seeded 2 jurusan")

  const kelasXITKJ = await prisma.kelas.create({
    data: { nama: "XI-TKJ", tingkat: 11 },
  })
  const kelasXIIRPL = await prisma.kelas.create({
    data: { nama: "XII-RPL", tingkat: 12 },
  })
  console.log("Seeded 2 kelas")

  const guruHashed = await bcrypt.hash("guru123", 12)
  const guruUser = await prisma.user.create({
    data: {
      email: "guru@e-learning.qu",
      name: "Budi Santoso",
      role: "GURU",
      password: guruHashed,
      isActive: true,
      emailVerified: new Date(),
    },
  })
  const guru = await prisma.guru.create({
    data: {
      userId: guruUser.id,
      nama: "Budi Santoso",
      nip: "198501012010011001",
      jabatan: "Wali Kelas",
    },
  })

  await prisma.kelas.update({ where: { id: kelasXITKJ.id }, data: { guruId: guru.id } })

  const mapelTI = await prisma.mataPelajaran.create({
    data: { kode: "TI", nama: "Teknologi Informasi", semesterId: (await prisma.semester.findFirst({ where: { isAktif: true } }))?.id ?? (await prisma.semester.create({ data: { nama: "Ganjil 2025/2026", tahunAjaranId: (await prisma.tahunAjaran.create({ data: { nama: "2025/2026", tahunMulai: 2025, tahunSelesai: 2026, isAktif: true } })).id, isAktif: true } })).id },
  })

  await prisma.pengajaran.create({
    data: { mataPelajaranId: mapelTI.id, guruId: guru.id, kelasId: kelasXITKJ.id },
  })
  console.log("Seeded 1 guru + 1 mapel + pengajaran")

  const siswaHashed = await bcrypt.hash("siswa123", 12)
  const siswaUsers = [
    { email: "andi@e-learning.qu", name: "Andi Pratama" },
    { email: "sari@e-learning.qu", name: "Sari Dewi" },
    { email: "raka@e-learning.qu", name: "Raka Firmansyah" },
  ]

  for (const su of siswaUsers) {
    const u = await prisma.user.create({
      data: { email: su.email, name: su.name, role: "SISWA", password: siswaHashed, isActive: true, emailVerified: new Date() },
    })
    await prisma.siswa.create({
      data: { userId: u.id, nama: su.name, kelasId: kelasXITKJ.id, jurusanId: jurusanTKJ.id },
    })
  }
  console.log("Seeded 3 siswa")

  const kompetensi = await prisma.kompetensi.create({
    data: { kode: "TI-01", nama: "Dasar Jaringan", jurusanId: jurusanTKJ.id, mataPelajaranId: mapelTI.id, tingkat: 1 },
  })
  console.log("Seeded 1 kompetensi")
}

async function main() {
  console.log("--- Seeding E-Learning QU ---")

  await seedAdmin()
  await seedSiteConfig()
  await seedFeatures()
  await seedSampleData()

  console.log("--- Seed complete ---")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
