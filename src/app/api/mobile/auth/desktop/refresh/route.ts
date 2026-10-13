import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signMobileToken, verifyMobileToken, ACCESS_TOKEN_TTL_SECONDS } from "@/lib/mobile-jwt"

/**
 * Refresh access token desktop.
 * POST /api/mobile/auth/desktop/refresh
 * Body: { refreshToken }
 *
 * Stateless: refresh token diverifikasi (HS256) + user dicek ulang di DB (isActive & role terkini).
 * Tidak ada tabel baru; refresh token lama tetap valid sampai exp-nya (30 hari).
 */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  try {
    const body = await req.json().catch(() => null)
    const refreshToken = String(body?.refreshToken ?? "")
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken wajib diisi" }, { status: 400, headers: corsHeaders })
    }

    const payload = await verifyMobileToken(refreshToken, "refresh")
    if (!payload) {
      return NextResponse.json({ error: "Refresh token tidak valid atau kedaluwarsa" }, { status: 401, headers: corsHeaders })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Akun tidak ditemukan atau dinonaktifkan" }, { status: 401, headers: corsHeaders })
    }

    const accessToken = await signMobileToken(user.id, user.role, "access")
    return NextResponse.json(
      { success: true, accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, role: user.role },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Desktop refresh error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: corsHeaders })
  }
}
