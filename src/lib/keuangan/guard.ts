import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── GUARD RBAC MODUL KEUANGAN ───────────────────────────────────────
// Default deny. Semua aksi keuangan wajib melewati guard ini di backend;
// menyembunyikan menu bukan pengamanan.

export type PeranKeuanganKode = "BENDAHARA" | "KASIR" | "AUDITOR"

/** Wali resmi (akun login cocok WaliSantri.userId) → waliId. */
export async function requireWaliKeuangan(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const wali = await prisma.waliSantri.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { id: true },
  })
  if (!wali) throw new Error("Akun ini bukan wali santri terdaftar")
  return wali.id
}

/** User siswa/santri yang punya dompet → userId. */
export async function requirePemilikDompet(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true, siswa: { select: { id: true } }, santri: { select: { id: true } } },
  })
  if (!user?.isActive) throw new Error("Unauthorized")
  if (user.role !== "SISWA" && !user.santri && !user.siswa) throw new Error("Hanya siswa/santri yang memiliki dompet")
  return session.user.id
}

/** Cek wali berhak atas anak: waliId → punya relasi SantriWali ke santriId ini. */
export async function waliBerhakAtasSantri(waliId: string, santriId: string): Promise<boolean> {
  const rel = await prisma.santriWali.findFirst({
    where: { waliId, santriId, santri: { deletedAt: null } },
    select: { id: true },
  })
  return Boolean(rel)
}

/** Cek wali berhak atas user pemilik dompet (via Santri.siswa/userId). */
export async function waliBerhakAtasUser(waliId: string, userId: string): Promise<boolean> {
  const rel = await prisma.santriWali.findFirst({
    where: { waliId, santri: { userId, deletedAt: null } },
    select: { id: true },
  })
  return Boolean(rel)
}

/**
 * Penugasan keuangan aktif. ADMIN selalu lolos (super). Selain itu wajib ada
 * baris KeuanganStaff.untuk user tsb, dengan peran & scope yang cocok.
 */
export async function requirePetugasKeuangan(
  peran: PeranKeuanganKode,
  opts?: { butuhOutlet?: string; scopeUnit?: "SEKOLAH" | "PONDOK" }
): Promise<{ userId: string; isSuper: boolean; outletId: string | null; unit: string | null }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true } })
  if (!user?.isActive) throw new Error("Unauthorized")
  if (user.role === "ADMIN") return { userId: session.user.id, isSuper: true, outletId: null, unit: null }

  const asg = await prisma.keuanganStaff.findFirst({
    where: {
      userId: session.user.id,
      aktif: true,
      peran: peran as never,
      ...(opts?.butuhOutlet ? { OR: [{ outletId: opts.butuhOutlet }, { outletId: null }] } : {}),
      ...(opts?.scopeUnit ? { OR: [{ unit: opts.scopeUnit }, { unit: null }] } : {}),
    },
    select: { id: true, outletId: true, unit: true },
  })
  if (!asg) throw new Error(`Forbidden: tidak memiliki penugasan ${peran}`)
  return { userId: session.user.id, isSuper: false, outletId: asg.outletId, unit: asg.unit }
}

/** Kepala Pondok / Admin: monitoring keuangan pondok (read-only, tanpa koreksi saldo). */
export async function requireMonitoringKeuanganPondok(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN" && user?.role !== "KEPALA_PONDOK") throw new Error("Forbidden")
  return session.user.id
}
