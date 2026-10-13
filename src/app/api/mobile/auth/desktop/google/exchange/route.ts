import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signMobileToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/mobile-jwt"

/**
 * Google Login Desktop (C#/.NET WPF) — OAuth 2.0 Authorization Code + PKCE.
 * POST /api/mobile/auth/desktop/google/exchange
 * Body: { code, codeVerifier, redirectUri, role }
 *
 * Desktop membuka browser sistem (authorize) lalu menukar code+PKCE di sini.
 * Logika user/account/profil SAMA dengan /api/mobile/auth/google (1 DB).
 * Yang berbeda: token hasil = JWT desktop (access+refresh) persis /api/mobile/auth/desktop/login.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  const cors = corsHeaders
  try {
    const body = await req.json()
    const code = String(body.code ?? "").trim()
    const codeVerifier = String(body.codeVerifier ?? "").trim()
    const redirectUri = String(body.redirectUri ?? "").trim()
    const role = String(body.role ?? "SISWA").toUpperCase()
    const requestedRole = ["SISWA", "GURU"].includes(role) ? role : "SISWA"

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json({ error: "code, codeVerifier, redirectUri wajib diisi" }, { status: 400, headers: cors })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Konfigurasi Google OAuth belum lengkap" }, { status: 500, headers: cors })
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "")
      console.error("Google token exchange failed:", tokenRes.status, errText)
      return NextResponse.json({ error: "Gagal menukar kode Google (PKCE)" }, { status: 401, headers: cors })
    }

    const tokenJson = (await tokenRes.json()) as { id_token?: string; access_token?: string }
    const idToken = tokenJson.id_token
    if (!idToken) {
      return NextResponse.json({ error: "id_token tidak ditemukan dari Google" }, { status: 401, headers: cors })
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Token Google tidak valid" }, { status: 401, headers: cors })
    }
    const payload = (await verifyRes.json()) as {
      email?: string
      name?: string
      picture?: string
      aud?: string
      sub?: string
    }

    const email = payload.email?.toLowerCase()
    const name = payload.name || email?.split("@")[0] || "User"
    const image = payload.picture || null
    if (!email) {
      return NextResponse.json({ error: "Email tidak ditemukan di token Google" }, { status: 400, headers: cors })
    }

    const allowedAuds = [
      process.env.GOOGLE_CLIENT_ID,
      "190762274336-cstajadll4mqf0n7i4j529n9g02j0ti8.apps.googleusercontent.com",
      "190762274336-msoeb1vaq8niqf0e5hfb1ur0hqpmln8f.apps.googleusercontent.com",
    ].filter(Boolean) as string[]
    if (payload.aud && !allowedAuds.includes(payload.aud)) {
      console.warn(`Google aud not in allowlist (desktop): ${payload.aud}`)
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, image: true, role: true, isActive: true },
    })

    let isNewUser = false
    if (!user) {
      user = await prisma.user.create({
        data: { email, name, image, role: requestedRole as never, emailVerified: new Date() },
        select: { id: true, email: true, name: true, image: true, role: true, isActive: true },
      })
      isNewUser = true
      await prisma.account
        .create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "google",
            providerAccountId: payload.sub ?? email,
            access_token: tokenJson.access_token?.slice(0, 500),
            id_token: idToken.slice(0, 1000),
          },
        })
        .catch(() => {})
    } else {
      if (!user.isActive) {
        return NextResponse.json({ error: "Akun dinonaktifkan" }, { status: 403, headers: cors })
      }
      if (user.name !== name || user.image !== image) {
        await prisma.user.update({ where: { id: user.id }, data: { name, image: image ?? undefined } }).catch(() => {})
      }
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: "google" },
        select: { id: true },
      })
      if (!existingAccount) {
        await prisma.account
          .create({
            data: {
              userId: user.id,
              type: "oauth",
              provider: "google",
              providerAccountId: payload.sub ?? email,
              access_token: tokenJson.access_token?.slice(0, 500),
              id_token: idToken.slice(0, 1000),
            },
          })
          .catch(() => {})
      }
    }

    let siswaId: string | null = null
    let guruId: string | null = null
    let needRoleSelection = false

    if (user.role === "SISWA") {
      let siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true } })
      if (!siswa) {
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
      return NextResponse.json({ error: "Role Admin hanya via website" }, { status: 403, headers: cors })
    }

    const accessToken = await signMobileToken(user.id, user.role, "access")
    const refreshToken = await signMobileToken(user.id, user.role, "refresh")

    let extra: Record<string, unknown> = { siswaId, guruId, isNewUser, needRoleSelection }
    if (user.role === "SISWA") {
      const s = await prisma.siswa.findUnique({
        where: { userId: user.id },
        select: { id: true, nama: true, nis: true, jabatan: true, kelas: { select: { id: true, nama: true } } },
      })
      if (s) extra = { ...extra, siswaId: s.id, siswaNama: s.nama, nis: s.nis, kelas: s.kelas, jabatan: s.jabatan }
    } else if (user.role === "GURU") {
      const g = await prisma.guru.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, nama: true, jabatan: true },
      })
      if (g) extra = { ...extra, guruId: g.id, guruNama: g.nama, jabatan: g.jabatan }
    }

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
      { headers: cors }
    )
  } catch (e) {
    console.error("Desktop Google exchange error:", e)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500, headers: cors })
  }
}
