import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getNotifikasi, tandaiDibaca } from "@/lib/notifikasi"

export const dynamic = "force-dynamic"

// GET /api/notifikasi — daftar notifikasi milik user login (Notification Center)
export async function GET(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get("unread") === "1"
    const take = Math.min(parseInt(searchParams.get("take") ?? "30", 10) || 30, 100)
    const [rows, unread] = await Promise.all([
      getNotifikasi(userId, { unreadOnly, take }),
      prismaUnread(userId),
    ])
    return NextResponse.json({ rows, unread })
  } catch (e) {
    console.error("GET /api/notifikasi error:", e)
    return NextResponse.json({ error: "Gagal memuat notifikasi" }, { status: 500 })
  }
}

async function prismaUnread(userId: string) {
  const { prisma } = await import("@/lib/prisma")
  return prisma.notification.count({ where: { userId, isRead: false } })
}

// POST /api/notifikasi — tandai dibaca (tanpa ids = semua)
export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids.map(String) : undefined
    const count = await tandaiDibaca(userId, ids)
    return NextResponse.json({ success: true, count })
  } catch (e) {
    console.error("POST /api/notifikasi error:", e)
    return NextResponse.json({ error: "Gagal menandai notifikasi" }, { status: 500 })
  }
}
