import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * Mobile Google Login — SAMA dengan website (NextAuth Google provider)
 * Flutter: google_sign_in → idToken → POST ke sini → verifikasi Google → prisma → 1 DB
 * Website: NextAuth Google → PrismaAdapter → create user/account → same DB
 * Jadi Android & Website pakai tabel `users` & `accounts` yang identik.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const idToken = String(body.idToken ?? "").trim()
    const role = String(body.role ?? "SISWA").toUpperCase() // SISWA/GURU, khusus mobile hanya 2
    const requestedRole = ["SISWA", "GURU"].includes(role) ? role : "SISWA"

    if (!idToken) {
      return NextResponse.json({ error: "idToken wajib" }, { status: 400, headers: corsHeaders })
    }

    // Verifikasi idToken ke Google
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Token Google tidak valid" }, { status: 401, headers: corsHeaders })
    }
    const payload = await verifyRes.json() as { email?: string; name?: string; picture?: string; aud?: string; exp?: string }
    const email = payload.email?.toLowerCase()
    const name = payload.name || email?.split("@")[0] || "User"
    const image = payload.picture || null

    if (!email) {
      return NextResponse.json({ error: "Email tidak ditemukan di token Google" }, { status: 400, headers: corsHeaders })
    }

    // (Opsional) cek aud sesuai GOOGLE_CLIENT_ID — jika dikirim, verifikasi
    const expectedAud = process.env.GOOGLE_CLIENT_ID
    if (expectedAud && payload.aud && payload.aud !== expectedAud) {
      // Untuk Android, aud bisa berupa Android client ID, jadi jangan strict fail
      // Cukup log warning
      console.warn(`Google aud mismatch: expected ${expectedAud}, got ${payload.aud}`)
    }

    // Cari user existing — sama seperti PrismaAdapter + allowDangerousEmailAccountLinking: true
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, image: true, role: true, isActive: true },
    })

    let isNewUser = false
    if (!user) {
      // Buat user baru — role sesuai pilihan di Android (default SISWA)
      user = await prisma.user.create({
        data: {
          email,
          name,
          image,
          role: requestedRole as never,
          emailVerified: new Date(),
        },
        select: { id: true, email: true, name: true, image: true, role: true, isActive: true },
      })
      isNewUser = true
    } else {
      if (!user.isActive) {
        return NextResponse.json({ error: "Akun dinonaktifkan" }, { status: 403, headers: corsHeaders })
      }
      // Update nama/image jika berubah di Google
      if (user.name !== name || user.image !== image) {
        await prisma.user.update({ where: { id: user.id }, data: { name, image: image ?? undefined } }).catch(() => {})
      }
    }

    // Cek apakah sudah punya profil siswa/guru (untuk tentukan needRoleSelection)
    let siswaId: string | null = null
    let guruId: string | null = null
    let needRoleSelection = false

    if (user.role === "SISWA") {
      const siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true } })
      siswaId = siswa?.id ?? null
      if (!siswa) needRoleSelection = isNewUser // user baru via Google belum punya siswa record
    } else if (user.role === "GURU") {
      const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
      guruId = guru?.id ?? null
      if (!guru) needRoleSelection = isNewUser
    } else if (user.role === "ADMIN" || user.role === "RESEARCHER") {
      // Admin/researcher tidak didukung di Android — arahkan ke website
      return NextResponse.json({ error: "Role Admin hanya via website" }, { status: 403, headers: corsHeaders })
    }

    // Jika user baru dan role masih default tapi belum punya profil, beri flag untuk pilih role
    // (mirip website redirect ke /register)
    if (isNewUser && !siswaId && !guruId) {
      needRoleSelection = true
    }

    const token = Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString("base64")

    return NextResponse.json(
      {
        success: true,
        message: isNewUser ? "Akun Google berhasil dibuat — 1 DB dengan website" : "Login Google berhasil — 1 DB",
        user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
        token,
        extra: { siswaId, guruId, isNewUser, needRoleSelection },
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Mobile Google login error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: corsHeaders })
  }
}
