import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const adminPassword = await bcrypt.hash("admin123", 12)

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@elearningqu.com" },
    update: {},
    create: {
      email: "admin@elearningqu.com",
      name: "Admin E-Learning QU",
      password: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  })
  console.log(`Created admin user: ${adminUser.email} (password: admin123)`)

  const tahunAjaran = await prisma.tahunAjaran.upsert({
    where: { nama: "2025/2026" },
    update: {},
    create: {
      nama: "2025/2026",
      tahunMulai: 2025,
      tahunSelesai: 2026,
      isAktif: true,
    },
  })
  console.log(`Created tahun ajaran: ${tahunAjaran.nama}`)

  const semester = await prisma.semester.create({
    data: {
      nama: "Ganjil",
      tahunAjaranId: tahunAjaran.id,
      isAktif: true,
    },
  })
  console.log(`Created semester: ${semester.nama}`)

  const kelasData = [
    { nama: "X-A", tingkat: 10 },
    { nama: "X-B", tingkat: 10 },
    { nama: "XI-A", tingkat: 11 },
    { nama: "XI-B", tingkat: 11 },
    { nama: "XII-A", tingkat: 12 },
    { nama: "XII-B", tingkat: 12 },
  ]

  for (const k of kelasData) {
    await prisma.kelas.create({ data: { nama: k.nama, tingkat: k.tingkat } })
    console.log(`Created kelas: ${k.nama}`)
  }

  await prisma.kategoriSoal.create({ data: { nama: "Umum" } })
  console.log("Created kategori soal: Umum")

  console.log("Seeding completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
