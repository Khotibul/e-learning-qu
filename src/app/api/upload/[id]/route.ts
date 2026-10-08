import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Akses: sesi login web (cookie) ATAU token mobile (Bearer)
    const session = await auth()
    const mobileUser = session?.user ? null : await getMobileUser(req)
    if (!session?.user && !mobileUser) {
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