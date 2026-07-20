import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const features = await prisma.landingFeature.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    })
    return NextResponse.json(features)
  } catch {
    return NextResponse.json({ error: "Gagal memuat fitur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { icon, title, description, order, isActive, id } = body

    if (id) {
      const updated = await prisma.landingFeature.update({
        where: { id },
        data: { icon, title, description, order, isActive },
      })
      return NextResponse.json(updated)
    }

    const created = await prisma.landingFeature.create({
      data: { icon, title, description, order: order || 0, isActive: isActive ?? true },
    })
    return NextResponse.json(created)
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan fitur" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await req.json()
    await prisma.landingFeature.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Gagal menghapus fitur" }, { status: 500 })
  }
}
