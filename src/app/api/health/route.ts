import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1 as ok`
    const ms = Date.now() - t0
    return NextResponse.json(
      { status: "ok", latencyMs: ms, region: "ap-southeast-1" },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (e) {
    const ms = Date.now() - t0
    return NextResponse.json(
      { status: "error", latencyMs: ms, error: String((e as Error).message).slice(0, 200) },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
