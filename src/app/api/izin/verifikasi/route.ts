import { NextResponse } from "next/server"
import { verifikasiTokenIzin } from "@/lib/izin-santri"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/** Verifikasi QR izin — publik, data minimal (dipakai pemindai gerbang & skanner pihak ketiga). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get("token") || ""
    const hasil = await verifikasiTokenIzin(token)
    return NextResponse.json(hasil, { headers: corsHeaders })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token tidak valid"
    return NextResponse.json({ valid: false, error: msg }, { status: 400, headers: corsHeaders })
  }
}
