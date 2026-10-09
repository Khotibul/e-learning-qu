import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

const MAX_SIZE = 5 * 1024 * 1024 // 5MB untuk bukti absensi

// Upload bukti foto absensi dari aplikasi mobile (auth: Bearer token)
export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400, headers: corsHeaders })
    }
    if (!/^image\//.test(file.type)) {
      return NextResponse.json({ error: "Hanya gambar yang diizinkan" }, { status: 400, headers: corsHeaders })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 5MB" }, { status: 400, headers: corsHeaders })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await prisma.upload.create({
      data: {
        filename: file.name || "absensi.jpg",
        mime: file.type,
        size: file.size,
        data: buffer,
        userId: user.id, // privat: hanya pemilik + Admin (bukti foto absensi)
      },
    })

    return NextResponse.json({ url: `/api/upload/${upload.id}` }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile upload error:", e)
    return NextResponse.json({ error: "Upload gagal" }, { status: 500, headers: corsHeaders })
  }
}
