import { ymd } from "@/lib/utils"
import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

async function getGuruId(req: Request): Promise<string | null> {
  const user = await getMobileUser(req)
  if (!user) return null
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
  return guru?.id ?? null
}

// GET: pengecualian milik guru pada tanggal tertentu
export async function GET(req: Request) {
  try {
    const guruId = await getGuruId(req)
    if (!guruId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get("tanggal") || ymd()
    const date = new Date(tanggal + "T00:00:00")
    date.setHours(0, 0, 0, 0)

    const rows = await prisma.pengecualianAbsensi.findMany({
      where: { guruId, tanggal: date },
      orderBy: { createdAt: "desc" },
      select: { id: true, jenis: true, alasan: true, status: true, catatanAdmin: true, createdAt: true },
    })
    return NextResponse.json({ rows }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile pengecualian GET error:", e)
    return NextResponse.json({ error: "Gagal memuat pengecualian" }, { status: 500, headers: corsHeaders })
  }
}

// POST: { jenis: "LOKASI"|"BIOMETRIK"|"FOTO", alasan, tanggal, jadwalPelajaranId? }
export async function POST(req: Request) {
  try {
    const guruId = await getGuruId(req)
    if (!guruId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const body = await req.json()
    const jenis = String(body.jenis ?? "")
    const alasan = String(body.alasan ?? "").trim()
    const tanggal = String(body.tanggal ?? ymd())
    const jadwalPelajaranId = body.jadwalPelajaranId ? String(body.jadwalPelajaranId) : null

    if (!["LOKASI", "BIOMETRIK", "FOTO"].includes(jenis)) {
      return NextResponse.json({ error: "Jenis pengecualian tidak valid" }, { status: 400, headers: corsHeaders })
    }
    if (alasan.length < 5) {
      return NextResponse.json({ error: "Alasan pengecualian wajib diisi (min. 5 karakter)" }, { status: 400, headers: corsHeaders })
    }

    const date = new Date(tanggal + "T00:00:00")
    date.setHours(0, 0, 0, 0)

    const dup = await prisma.pengecualianAbsensi.findFirst({
      where: { guruId, tanggal: date, jenis, status: "MENUNGGU" },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json({ error: "Pengecualian untuk tanggal ini sudah menunggu persetujuan Admin" }, { status: 400, headers: corsHeaders })
    }

    await prisma.pengecualianAbsensi.create({
      data: { guruId, tanggal: date, jenis, alasan, jadwalPelajaranId },
    })
    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile pengecualian POST error:", e)
    return NextResponse.json({ error: "Gagal mengajukan pengecualian" }, { status: 500, headers: corsHeaders })
  }
}
