import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const defaultFeatures = [
  { icon: "FileText", title: "Bank Soal Digital", description: "Kumpulan soal terstruktur dengan berbagai tipe: PG, Essay, True/False, dan Matching.", order: 1 },
  { icon: "GraduationCap", title: "Ujian Online", description: "Ujian dan latihan interaktif real-time dengan pengawasan otomatis.", order: 2 },
  { icon: "BarChart3", title: "Monitoring Nilai", description: "Pantau perkembangan nilai siswa secara detail dan akurat.", order: 3 },
  { icon: "Users", title: "Manajemen Kelas", description: "Kelola kelas, mata pelajaran, dan jadwal dengan mudah.", order: 4 },
  { icon: "Target", title: "Analitik & Laporan", description: "Visualisasi data pembelajaran untuk evaluasi yang lebih baik.", order: 5 },
  { icon: "BookOpen", title: "Belajar Mandiri", description: "Akses materi dan latihan kapan saja, di mana saja.", order: 6 },
]

async function main() {
  const existing = await prisma.siteConfig.findFirst()
  if (!existing) {
    await prisma.siteConfig.create({ data: {} })
    console.log("Seeded SiteConfig")
  } else {
    console.log("SiteConfig already exists")
  }

  const featureCount = await prisma.landingFeature.count()
  if (featureCount === 0) {
    for (const f of defaultFeatures) {
      await prisma.landingFeature.create({ data: f })
    }
    console.log("Seeded default features")
  } else {
    console.log("Features already exist")
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
