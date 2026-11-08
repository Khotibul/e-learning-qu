import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileUser } from "@/lib/mobile-auth"
import { bacaCookie, KIOSK_COOKIE, verifyKioskToken, verifyWajahToken } from "@/lib/wajah-token"
import { normalisasiDeskriptor, verifikasiWajah, type PerangkatWajah } from "@/lib/wajah"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

type Operator = { id: string; role: string }

async function getOperator(req: Request): Promise<Operator | null> {
  const session = await auth()
  if (session?.user?.id) return { id: session.user.id, role: String(session.user.role ?? "SISWA") }

  // Kiosk desktop yang sudah diaktifkan Admin — absensi tanpa login.
  const kioskToken = bacaCookie(req.headers.get("cookie"), KIOSK_COOKIE)
  if (kioskToken) {
    const kiosk = await verifyKioskToken(kioskToken)
    if (kiosk) return { id: kiosk.sub, role: "KIOSK" }
  }

  const header = req.headers.get("authorization") || req.headers.get("Authorization")
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (token) {
    const wajah = await verifyWajahToken(token)
    if (wajah) return { id: wajah.sub, role: wajah.role }
    const mobile = await getMobileUser(req)
    if (mobile) return { id: mobile.id, role: String(mobile.role) }
  }
  return null
}

/**
 * Verifikasi wajah untuk absensi.
 * Client (web / webview Android / browser desktop) menghitung descriptor 128-d
 * dari frame webcam, lalu server mencocokkan dengan profil terdaftar.
 */
export async function POST(req: Request) {
  const operator = await getOperator(req)
  if (!operator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
  }

  const rl = rateLimit(`wajah:${getClientIp(req)}:${operator.id}`, 30, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan — tunggu sebentar" },
      { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
    )
  }

  try {
    const body = (await req.json()) as {
      deskriptor?: unknown
      tujuan?: string
      targetProfilId?: string | null
      perangkat?: string
      fotoId?: string | null
    }

    const deskriptor = normalisasiDeskriptor(body.deskriptor)
    const tujuan = body.tujuan === "UJI" ? "UJI" : "ABSEN"
    if (tujuan === "UJI" && operator.role !== "ADMIN") {
      return NextResponse.json({ error: "Hanya Admin yang boleh menguji verifikasi" }, { status: 403, headers: corsHeaders })
    }

    const perangkat: PerangkatWajah =
      body.perangkat === "ANDROID" || body.perangkat === "DESKTOP" ? body.perangkat : "WEB"

    const hasil = await verifikasiWajah({
      deskriptor,
      tujuan,
      targetProfilId: tujuan === "UJI" && body.targetProfilId ? String(body.targetProfilId) : null,
      perangkat,
      operatorUserId: operator.id,
      fotoId: body.fotoId ? String(body.fotoId) : null,
    })

    return NextResponse.json(hasil, { headers: corsHeaders })
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Verifikasi wajah gagal"
    return NextResponse.json({ error: pesan }, { status: 400, headers: corsHeaders })
  }
}
