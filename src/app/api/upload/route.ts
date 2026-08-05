import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

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

    const uploadDir = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })

    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase()
    const ext = ALLOWED_EXT.test(`.${rawExt}`) ? rawExt.replace(/[^a-z0-9]/g, "") : "jpg"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ url })
  } catch (e: any) {
    console.error("Upload gagal:", e?.message || e)
    return NextResponse.json({ error: "Upload gagal, coba lagi" }, { status: 500 })
  }
}
