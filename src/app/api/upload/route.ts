import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|ico)$/i

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 })
    }
    if (!file.type.startsWith("image/") && !ALLOWED_EXT.test(file.name)) {
      return NextResponse.json({ error: "Hanya file gambar yang diizinkan" }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 10MB" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const upload = await prisma.upload.create({
      data: {
        filename: file.name || "foto",
        mime: file.type || "application/octet-stream",
        size: file.size,
        data: buffer,
      },
    })

    return NextResponse.json({ url: `/api/upload/${upload.id}` })
  } catch (e: any) {
    console.error("Upload gagal:", e?.message || e)
    return NextResponse.json({ error: "Upload gagal, coba lagi" }, { status: 500 })
  }
}