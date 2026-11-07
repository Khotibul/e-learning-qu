import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { signWajahToken, WAJAH_TOKEN_TTL_SECONDS } from "@/lib/wajah-token"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * Token kiosk absensi wajah untuk aplikasi Android/desktop.
 * Aplikasi membuka `${url}?t=${token}` di browser perangkat (kamera depan).
 */
export async function POST(req: Request) {
  const user = await getMobileUser(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
  }

  const rl = rateLimit(`wajah-token:${getClientIp(req)}:${user.id}`, 20, 60000)
  if (!rl.success) {
    return NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: corsHeaders })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { tujuan?: string }
    const tujuan = (body?.tujuan ?? new URL(req.url).searchParams.get("tujuan")) === "daftar" ? "daftar" : "absensi"

    const profil = await prisma.profilWajah.findFirst({
      where: {
        OR: [{ userId: user.id }, { siswa: { userId: user.id } }],
      },
      select: { id: true, aktif: true, status: true, updatedAt: true },
    })

    const token = await signWajahToken(user.id, user.role, "MOBILE")
    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "")
    const jalur = tujuan === "daftar" ? "/absensi/wajah/daftar" : "/absensi/wajah"

    return NextResponse.json(
      {
        token,
        url: `${base}${jalur}?t=${encodeURIComponent(token)}`,
        tujuan,
        expiresInDetik: WAJAH_TOKEN_TTL_SECONDS,
        terdaftar: !!profil?.aktif,
        pengajuan:
          profil?.status === "MENUNGGU" || profil?.status === "DITOLAK" ? profil.status : null,
        profilDiperbarui: profil?.updatedAt?.toISOString() ?? null,
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Token wajah error:", e)
    return NextResponse.json({ error: "Gagal membuat token absensi wajah" }, { status: 500, headers: corsHeaders })
  }
}
