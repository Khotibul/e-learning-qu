import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { extractTextFromFile } from "@/lib/agents/extract"

const MAX_SIZE = 20 * 1024 * 1024
const IMAGE_MIME = /^image\//
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|ico|pdf|txt|md|csv|json|docx?|xlsx?|pptx?)$/i

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
    if (!IMAGE_MIME.test(file.type) && !ALLOWED_EXT.test(file.name)) {
      return NextResponse.json({ error: "Tipe file tidak diizinkan" }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 20MB" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const upload = await prisma.upload.create({
      data: {
        filename: file.name || "file",
        mime: file.type || "application/octet-stream",
        size: file.size,
        data: buffer,
      },
    })

    const text = extractTextFromFile(file.name, buffer)

    return NextResponse.json({
      url: `/api/upload/${upload.id}`,
      ...(text ? { text } : {}),
    })
  } catch (e: any) {
    console.error("Upload gagal:", e?.message || e)
    return NextResponse.json({ error: "Upload gagal, coba lagi" }, { status: 500 })
  }
}
