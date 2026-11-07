import { SignJWT, jwtVerify } from "jose"

/**
 * Token khusus kiosk absensi wajah (`/absensi/wajah?t=...`).
 * Ditandatangani AUTH_SECRET, berumur pendek, dan HANYA boleh mencatat
 * absensi wajah — bukan token akses API umum.
 */

const encoder = new TextEncoder()
export const WAJAH_TOKEN_TTL_SECONDS = 20 * 60

export type WajahTokenPayload = { sub: string; role: string; operator: string; exp: number | null }

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET belum diset — wajib untuk token absensi wajah")
  return encoder.encode(secret)
}

export async function signWajahToken(userId: string, role: string, operator?: string | null): Promise<string> {
  return await new SignJWT({ role, typ: "wajah", operator: operator ?? role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + WAJAH_TOKEN_TTL_SECONDS)
    .sign(getSecret())
}

/** Verifikasi token wajah. null bila invalid/kedaluwarsa/typ salah. */
export async function verifyWajahToken(token: string): Promise<WajahTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.typ !== "wajah") return null
    if (!payload.sub || typeof payload.role !== "string") return null
    return {
      sub: payload.sub,
      role: payload.role,
      operator: String(payload.operator ?? payload.role),
      exp: typeof payload.exp === "number" ? payload.exp : null,
    }
  } catch {
    return null
  }
}
