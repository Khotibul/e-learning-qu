import { prisma } from "./prisma"
import { verifyMobileToken } from "./mobile-jwt"

/**
 * Verifikasi token mobile — 1 DB.
 * Dua format didukung di header yang SAMA:
 * 1. JWT signed (HS256/AUTH_SECRET) — client desktop C# (access token, /api/mobile/auth/desktop/login).
 * 2. base64 userId:role:timestamp — Flutter lama (/api/mobile/auth/login). Perilaku TIDAK berubah.
 */

type MobileUser = { id: string; email: string; name: string | null; role: string; isActive: boolean }

function looksLikeJwt(token: string): boolean {
  const parts = token.split(".")
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

async function loadVerifiedUser(userId: string, roleFromToken: string | null): Promise<MobileUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) return null
  if (roleFromToken && user.role !== roleFromToken) return null
  return user
}

async function verifyBearerToken(token: string): Promise<MobileUser | null> {
  if (looksLikeJwt(token)) {
    const payload = await verifyMobileToken(token, "access")
    if (!payload) return null
    return await loadVerifiedUser(payload.sub, payload.role)
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const [userId, role] = decoded.split(":")
    if (!userId || !role) return null

    // Cek expiry 7 hari
    const ts = Number(decoded.split(":")[2])
    if (ts && Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return null

    return await loadVerifiedUser(userId, role)
  } catch {
    return null
  }
}

export async function getMobileUser(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!auth || !auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  if (!token) return null
  try {
    return await verifyBearerToken(token)
  } catch {
    return null
  }
}

/**
 * Verifikasi token mobile dari header Authorization via next/headers —
 * untuk dipakai di server action (tanpa objek Request).
 */
export async function getMobileUserFromHeaders() {
  const { headers } = await import("next/headers")
  const h = await headers()
  const auth = h.get("authorization") || h.get("Authorization")
  if (!auth || !auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  if (!token) return null
  try {
    return await verifyBearerToken(token)
  } catch {
    return null
  }
}
