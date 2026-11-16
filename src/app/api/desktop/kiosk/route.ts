import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { audit } from "@/lib/absensi-harian"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { KIOSK_TOKEN_TTL_SECONDS, signKioskToken } from "@/lib/wajah-token"

/**
 * Aktivasi kiosk desktop lewat browser (untuk Admin yang masuk dengan Google).
 *
 * Google menolak redirect loopback pada client ID tipe Web yang dipakai situs
 * ini (redirect_uri_mismatch), jadi aplikasi desktop tidak bisa memakai OAuth
 * PKCE langsung. Alih-alih itu desktop membuka /desktop/aktivasi-kiosk di
 * browser sistem; setelah Admin masuk (Google atau email), halaman ini memanggil
 * route ini untuk menukar sesi login menjadi token kiosk 30 hari. Halaman lalu
 * mengarahkan browser ke listener loopback milik aplikasi desktop.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const port = Number(searchParams.get("port"))
  const state = String(searchParams.get("state") ?? "").trim()

  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[A-Za-z0-9_-]{8,64}$/.test(state)) {
    return NextResponse.json({ error: "Permintaan aktivasi tidak valid" }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Masuk sebagai Admin terlebih dahulu" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  if (!user || !user.isActive || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Hanya Admin yang boleh mengaktifkan kiosk absensi" },
      { status: 403 }
    )
  }

  const rl = rateLimit(`kiosk-browser:${getClientIp(req)}:${user.id}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan — tunggu sebentar" },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  try {
    const token = await signKioskToken(user.id, user.name)
    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "")

    await audit(user.id, "KIOSK_DESKTOP_AKTIF", "User", user.id, {
      perangkat: "DESKTOP",
      perangkatNama: "Lewat browser",
      masaBerlakuHari: KIOSK_TOKEN_TTL_SECONDS / 86400,
      berlakuSampai: new Date(Date.now() + KIOSK_TOKEN_TTL_SECONDS * 1000).toISOString(),
    })

    return NextResponse.json(
      {
        token,
        url: `${base}/absensi/kiosk`,
        admin: user.name || user.email,
        expiresInDetik: KIOSK_TOKEN_TTL_SECONDS,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (e) {
    console.error("Aktivasi kiosk lewat browser gagal:", e)
    return NextResponse.json({ error: "Gagal membuat token kiosk absensi" }, { status: 500 })
  }
}
