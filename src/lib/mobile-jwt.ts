import { SignJWT, jwtVerify } from "jose"

/**
 * JWT signed untuk client desktop — token BARU, route login Flutter lama TIDAK disentuh.
 * Access token 15 menit, refresh token 30 hari (stateless — tanpa tabel baru).
 * Secret: AUTH_SECRET yang sama dengan NextAuth.
 */

const encoder = new TextEncoder()

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET belum diset — wajib untuk JWT mobile desktop")
  return encoder.encode(secret)
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export type MobileTokenTyp = "access" | "refresh"

export type MobileTokenPayload = {
  sub: string
  role: string
  typ: MobileTokenTyp
}

export async function signMobileToken(userId: string, role: string, typ: MobileTokenTyp): Promise<string> {
  const ttl = typ === "access" ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS
  return await new SignJWT({ role, typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(getSecret())
}

/** Verifikasi JWT. Return null bila invalid / expired / typ salah — fail-closed. */
export async function verifyMobileToken(token: string, expectedTyp: MobileTokenTyp): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.typ !== expectedTyp) return null
    if (!payload.sub || typeof payload.role !== "string") return null
    return { sub: payload.sub, role: payload.role, typ: expectedTyp }
  } catch {
    return null
  }
}

/** Baca header Authorization: Bearer <token> lalu verifikasi. */
export async function getMobileJwtPayload(req: Request, expectedTyp: MobileTokenTyp = "access"): Promise<MobileTokenPayload | null> {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return null
  return await verifyMobileToken(auth.slice(7).trim(), expectedTyp)
}
