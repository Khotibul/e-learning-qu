import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET: ambil absensi guru hari ini (atau tanggal tertentu)
export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get("tanggal") || new Date().toISOString().slice(0, 10)
    const date = new Date(tanggal)
    date.setHours(0, 0, 0, 0)
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)

    const absensi = await prisma.absensiGuru.findFirst({
      where: { guruId: guru.id, tanggal: { gte: date, lt: nextDay } },
    })

    return NextResponse.json(absensi, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile guru absensi GET error:", e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}

// POST: simpan absensi guru (1x per hari)
export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const body = await req.json()
    const tanggal = String(body.tanggal ?? new Date().toISOString().slice(0, 10))
    const status = String(body.status ?? "HADIR").toUpperCase()
    const keterangan = body.keterangan ? String(body.keterangan) : null

    if (!["HADIR", "IZIN", "SAKIT", "ALPA"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400, headers: corsHeaders })
    }

    const date = new Date(tanggal)
    date.setHours(0, 0, 0, 0)
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)

    const existing = await prisma.absensiGuru.findFirst({
      where: { guruId: guru.id, tanggal: { gte: date, lt: nextDay } },
    })

    let result
    if (existing) {
      result = await prisma.absensiGuru.update({
        where: { id: existing.id },
        data: { status: status as never, keterangan, jamMasuk: new Date().toTimeString().slice(0, 5) },
      })
    } else {
      result = await prisma.absensiGuru.create({
        data: { guruId: guru.id, tanggal: date, status: status as never, keterangan, jamMasuk: new Date().toTimeString().slice(0, 5) },
      })
    }

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile guru absensi POST error:", e)
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500, headers: corsHeaders })
  }
}
