import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { PenerimaNotifikasi } from "@/lib/notifikasi"

// ─── EKOSISTEM RBAC PONDOK ─────────────────────────────────────────────
// Default deny. Permission = kode aksi + cakupan (scope). Sumber grant:
// 1) role dasar (User.role) → set permission global
// 2) PondokStaffAssignment (multi-role + scope: asrama/halaqah/kelas/kamar/unit)
// 3) PondokPermissionGrant (override granular, opsional)
// Backend WAJIB memvalidasi via requirePondok/canPondok — menyembunyikan menu
// di sidebar bukan pengamanan.

export const PONDOK_PERMISSIONS = [
  "pondok.dashboard.view",
  "pondok.santri.view",
  "pondok.santri.update",
  "pondok.asrama.manage",
  "pondok.kegiatan.manage",
  "pondok.absensi.create",
  "pondok.absensi.correct",
  "pondok.izin.view",
  "pondok.izin.recommend",
  "pondok.izin.approve",
  "pondok.izin.reject",
  "pondok.izin.checkout",
  "pondok.izin.checkin",
  "pondok.diniyah.manage",
  "pondok.diniyah.grade",
  "pondok.tahfidz.manage",
  "pondok.tahfidz.assess",
  "pondok.pembinaan.manage",
  "pondok.pengumuman.publish",
  "pondok.laporan.view",
  "pondok.laporan.export",
] as const

export type PondokPermission = (typeof PONDOK_PERMISSIONS)[number]

export type PondokScope = {
  asramaId?: string | null
  kamarId?: string | null
  halaqahId?: string | null
  kelasDiniyahId?: string | null
  unit?: string | null
}

export type PondokAccess = {
  userId: string
  role: string
  permissions: PondokPermission[] // daftar unik semua permission efektif
  scopes: PondokScope[] // cakupan yang diberikan (global = objek kosong {})
  isGlobal: boolean // true = akses seluruh pondok (admin/kepala pondok)
  assignments: {
    id: string
    tipe: string
    asramaId: string | null
    kamarId: string | null
    halaqahId: string | null
    kelasDiniyahId: string | null
    unit: string | null
  }[]
}

// ─── SET PERMISSION PER ROLE DASAR ─────────────────────────────────────
// least privilege: hanya permission yang dibutuhkan per peran.

const PERM_PENGURUS: PondokPermission[] = [
  "pondok.dashboard.view",
  "pondok.santri.view",
  "pondok.santri.update",
  "pondok.kegiatan.manage",
  "pondok.absensi.create",
  "pondok.absensi.correct",
  "pondok.izin.view",
  "pondok.izin.recommend",
  "pondok.izin.reject",
  "pondok.izin.checkin",
  "pondok.asrama.manage",
  "pondok.pembinaan.manage",
  "pondok.pengumuman.publish",
  "pondok.laporan.view",
]

const PERM_USTADZ: PondokPermission[] = [
  "pondok.dashboard.view",
  "pondok.santri.view",
  "pondok.absensi.create",
  "pondok.absensi.correct",
  "pondok.diniyah.manage",
  "pondok.diniyah.grade",
  "pondok.tahfidz.manage",
  "pondok.tahfidz.assess",
  "pondok.izin.view",
  "pondok.izin.recommend",
  "pondok.pembinaan.manage",
  "pondok.laporan.view",
]

const PERM_KEPALA: PondokPermission[] = [...PONDOK_PERMISSIONS]

// Penugasan tipe → permission yang diberikan (scope mengikuti field assignment).
const TUGAS_PERMISSIONS: Record<string, PondokPermission[]> = {
  PENGURUS: PERM_PENGURUS,
  USTADZ_DINIYAH: ["pondok.dashboard.view", "pondok.santri.view", "pondok.absensi.create", "pondok.absensi.correct", "pondok.diniyah.manage", "pondok.diniyah.grade", "pondok.izin.view", "pondok.izin.recommend", "pondok.pembinaan.manage", "pondok.laporan.view"],
  USTADZ_TAHFIDZ: ["pondok.dashboard.view", "pondok.santri.view", "pondok.absensi.create", "pondok.tahfidz.manage", "pondok.tahfidz.assess", "pondok.izin.view", "pondok.izin.recommend", "pondok.pembinaan.manage", "pondok.laporan.view"],
  MUSYRIF: ["pondok.dashboard.view", "pondok.santri.view", "pondok.santri.update", "pondok.absensi.create", "pondok.izin.view", "pondok.izin.recommend", "pondok.asrama.manage", "pondok.pembinaan.manage", "pondok.laporan.view"],
  PEMBINA_KEGIATAN: ["pondok.dashboard.view", "pondok.santri.view", "pondok.kegiatan.manage", "pondok.absensi.create", "pondok.izin.view", "pondok.laporan.view"],
  WALI_KELOMPOK: ["pondok.dashboard.view", "pondok.santri.view", "pondok.pembinaan.manage", "pondok.izin.view", "pondok.izin.recommend"],
  PETUGAS_GERBANG: ["pondok.dashboard.view", "pondok.izin.view", "pondok.izin.checkout", "pondok.izin.checkin"],
}

const ROLE_BASE: Record<string, PondokPermission[] | "GLOBAL"> = {
  ADMIN: "GLOBAL",
  KEPALA_PONDOK: "GLOBAL",
  PENGURUS_PONDOK: PERM_PENGURUS, // scope mengikuti assignment (global bila tanpa scope)
  USTADZ_PONDOK: PERM_USTADZ, // scope mengikuti assignment (global bila tanpa scope)
}

// ─── RESOLVER AKSES ────────────────────────────────────────────────────

const cache = new Map<string, { akses: PondokAccess; exp: number }>()
const CACHE_TTL_MS = 30_000

export async function getPondokAccess(userId: string, opts?: { bypassCache?: boolean }): Promise<PondokAccess> {
  const now = Date.now()
  if (!opts?.bypassCache) {
    const c = cache.get(userId)
    if (c && c.exp > now) return c.akses
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true, deletedAt: true } })
  if (!user || !user.isActive || user.deletedAt) throw new Error("Unauthorized")

  const base = ROLE_BASE[user.role]
  const permSet = new Set<PondokPermission>()
  const scopes: PondokScope[] = []
  let isGlobal = false

  if (base === "GLOBAL") {
    isGlobal = true
    for (const p of PONDOK_PERMISSIONS) permSet.add(p)
    scopes.push({}) // global scope
  } else if (base) {
    for (const p of base) permSet.add(p)
  }

  const assignments = await prisma.pondokStaffAssignment.findMany({
    where: { userId, aktif: true },
    select: { id: true, tipe: true, asramaId: true, kamarId: true, halaqahId: true, kelasDiniyahId: true, unit: true },
  })

  for (const a of assignments) {
    const tipePerms = TUGAS_PERMISSIONS[a.tipe] ?? []
    for (const p of tipePerms) permSet.add(p)
    scopes.push({ asramaId: a.asramaId, kamarId: a.kamarId, halaqahId: a.halaqahId, kelasDiniyahId: a.kelasDiniyahId, unit: a.unit })
    if (!a.asramaId && !a.halaqahId && !a.kelasDiniyahId && !a.kamarId && !a.unit) {
      // assignment tanpa batas → cakupan seluruh pondok untuk permission tipe tsb
      // (tidak meng-global-kan permission lain di luar set tipe)
    }
  }

  const grants = await prisma.pondokPermissionGrant.findMany({
    where: { userId, aktif: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { permission: true, scopeType: true, scopeId: true },
  })
  for (const g of grants) {
    if ((PONDOK_PERMISSIONS as readonly string[]).includes(g.permission)) {
      permSet.add(g.permission as PondokPermission)
      if (!g.scopeType) scopes.push({})
      else if (g.scopeType === "ASRAMA") scopes.push({ asramaId: g.scopeId ?? null })
      else if (g.scopeType === "HALAQAH") scopes.push({ halaqahId: g.scopeId ?? null })
      else if (g.scopeType === "KELAS_DINIYAH") scopes.push({ kelasDiniyahId: g.scopeId ?? null })
      else if (g.scopeType === "KAMAR") scopes.push({ kamarId: g.scopeId ?? null })
    }
  }

  const akses: PondokAccess = {
    userId,
    role: user.role,
    permissions: [...permSet].sort(),
    scopes,
    isGlobal,
    assignments: assignments.map((a) => ({ id: a.id, tipe: a.tipe, asramaId: a.asramaId, kamarId: a.kamarId, halaqahId: a.halaqahId, kelasDiniyahId: a.kelasDiniyahId, unit: a.unit })),
  }
  cache.set(userId, { akses, exp: Date.now() + CACHE_TTL_MS })
  return akses
}

export function invalidatePondokAccess(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

// ─── CEK PERMISSION + SCOPE ────────────────────────────────────────────

/** Apakah user punya permission ini (secara global di setidaknya satu scope)? */
export async function canPondok(userId: string, permission: PondokPermission): Promise<boolean> {
  try {
    const akses = await getPondokAccess(userId)
    return akses.permissions.includes(permission)
  } catch {
    return false
  }
}

/**
 * Cek permission + apakah santri berada dalam scope penugasan user.
 * isGlobal → lolos semua. Tanpa assignment scope → user role pondok (PENGURUS/USTADZ)
 * dengan set permission tersebut tetap dibatasi: akses hanya santri dalam scope-nya;
 * bila TIDAK ADA scope sama sekali (tanpa assignment) → hanya isGlobal yang lolos
 * (default deny untuk staf tanpa penugasan).
 */
export async function bolehAksesSantri(userId: string, permission: PondokPermission, santriId: string): Promise<boolean> {
  const akses = await getPondokAccess(userId)
  if (!akses.permissions.includes(permission)) return false
  if (akses.isGlobal) return true
  const santri = await prisma.santri.findUnique({
    where: { id: santriId },
    select: { asramaId: true, kamarId: true, halaqahId: true, kelasDiniyahId: true },
  })
  if (!santri) return false
  return scopesMencakupSantri(akses.scopes, santri)
}

function scopesMencakupSantri(scopes: PondokScope[], santri: { asramaId: string | null; kamarId: string | null; halaqahId: string | null; kelasDiniyahId: string | null }): boolean {
  for (const s of scopes) {
    const kosong = !s.asramaId && !s.kamarId && !s.halaqahId && !s.kelasDiniyahId && !s.unit
    if (kosong) return true // scope global eksplisit (grant tanpa scope / admin)
    if (s.asramaId && santri.asramaId === s.asramaId) return true
    if (s.kamarId && santri.kamarId === s.kamarId) return true
    if (s.halaqahId && santri.halaqahId === s.halaqahId) return true
    if (s.kelasDiniyahId && santri.kelasDiniyahId === s.kelasDiniyahId) return true
  }
  return false
}

/** ID santri yang boleh dilihat user (scope-aware). [] = tidak ada (default deny). */
export async function santriIdsDalamScope(userId: string): Promise<string[] | "SEMUA"> {
  const akses = await getPondokAccess(userId)
  if (!akses.permissions.includes("pondok.santri.view")) return []
  if (akses.isGlobal) return "SEMUA"
  const punyaScope = akses.scopes.some((s) => s.asramaId || s.kamarId || s.halaqahId || s.kelasDiniyahId)
  if (!punyaScope) return [] // staf pondok tanpa penugasan → tidak melihat santri
  const asramaIds = [...new Set(akses.scopes.map((s) => s.asramaId).filter((x): x is string => Boolean(x)))]
  const kamarIds = [...new Set(akses.scopes.map((s) => s.kamarId).filter((x): x is string => Boolean(x)))]
  const halaqahIds = [...new Set(akses.scopes.map((s) => s.halaqahId).filter((x): x is string => Boolean(x)))]
  const kelasIds = [...new Set(akses.scopes.map((s) => s.kelasDiniyahId).filter((x): x is string => Boolean(x)))]
  const rows = await prisma.santri.findMany({
    where: {
      deletedAt: null,
      status: "AKTIF",
      OR: [
        ...(asramaIds.length ? [{ asramaId: { in: asramaIds } }] : []),
        ...(kamarIds.length ? [{ kamarId: { in: kamarIds } }] : []),
        ...(halaqahIds.length ? [{ halaqahId: { in: halaqahIds } }] : []),
        ...(kelasIds.length ? [{ kelasDiniyahId: { in: kelasIds } }] : []),
      ],
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

// ─── GUARD SERVER ACTION ───────────────────────────────────────────────

/** Guard utama: session valid + permission. Return userId. Default deny. */
export async function requirePondok(permission: PondokPermission): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const akses = await getPondokAccess(session.user.id)
  if (!akses.permissions.includes(permission)) throw new Error("Forbidden: tidak memiliki akses")
  return session.user.id
}

/** Guard + scope santri dalam satu panggilan (untuk aksi per santri). */
export async function requirePondokSantri(permission: PondokPermission, santriId: string): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const ok = await bolehAksesSantri(session.user.id, permission, santriId)
  if (!ok) throw new Error("Forbidden: santri di luar cakupan penugasan")
  return session.user.id
}

// ─── PENERIMA NOTIFIKASI PONDOK ────────────────────────────────────────

export async function penerimaKepalaPondok(): Promise<PenerimaNotifikasi[]> {
  const users = await prisma.user.findMany({ where: { role: { in: ["KEPALA_PONDOK", "ADMIN"] }, isActive: true }, select: { id: true }, take: 10 })
  return users.map((u) => ({ userId: u.id, label: "kepala-pondok", link: "/kepala-pondok" }))
}

export async function penerimaPengurus(): Promise<PenerimaNotifikasi[]> {
  const [byRole, byTugas] = await Promise.all([
    prisma.user.findMany({ where: { role: "PENGURUS_PONDOK", isActive: true }, select: { id: true }, take: 10 }),
    prisma.pondokStaffAssignment.findMany({ where: { tipe: "PENGURUS", aktif: true }, select: { user: { select: { id: true, isActive: true } } }, take: 20 }),
  ])
  const ids = new Set<string>()
  for (const u of byRole) ids.add(u.id)
  for (const a of byTugas) if (a.user.isActive) ids.add(a.user.id)
  return [...ids].map((id) => ({ userId: id, label: "pengurus", link: "/pengurus" }))
}

/** Ustadz yang membina santri tertentu (halaqah / kelas diniyah / asrama). */
export async function penerimaUstadzSantri(santriId: string): Promise<PenerimaNotifikasi[]> {
  const santri = await prisma.santri.findUnique({
    where: { id: santriId },
    select: { halaqahId: true, kelasDiniyahId: true, asramaId: true },
  })
  if (!santri) return []
  const ids = new Set<string>()

  if (santri.halaqahId) {
    const h = await prisma.halaqah.findUnique({ where: { id: santri.halaqahId }, select: { pengampuId: true } })
    if (h?.pengampuId) ids.add(h.pengampuId)
    const asg = await prisma.pondokStaffAssignment.findMany({ where: { halaqahId: santri.halaqahId, aktif: true }, select: { userId: true } })
    for (const a of asg) ids.add(a.userId)
  }
  if (santri.kelasDiniyahId) {
    const k = await prisma.kelasDiniyah.findUnique({ where: { id: santri.kelasDiniyahId }, select: { pengampuId: true } })
    if (k?.pengampuId) ids.add(k.pengampuId)
    const asg = await prisma.pondokStaffAssignment.findMany({ where: { kelasDiniyahId: santri.kelasDiniyahId, aktif: true }, select: { userId: true } })
    for (const a of asg) ids.add(a.userId)
  }
  if (santri.asramaId) {
    const asg = await prisma.pondokStaffAssignment.findMany({ where: { asramaId: santri.asramaId, tipe: { in: ["MUSYRIF", "PENGURUS"] }, aktif: true }, select: { userId: true } })
    for (const a of asg) ids.add(a.userId)
    const asrama = await prisma.asrama.findUnique({ where: { id: santri.asramaId }, select: { musyrif: { select: { userId: true } } } })
    if (asrama?.musyrif?.userId) ids.add(asrama.musyrif.userId)
  }
  if (ids.size === 0) return []
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] }, isActive: true }, select: { id: true } })
  return users.map((u) => ({ userId: u.id, label: "ustadz", link: "/ustadz" }))
}

// ─── PENGATURAN MENU (sidebar berbasis permission) ─────────────────────
// Client memakai permission daftar dari session; server tetap memvalidasi.

export function menuPondokBerdasarkanPermission(perms: string[]): { href: string; label: string }[] {
  const p = new Set(perms)
  const menu: { href: string; label: string; butuh: PondokPermission }[] = [
    { href: "/kepala-pondok", label: "Dashboard Kepala Pondok", butuh: "pondok.dashboard.view" },
    { href: "/pengurus", label: "Dashboard Pengurus", butuh: "pondok.dashboard.view" },
    { href: "/ustadz", label: "Dashboard Ustadz", butuh: "pondok.dashboard.view" },
  ]
  return menu.filter((m) => p.has(m.butuh))
}
