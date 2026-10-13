import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { signMobileToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/mobile-jwt"

/**
 * Login desktop (C#/.NET WPF) — JWT signed + refresh.
 * POST /api/mobile/auth/desktop/login
 * Body: { email, password, role: "SISWA" | "GURU" }
 *
 * Query & aturan SAMA dengan /api/mobile/auth/login (route Flutter) — akun, DB, validasi identik.
 * Yang berbeda HANYA bentuk token: JWT signed (HS256/AUTH_SECRET) + refresh token.
 * Route login Flutter lama TIDAK diubah.
 */

const DESKTOP_ROLES = ["SISWA", "GURU", "ADMIN", "RESEARCHER", "KEPALA_PONDOK", "PENGURUS_PONDOK", "USTADZ_PONDOK"]

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function POST(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  try {
    const body = await req.json()
    const email = String(body.email ?? "").trim()
    const password = String(body.password ?? "")
    const role = String(body.role ?? "").trim().toUpperCase()

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Email, password, role wajib diisi" }, { status: 400, headers: corsHeaders })
    }
    if (!DESKTOP_ROLES.includes(role)) {
      return NextResponse.json({ error: "Role desktop tidak didukung" }, { status: 400, headers: corsHeaders })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, image: true, role: true, password: true, isActive: true },
    })

    if (!user || !user.password) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401, headers: corsHeaders })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "Akun dinonaktifkan" }, { status: 403, headers: corsHeaders })
    }
    if (user.role !== role) {
      return NextResponse.json({ error: `Akun ini terdaftar sebagai ${user.role}, bukan ${role}` }, { status: 401, headers: corsHeaders })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401, headers: corsHeaders })
    }

    let extra: Record<string, unknown> = {}
    if (user.role === "SISWA") {
      const siswa = await prisma.siswa.findUnique({
        where: { userId: user.id },
        select: { id: true, nama: true, nis: true, jabatan: true, kelas: { select: { id: true, nama: true } } },
      })
      if (siswa) extra = { siswaId: siswa.id, siswaNama: siswa.nama, nis: siswa.nis, kelas: siswa.kelas, jabatan: siswa.jabatan }
    } else if (user.role === "GURU") {
      const guru = await prisma.guru.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, nama: true, jabatan: true },
      })
      if (guru) extra = { guruId: guru.id, guruNama: guru.nama, jabatan: guru.jabatan }
    } else if (["KEPALA_PONDOK", "PENGURUS_PONDOK", "USTADZ_PONDOK"].includes(user.role)) {
      // Sertakan penugasan pondok aktif (tipe + scope) untuk RBAC desktop.
      const assignments = await prisma.pondokStaffAssignment.findMany({
        where: { userId: user.id, aktif: true },
        select: { tipe: true, asramaId: true, kamarId: true, halaqahId: true, kelasDiniyahId: true, unit: true },
      })
      const grants = await prisma.pondokPermissionGrant.findMany({
        where: { userId: user.id, aktif: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { permission: true, scopeType: true, scopeId: true },
      })
      extra = { pondokAssignments: assignments, pondokGrants: grants }
    }

    const accessToken = await signMobileToken(user.id, user.role, "access")
    const refreshToken = await signMobileToken(user.id, user.role, "refresh")

    return NextResponse.json(
      {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
        user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
        extra,
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Desktop login error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: corsHeaders })
  }
}
