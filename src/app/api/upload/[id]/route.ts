import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const upload = await prisma.upload.findUnique({ where: { id } })
    if (!upload) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(upload.data), {
      status: 200,
      headers: {
        "Content-Type": upload.mime,
        "Content-Length": String(upload.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ error: "Gagal memuat file" }, { status: 500 })
  }
}