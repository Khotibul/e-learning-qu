import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { kelasId: true } })
    if (!siswa?.kelasId) return NextResponse.json([], { headers: corsHeaders })

    const pengajaran = await prisma.pengajaran.findMany({
      where: { kelasId: siswa.kelasId, deletedAt: null },
      select: { mataPelajaranId: true },
    })
    const mapelIds = [...new Set(pengajaran.map((p) => p.mataPelajaranId))]
    if (mapelIds.length === 0) return NextResponse.json([], { headers: corsHeaders })

    const materis = await prisma.materi.findMany({
      where: { mataPelajaranId: { in: mapelIds }, deletedAt: null },
      select: { id: true, judul: true, deskripsi: true, fileUrl: true, createdAt: true, mataPelajaran: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json(materis, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile materi error:", e)
    return NextResponse.json({ error: "Gagal memuat materi" }, { status: 500, headers: corsHeaders })
  }
}
