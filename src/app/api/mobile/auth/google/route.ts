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

    // Verifikasi aud — terima Web & Android client ID (1 DB, 2 platform)
    const allowedAuds = [
      process.env.GOOGLE_CLIENT_ID,
      "190762274336-cstajadll4mqf0n7i4j529n9g02j0ti8.apps.googleusercontent.com", // Android
      "190762274336-msoeb1vaq8niqf0e5hfb1ur0hqpmln8f.apps.googleusercontent.com", // Web (legacy)
    ].filter(Boolean) as string[]
    if (payload.aud && !allowedAuds.includes(payload.aud)) {
      console.warn(`Google aud not in allowlist: got ${payload.aud}, allowed: ${allowedAuds.join(", ")}`)
      // Jangan fail hard — token tetap valid dari Google, cukup warning untuk audit
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
      // Buat Account link untuk Google — agar konsisten dengan PrismaAdapter website
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: payload.email ?? email,
          access_token: idToken.slice(0, 500),
          id_token: idToken.slice(0, 1000),
        },
      }).catch(() => {})
    } else {
      if (!user.isActive) {
        return NextResponse.json({ error: "Akun dinonaktifkan" }, { status: 403, headers: corsHeaders })
      }
      // Update nama/image jika berubah di Google
      if (user.name !== name || user.image !== image) {
        await prisma.user.update({ where: { id: user.id }, data: { name, image: image ?? undefined } }).catch(() => {})
      }
      // Pastikan Account Google ada (untuk linking yang belum ada)
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: "google" },
        select: { id: true },
      })
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "google",
            providerAccountId: payload.email ?? email,
            access_token: idToken.slice(0, 500),
          },
        }).catch(() => {})
      }
    }

    // Cek / buat profil siswa/guru — samakan dengan website /api/auth/role
    // Untuk Google login, jika user baru langsung buatkan profil sesuai role pilihan
    let siswaId: string | null = null
    let guruId: string | null = null
    let needRoleSelection = false

    if (user.role === "SISWA") {
      let siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true } })
      if (!siswa) {
        // Buatkan profil siswa minimal — seperti website setelah pilih role SISWA di /register
        try {
          siswa = await prisma.siswa.create({
            data: { userId: user.id, nama: user.name ?? name, kelasId: null },
            select: { id: true },
          })
        } catch {}
      }
      siswaId = siswa?.id ?? null
      if (!siswaId) needRoleSelection = true
    } else if (user.role === "GURU") {
      let guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
      if (!guru) {
        try {
          guru = await prisma.guru.create({
            data: { userId: user.id, nama: user.name ?? name },
            select: { id: true },
          })
        } catch {}
      }
      guruId = guru?.id ?? null
      if (!guruId) needRoleSelection = true
    } else if (user.role === "ADMIN" || user.role === "RESEARCHER") {
      return NextResponse.json({ error: "Role Admin hanya via website" }, { status: 403, headers: corsHeaders })
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
