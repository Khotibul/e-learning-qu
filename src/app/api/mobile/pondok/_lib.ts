import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { getPondokAccess, type PondokPermission } from "@/lib/pondok-rbac"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function options() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export type MobileUser = NonNullable<Awaited<ReturnType<typeof getMobileUser>>>

export type PondokCtx =
  | { user: MobileUser; akses: Awaited<ReturnType<typeof getPondokAccess>>; error?: undefined }
  | { user?: undefined; akses?: undefined; error: NextResponse }

/**
 * Guard mobile pondok: getMobileUser (bukan NextAuth cookie) + getPondokAccess (session-free).
 * Permission dicek di set; scope dicek terpisah via scopeFilter().
 */
export async function requirePondok(req: Request, permission: PondokPermission): Promise<PondokCtx> {
  const user = await getMobileUser(req)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }) }
  if (!user.isActive) return { error: NextResponse.json({ error: "Akun nonaktif" }, { status: 403, headers: corsHeaders }) }

  let akses: Awaited<ReturnType<typeof getPondokAccess>>
  try {
    akses = await getPondokAccess(user.id)
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }) }
  }

  if (!akses.permissions.includes(permission)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders }) }
  }
  return { user, akses }
}

/**
 * Filter scope santri untuk query. Mengembalikan `{ scopeSemua, santriIdIn }`.
 * `santriIdIn === null` → scope global (tanpa filter).
 * `santriIdIn === []` → default deny (kembalikan list kosong, jangan query dengan `in: []` saja tanpa sadar).
 */
export async function scopeFilter(userId: string): Promise<{ scopeSemua: boolean; santriIdIn: string[] | null }> {
  const ids = await (await import("@/lib/pondok-rbac")).santriIdsDalamScope(userId)
  if (ids === "SEMUA") return { scopeSemua: true, santriIdIn: null }
  return { scopeSemua: false, santriIdIn: ids }
}

/** Port mobile dari requireGerbang(): ADMIN | Guru jabatan GERBANG/MUSYRIF/PENGASUH | pegang pondok.izin.checkout. */
export async function requireGerbang(req: Request): Promise<
  { user: MobileUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getMobileUser(req)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }) }
  if (user.role === "ADMIN") return { user }

  const guru = await prisma.guru.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { jabatan: true },
  })
  if (guru && ["GERBANG", "MUSYRIF", "PENGASUH"].includes(guru.jabatan ?? "")) return { user }

  try {
    const akses = await getPondokAccess(user.id)
    if (akses.permissions.includes("pondok.izin.checkout")) return { user }
  } catch { /* jatuh ke forbidden */ }

  return { error: NextResponse.json({ error: "Bukan petugas gerbang" }, { status: 403, headers: corsHeaders }) }
}

/** Port mobile dari requireMonitoringKeuanganPondok(): role ADMIN | KEPALA_PONDOK saja. */
export async function requireKuanganPondok(req: Request): Promise<
  { user: MobileUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getMobileUser(req)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }) }
  if (user.role !== "ADMIN" && user.role !== "KEPALA_PONDOK") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders }) }
  }
  return { user }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

export function fail(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders })
}
