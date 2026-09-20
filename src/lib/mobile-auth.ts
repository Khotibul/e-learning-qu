import { prisma } from "./prisma"

/**
 * Verifikasi token mobile (base64 userId:role:timestamp) — 1 DB
 * Token dibuat di /api/mobile/auth/login via Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString("base64")
 * Untuk produksi, ganti dengan JWT verifikasi AUTH_SECRET (jose).
 */
export async function getMobileUser(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!auth || !auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const [userId, role] = decoded.split(":")
    if (!userId || !role) return null

    // Cek expiry 7 hari
    const ts = Number(decoded.split(":")[2])
    if (ts && Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) return null
    if (user.role !== role) return null

    return user
  } catch {
    return null
  }
}
