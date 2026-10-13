import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileJwtPayload } from "@/lib/mobile-jwt"

/**
 * Profil user dari access token desktop — dipakai app saat startup (validasi sesi tersimpan).
 * GET /api/mobile/auth/desktop/me
 * Header: Authorization: Bearer <accessToken JWT>
 */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function GET(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  const payload = await getMobileJwtPayload(req, "access")
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, image: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
  }

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role } },
    { headers: corsHeaders }
  )
}
