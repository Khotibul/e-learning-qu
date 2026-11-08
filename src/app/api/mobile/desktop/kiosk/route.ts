import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { audit } from "@/lib/absensi-harian"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { KIOSK_TOKEN_TTL_SECONDS, signKioskToken } from "@/lib/wajah-token"

/**
 * Aktivasi kiosk absensi dari aplikasi desktop (WPF).
 *
 * Admin memasukkan email + kata sandi SEKALI di layar login desktop; aplikasi
 * menukar access token login menjadi token kiosk berumur 30 hari yang disimpan
 * terenkripsi (DPAPI) di perangkat. Setelah itu guru/siswa bisa absen wajah atau
 * sidik jari dari layar login tanpa login sama sekali.
 *
 * Token kiosk HANYA diterima oleh halaman/route absensi kiosk — bukan token
 * akses API umum.
 */
export async function POST(req: Request) {
  const user = await getMobileUser(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Hanya Admin yang boleh mengaktifkan kiosk absensi di komputer ini" },
      { status: 403 }
    )
  }

  const rl = rateLimit(`kiosk-desktop:${getClientIp(req)}:${user.id}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan — tunggu sebentar" },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  try {
    // Nama komputer dipakai panel Admin untuk menampilkan status & masa berlaku per perangkat.
    const body = (await req.json().catch(() => ({}))) as { perangkatNama?: unknown }
    const perangkatNama = String(body?.perangkatNama ?? "").trim().slice(0, 60) || "Desktop"

    const token = await signKioskToken(user.id, user.name)
    const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "")

    await audit(user.id, "KIOSK_DESKTOP_AKTIF", "User", user.id, {
      perangkat: "DESKTOP",
      perangkatNama,
      masaBerlakuHari: KIOSK_TOKEN_TTL_SECONDS / 86400,
      berlakuSampai: new Date(Date.now() + KIOSK_TOKEN_TTL_SECONDS * 1000).toISOString(),
    })

    return NextResponse.json({
      token,
      url: `${base}/absensi/kiosk`,
      expiresInDetik: KIOSK_TOKEN_TTL_SECONDS,
      admin: user.name || user.email,
      perangkatNama,
    })
  } catch (e) {
    console.error("Token kiosk desktop error:", e)
    return NextResponse.json({ error: "Gagal membuat token kiosk absensi" }, { status: 500 })
  }
}
