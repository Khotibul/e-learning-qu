import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { signMobileToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/mobile-jwt"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * Mobile Login — LANGSUNG KE DATABASE (1 DB dengan website)
 * POST /api/mobile/auth/login
 * Body: { email, password, role: "SISWA" | "GURU" }
 * 
 * Website pakai NextAuth credentials authorize() yang juga query:
 *   prisma.user.findUnique({ where: { email } }) + bcrypt.compare + role check
 * Mobile pakai endpoint ini — query SAMA PERSIS, DB SAMA (PostgreSQL db.prisma.io)
 * Jadi login Android & Website baca/tulis tabel `users` yang identik.
 * 
 * CORS enabled untuk Flutter (Origin: capacitor, expo, localhost)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    },
  })
}

export async function POST(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
  }

  try {
    const body = await req.json()
    const email = String(body.email ?? "").trim()
    const password = String(body.password ?? "")
    const role = String(body.role ?? "").trim().toUpperCase()

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Email, password, role wajib diisi" }, { status: 400, headers: corsHeaders })
    }
    if (!["SISWA", "GURU", "KEPALA_PONDOK", "PENGURUS_PONDOK", "USTADZ_PONDOK"].includes(role)) {
      return NextResponse.json({ error: "Role hanya SISWA, GURU, atau Pengelola Pondok (Admin khusus website)" }, { status: 400, headers: corsHeaders })
    }

    const ip = getClientIp(req)
    const rlAkun = rateLimit(`login:${ip}:${email.toLowerCase()}`, 8, 600000)
    if (!rlAkun.success) {
      return NextResponse.json({ error: "Terlalu banyak percobaan login, coba lagi nanti" }, { status: 429, headers: { ...corsHeaders, "Retry-After": "600" } })
    }
    const rlIp = rateLimit(`login-ip:${ip}`, 30, 600000)
    if (!rlIp.success) {
      return NextResponse.json({ error: "Terlalu banyak percobaan login, coba lagi nanti" }, { status: 429, headers: { ...corsHeaders, "Retry-After": "600" } })
    }

    // === 1 DATABASE — query SAMA dengan src/lib/auth.ts authorize() ===
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

    // Ambil profil tambahan — sama seperti website, termasuk jabatan siswa
    let extra: Record<string, unknown> = {}
    if (user.role === "SISWA") {
      const siswa = await prisma.siswa.findUnique({
        where: { userId: user.id },
        select: { id: true, nama: true, nis: true, jabatan: true, kelas: { select: { id: true, nama: true } } },
      })
      if (siswa) extra = { siswaId: siswa.id, siswaNama: siswa.nama, kelas: siswa.kelas, jabatan: siswa.jabatan }
    } else if (user.role === "GURU") {
      const guru = await prisma.guru.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, nama: true, jabatan: true },
      })
      if (guru) extra = { guruId: guru.id, guruNama: guru.nama, jabatan: guru.jabatan }
    } else if (["KEPALA_PONDOK", "PENGURUS_PONDOK", "USTADZ_PONDOK"].includes(user.role)) {
      const assignments = await prisma.pondokStaffAssignment.findMany({
        where: { userId: user.id, aktif: true },
        select: { tipe: true, asramaId: true, halaqahId: true, kelasDiniyahId: true },
        take: 10,
      })
      extra = { pondokTugas: assignments.map((a) => a.tipe), pondokAssignments: assignments }
    }

    // Token ditandatangani JWT (JWT) — base64 murni lama sudah dihapus karena bisa dipalsukan
    const accessToken = await signMobileToken(user.id, user.role, "access")
    const refreshToken = await signMobileToken(user.id, user.role, "refresh")

    return NextResponse.json(
      {
        success: true,
        message: "Login berhasil — terhubung ke 1 database (PostgreSQL) yang sama dengan website",
        user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
        token: accessToken,
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
        extra,
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Mobile login error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: corsHeaders })
  }
}
