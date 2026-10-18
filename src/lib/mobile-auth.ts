import { prisma } from "./prisma"
import { verifyMobileToken } from "./mobile-jwt"

/**
 * Verifikasi token mobile — 1 DB.
 * Hanya JWT signed (HS256/AUTH_SECRET) yang diterima.
 * Token base64 murni lama (userId:role:timestamp) sudah DIHAPUS —
 * format itu bisa dipalsukan siapa pun tanpa login.
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
  if (!looksLikeJwt(token)) return null
  const payload = await verifyMobileToken(token, "access")
  if (!payload) return null
  return await loadVerifiedUser(payload.sub, payload.role)
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
