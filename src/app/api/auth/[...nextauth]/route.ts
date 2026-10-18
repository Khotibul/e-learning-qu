import { handlers } from "@/lib/auth"
import type { NextRequest } from "next/server"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  // Rate limit percobaan login credentials (signin/callback/signout POST)
  const rl = rateLimit(`nextauth:${getClientIp(req)}`, 20, 60000)
  if (!rl.success) {
    return new Response("Terlalu banyak permintaan", {
      status: 429,
      headers: { "Retry-After": "60" },
    })
  }
  return handlers.POST(req)
}
