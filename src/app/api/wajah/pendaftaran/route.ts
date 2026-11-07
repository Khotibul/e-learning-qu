import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileUser } from "@/lib/mobile-auth"
import { verifyWajahToken } from "@/lib/wajah-token"
import { ajukanPendaftaranWajah, statusPendaftaranWajah } from "@/lib/wajah-pendaftaran"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

type Pemohon = { id: string; role: string }

async function getPemohon(req: Request): Promise<Pemohon | null> {
  const session = await auth()
  if (session?.user?.id) return { id: session.user.id, role: String(session.user.role ?? "SISWA") }

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

/** Status pendaftaran wajah milik pemohon (dipakai halaman pendaftaran mandiri). */
export async function GET(req: Request) {
  const pemohon = await getPemohon(req)
  if (!pemohon) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

  try {
    const status = await statusPendaftaranWajah(pemohon.id)
    if (!status) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404, headers: corsHeaders })
    return NextResponse.json(status, { headers: corsHeaders })
  } catch (e) {
    console.error("Status pendaftaran wajah error:", e)
    return NextResponse.json({ error: "Gagal memuat status pendaftaran" }, { status: 500, headers: corsHeaders })
  }
}

/**
 * Kirim pengajuan wajah mandiri (descriptor + foto tangkapan untuk Admin).
 * Wajah baru dipakai untuk absensi setelah Admin menyetujui.
 */
export async function POST(req: Request) {
  const pemohon = await getPemohon(req)
  if (!pemohon) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

  const rl = rateLimit(`wajah-daftar:${getClientIp(req)}:${pemohon.id}`, 10, 60000)
  if (!rl.success) {
    return NextResponse.json({ error: "Terlalu banyak percobaan — tunggu sebentar" }, { status: 429, headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as { deskriptor?: unknown; foto?: unknown; sampel?: unknown }
    const hasil = await ajukanPendaftaranWajah({
      userId: pemohon.id,
      deskriptor: body.deskriptor,
      foto: typeof body.foto === "string" ? body.foto : null,
      sampel: Number(body.sampel) || 1,
    })
    return NextResponse.json(hasil, { headers: corsHeaders })
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Pengajuan wajah gagal"
    return NextResponse.json({ error: pesan }, { status: 400, headers: corsHeaders })
  }
}
