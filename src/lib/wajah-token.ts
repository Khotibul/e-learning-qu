import { SignJWT, jwtVerify } from "jose"

/**
 * Token khusus kiosk absensi wajah (`/absensi/wajah?t=...`).
 * Ditandatangani AUTH_SECRET, berumur pendek, dan HANYA boleh mencatat
 * absensi wajah — bukan token akses API umum.
 */

const encoder = new TextEncoder()
export const WAJAH_TOKEN_TTL_SECONDS = 20 * 60

/** Kiosk desktop: cookie berumur panjang supaya absensi tidak perlu login tiap kali. */
export const KIOSK_COOKIE = "kiosk_absensi"
export const KIOSK_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

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
export type KioskTokenPayload = { sub: string; nama: string | null; exp: number | null }

/** Token kiosk desktop — hanya membuka halaman absensi kiosk, bukan API umum. */
export async function signKioskToken(userId: string, nama?: string | null): Promise<string> {
  return await new SignJWT({ typ: "kiosk", nama: nama ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + KIOSK_TOKEN_TTL_SECONDS)
    .sign(getSecret())
}

export async function verifyKioskToken(token: string): Promise<KioskTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.typ !== "kiosk" || !payload.sub) return null
    return {
      sub: payload.sub,
      nama: typeof payload.nama === "string" ? payload.nama : null,
      exp: typeof payload.exp === "number" ? payload.exp : null,
    }
  } catch {
    return null
  }
}

/** Ambil satu nilai cookie dari header Cookie (tanpa parser tambahan). */
export function bacaCookie(header: string | null, nama: string): string {
  if (!header) return ""
  for (const bagian of header.split(";")) {
    const i = bagian.indexOf("=")
    if (i < 0) continue
    if (bagian.slice(0, i).trim() !== nama) continue
    try {
      return decodeURIComponent(bagian.slice(i + 1).trim())
    } catch {
      return bagian.slice(i + 1).trim()
    }
  }
  return ""
}

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
