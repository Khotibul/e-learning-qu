import { PrismaClient, type PondokTugas } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Seed idempoten akun staf pondok + penugasan awal (untuk login manual & test).
async function upsertAkun(email: string, name: string, role: "KEPALA_PONDOK" | "PENGURUS_PONDOK" | "USTADZ_PONDOK", password: string) {
  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, role, password: hashed, isActive: true, emailVerified: new Date() },
    update: { role, name },
  })
  console.log(`✓ ${role}: ${email} / ${password}`)
  return user
}

async function main() {
  const kepala = await upsertAkun("kepala@e-learning.qu", "Kepala Pondok", "KEPALA_PONDOK", "kepala123")
  const pengurus = await upsertAkun("pengurus@e-learning.qu", "Pengurus Pondok", "PENGURUS_PONDOK", "pengurus123")
  const ustadz = await upsertAkun("ustadz@e-learning.qu", "Ustadz Pondok", "USTADZ_PONDOK", "ustadz123")

  // Halaqah + kelas diniyah contoh (idempoten by nama)
  let halaqah = await prisma.halaqah.findFirst({ where: { nama: "Halaqah An-Nur" } })
  if (!halaqah) {
    halaqah = await prisma.halaqah.create({ data: { nama: "Halaqah An-Nur", tingkat: "Pemula", targetSurah: "Juz 30", pengampuId: ustadz.id } })
    console.log("✓ Halaqah An-Nur dibuat")
  }
  let kelas = await prisma.kelasDiniyah.findFirst({ where: { nama: "Diniyah Al-Fatih" } })
  if (!kelas) {
    kelas = await prisma.kelasDiniyah.create({ data: { nama: "Diniyah Al-Fatih", tingkat: "Dasar", hari: "Senin", jam: "16:00-17:00", pengampuId: ustadz.id } })
    console.log("✓ Diniyah Al-Fatih dibuat")
  }

  const upsertAsg = async (userId: string, tipe: PondokTugas, extra: Record<string, string | null> = {}) => {
    const existing = await prisma.pondokStaffAssignment.findFirst({ where: { userId, tipe, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) } })
    if (existing) return existing
    return prisma.pondokStaffAssignment.create({ data: { userId, tipe, ...extra } })
  }

  await upsertAsg(ustadz.id, "USTADZ_TAHFIDZ", { halaqahId: halaqah.id })
  await upsertAsg(ustadz.id, "USTADZ_DINIYAH", { kelasDiniyahId: kelas.id })
  console.log("✓ Penugasan ustadz (tahfidz + diniyah)")

  // Pengurus: scope ke asrama pertama bila ada (global bila belum ada asrama)
  const asrama = await prisma.asrama.findFirst({ where: { aktif: true } })
  await upsertAsg(pengurus.id, "PENGURUS", asrama ? { asramaId: asrama.id } : {})
  console.log(`✓ Penugasan pengurus${asrama ? ` (asrama: ${asrama.nama})` : " (global — belum ada asrama)"}`)

  console.log("\nSelesai. Login via menu 'Login Pengelola Pondok' di /login.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
