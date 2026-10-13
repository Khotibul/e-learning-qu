import { NextResponse } from "next/server"
import { prosesWebhookTopup } from "@/lib/keuangan/topup"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// POST /api/keuangan/webhook/topup — menerima konfirmasi payment gateway.
// Verifikasi HMAC-SHA256 wajib (TOPUP_WEBHOOK_SECRET). Idempoten.
export async function POST(req: Request) {
  const rl = rateLimit(`webhook-topup-${getClientIp(req)}`, 30, 60000)
  if (!rl.success) return NextResponse.json({ error: "Terlalu banyak request" }, { status: 429 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 })
  }

  const hasil = await prosesWebhookTopup(body as never)
  if (!hasil.ok) return NextResponse.json({ success: false, error: hasil.error }, { status: 400 })
  return NextResponse.json({ success: true, status: hasil.status, sudahDiproses: hasil.sudahDiproses ?? false })
}
