import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })
    const materis = await prisma.materi.findMany({
      where: { guruId: guru.id, deletedAt: null },
      select: { id: true, judul: true, deskripsi: true, fileUrl: true, fileType: true, fileSize: true, createdAt: true, mataPelajaran: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    return NextResponse.json(materis, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const formData = await req.formData()
    const judul = String(formData.get("judul") ?? "").trim()
    const deskripsi = String(formData.get("deskripsi") ?? "").trim()
    const mataPelajaranId = String(formData.get("mataPelajaranId") ?? "").trim()
    const file = formData.get("file") as File | null

    if (!judul) return NextResponse.json({ error: "Judul wajib" }, { status: 400, headers: corsHeaders })
    if (!file) return NextResponse.json({ error: "File wajib" }, { status: 400, headers: corsHeaders })

    // Upload ke /api/upload dulu (reuse logic) — untuk mobile, simpan langsung
    const bytes = Buffer.from(await file.arrayBuffer())
    const upload = await prisma.upload.create({
      data: { filename: file.name, mime: file.type || "application/octet-stream", size: file.size, data: bytes, userId: user.id, akses: "INTERNAL" },
    })
    const fileUrl = `/api/upload/${upload.id}`
    const fileType = file.name.split(".").pop()?.toLowerCase() || ""

    // Jika tidak ada mapel, ambil mapel pertama guru
    let mapelId = mataPelajaranId
    if (!mapelId) {
      const mp = await prisma.pengajaran.findFirst({ where: { guruId: guru.id, deletedAt: null }, select: { mataPelajaranId: true } })
      if (mp) mapelId = mp.mataPelajaranId
    }
    if (!mapelId) return NextResponse.json({ error: "Mata pelajaran tidak ditemukan" }, { status: 400, headers: corsHeaders })

    const materi = await prisma.materi.create({
      data: {
        judul,
        deskripsi: deskripsi || null,
        fileUrl,
        fileType,
        fileSize: file.size,
        mataPelajaranId: mapelId,
        guruId: guru.id,
      },
    })

    return NextResponse.json(materi, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal upload" }, { status: 500, headers: corsHeaders })
  }
}

/** Soft-delete materi milik guru yang login — mirror web deleteMateri(). */
export async function DELETE(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400, headers: corsHeaders })

    const updated = await prisma.materi.updateMany({
      where: { id, guruId: guru.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (updated.count === 0) return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404, headers: corsHeaders })
    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}
