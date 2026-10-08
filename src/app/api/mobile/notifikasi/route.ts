import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { getNotifikasi, tandaiDibaca } from "@/lib/notifikasi"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET: daftar notifikasi user login (Notification Center versi mobile)
export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get("unread") === "1"
    const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10) || 50, 100)
    const rows = await getNotifikasi(user.id, { unreadOnly, take })
    const { prisma } = await import("@/lib/prisma")
    const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } })
    return NextResponse.json({ rows, unread }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile notifikasi GET error:", e)
    return NextResponse.json({ error: "Gagal memuat notifikasi" }, { status: 500, headers: corsHeaders })
  }
}

// POST: tandai dibaca { ids?: string[] }
export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids.map(String) : undefined
    const count = await tandaiDibaca(user.id, ids)
    return NextResponse.json({ success: true, count }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile notifikasi POST error:", e)
    return NextResponse.json({ error: "Gagal menandai notifikasi" }, { status: 500, headers: corsHeaders })
  }
}
