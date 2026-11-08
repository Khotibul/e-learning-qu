import { NextResponse } from "next/server"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { bacaCookie, KIOSK_COOKIE, verifyKioskToken } from "@/lib/wajah-token"
import { absenKiosk } from "@/lib/kiosk-absensi"

/**
 * Absensi kiosk desktop TANPA login.
 * Hanya menerima cookie kiosk yang diaktifkan Admin di perangkat tersebut.
 * Wajah memakai /api/wajah/verifikasi; rute ini untuk sidik jari & cadangan NIS/NIP.
 */
export async function POST(req: Request) {
  const token = bacaCookie(req.headers.get("cookie"), KIOSK_COOKIE)
  const kiosk = token ? await verifyKioskToken(token) : null
  if (!kiosk) {
    return NextResponse.json(
      { error: "Kiosk belum diaktifkan di perangkat ini. Minta Admin mengaktifkannya dari menu Absensi Wajah." },
      { status: 401 }
    )
  }

  const rl = rateLimit(`kiosk-absen:${getClientIp(req)}`, 20, 60000)
  if (!rl.success) {
    return NextResponse.json({ error: "Terlalu banyak percobaan — tunggu sebentar" }, { status: 429 })
  }

  try {
    const body = (await req.json()) as { kode?: unknown; metode?: unknown }
    const metode = body.metode === "SIDIK_JARI" ? "SIDIK_JARI" : body.metode === "NIS_NIP" ? "NIS_NIP" : null
    if (!metode) {
      return NextResponse.json({ error: "Metode absensi tidak valid" }, { status: 400 })
    }

    const hasil = await absenKiosk({ kode: body.kode, metode })
    return NextResponse.json(hasil)
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Absensi kiosk gagal"
    return NextResponse.json({ error: pesan }, { status: 400 })
  }
}
