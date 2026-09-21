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

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get("tanggal") || new Date().toISOString().slice(0, 10)
    const dayName = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long" })
    const hari = dayName.charAt(0).toUpperCase() + dayName.slice(1)

    const pengajaran = await prisma.pengajaran.findMany({
      where: { guruId: guru.id, deletedAt: null },
      select: { kelasId: true, mataPelajaranId: true },
    })
    if (pengajaran.length === 0) return NextResponse.json([], { headers: corsHeaders })

    const orConditions = pengajaran.map((p) => ({ kelasId: p.kelasId, mataPelajaranId: p.mataPelajaranId }))

    const jadwal = await prisma.jadwalPelajaran.findMany({
      where: { hari, deletedAt: null, OR: orConditions },
      include: {
        mataPelajaran: { select: { id: true, nama: true, kode: true } },
        kelas: { select: { id: true, nama: true } },
      },
      orderBy: [{ kelas: { nama: "asc" } }, { jamMulai: "asc" }],
    })

    return NextResponse.json(jadwal, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile jadwal error:", e)
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: 500, headers: corsHeaders })
  }
}
