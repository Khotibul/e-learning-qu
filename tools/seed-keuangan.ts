import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { seedAkunLaporan } from "../src/lib/keuangan/jurnal"

const prisma = new PrismaClient()

// Seed idempoten data master keuangan: akun laporan, jenis tagihan,
// outlet kantin + produk, akun kasir & bendahara.
async function main() {
  const ts = Date.now()
  const n = await seedAkunLaporan()
  console.log(`✓ Akun standar: ${n} dibuat`)

  const jenis = [
    { kode: "SPP", nama: "SPP Bulanan", unit: "SEKOLAH", nominalDefault: 500_000 },
    { kode: "ASRAMA", nama: "Biaya Asrama", unit: "PONDOK", nominalDefault: 300_000 },
    { kode: "MAKAN", nama: "Biaya Makan", unit: "PONDOK", nominalDefault: 400_000 },
    { kode: "KEGIATAN", nama: "Kegiatan", unit: null, nominalDefault: 100_000 },
  ]
  for (const j of jenis) {
    await prisma.jenisTagihan.upsert({
      where: { kode: j.kode },
      create: { kode: j.kode, nama: j.nama, unit: j.unit, nominalDefault: j.nominalDefault },
      update: { nama: j.nama, unit: j.unit, nominalDefault: j.nominalDefault },
    })
  }
  console.log(`✓ Jenis tagihan: ${jenis.length}`)

  const hashed = await bcrypt.hash("keuangan123", 12)
  const upsertUser = async (email: string, name: string, role: "ADMIN" | "GURU" | "SISWA") => {
    return prisma.user.upsert({
      where: { email },
      create: { email, name, role, password: hashed, isActive: true, emailVerified: new Date() },
      update: { name },
    })
  }

  const kasir = await upsertUser("kasir@e-learning.qu", "Kasir Kantin", "GURU")
  await prisma.keuanganStaff.upsert({
    where: { userId: kasir.id },
    create: { userId: kasir.id, peran: "KASIR", unit: null },
    update: { peran: "KASIR", aktif: true },
  })
  console.log("✓ Kasir: kasir@e-learning.qu / keuangan123")

  const bendahara = await upsertUser("bendahara@e-learning.qu", "Bendahara", "GURU")
  await prisma.keuanganStaff.upsert({
    where: { userId: bendahara.id },
    create: { userId: bendahara.id, peran: "BENDAHARA", unit: null },
    update: { peran: "BENDAHARA", aktif: true },
  })
  console.log("✓ Bendahara: bendahara@e-learning.qu / keuangan123")

  let outlet = await prisma.kantinOutlet.findFirst({ where: { kode: "KANTIN-UTAMA" } })
  if (!outlet) {
    outlet = await prisma.kantinOutlet.create({
      data: { nama: "Kantin Utama", kode: "KANTIN-UTAMA", lokasi: "Lantai 1", createdBy: bendahara.id },
    })
    console.log("✓ Outlet KANTIN-UTAMA dibuat")
  }

  const produk = [
    { nama: "Nasi Ayam", sku: "NS-AYM", hargaJual: 12_000, hargaModal: 8_000, stok: 50 },
    { nama: "Es Teh", sku: "ES-TEH", hargaJual: 3_000, hargaModal: 1_500, stok: 100 },
  ]
  for (const p of produk) {
    await prisma.kantinProduk.upsert({
      where: { outletId_sku: { outletId: outlet.id, sku: p.sku } },
      create: { outletId: outlet.id, ...p, satuan: "porsi" },
      update: { hargaJual: p.hargaJual, hargaModal: p.hargaModal, aktif: true },
    })
  }
  console.log(`✓ Produk: ${produk.length}`)

  // Kasir penugasan ke outlet
  await prisma.keuanganStaff.update({
    where: { userId: kasir.id },
    data: { outletId: outlet.id },
  })

  console.log(`\nSelesai (ts=${ts}).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
