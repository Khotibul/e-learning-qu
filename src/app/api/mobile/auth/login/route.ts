import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

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
    if (!["SISWA", "GURU"].includes(role)) {
      return NextResponse.json({ error: "Role hanya SISWA atau GURU (Admin khusus website)" }, { status: 400, headers: corsHeaders })
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
    }

    // Untuk mobile, kita kembalikan user langsung (tanpa cookie NextAuth)
    // Token sederhana: base64(userId:role) — untuk demo, bisa diganti JWT dengan AUTH_SECRET
    const token = Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString("base64")

    return NextResponse.json(
      {
        success: true,
        message: "Login berhasil — terhubung ke 1 database (PostgreSQL) yang sama dengan website",
        user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
        token,
        extra,
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Mobile login error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: corsHeaders })
  }
}
