import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    let config = await prisma.siteConfig.findFirst()
    if (!config) {
      config = await prisma.siteConfig.create({ data: {} })
    }
    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: "Gagal memuat konfigurasi" }, { status: 500 })
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
    const { siteName, tagline, description, logoUrl, aboutTitle, aboutText } = body

    let config = await prisma.siteConfig.findFirst()
    if (config) {
      config = await prisma.siteConfig.update({
        where: { id: config.id },
        data: {
          ...(siteName !== undefined && { siteName }),
          ...(tagline !== undefined && { tagline }),
          ...(description !== undefined && { description }),
          ...(logoUrl !== undefined && { logoUrl }),
          ...(aboutTitle !== undefined && { aboutTitle }),
          ...(aboutText !== undefined && { aboutText }),
        },
      })
    } else {
      config = await prisma.siteConfig.create({
        data: { siteName, tagline, description, logoUrl, aboutTitle, aboutText },
      })
    }

    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi" }, { status: 500 })
  }
}
