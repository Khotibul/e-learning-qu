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

    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    const siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!siswa) return NextResponse.json({ error: "Siswa not found" }, { status: 404, headers: corsHeaders })

    const where: Record<string, unknown> = { siswa: { some: { siswaId: siswa.id } } }
    if (start) (where as Record<string, unknown>).tanggal = { ...(where.tanggal as object || {}), gte: new Date(start) }
    if (end) {
      const endDate = new Date(end)
      endDate.setHours(23, 59, 59, 999)
      ;(where as Record<string, unknown>).tanggal = { ...(where.tanggal as object || {}), lte: endDate }
    }

    const absensi = await prisma.absensi.findMany({
      where: where as never,
      include: {
        mataPelajaran: { select: { nama: true } },
        siswa: { where: { siswaId: siswa.id }, select: { status: true } },
      },
      orderBy: { tanggal: "desc" },
      take: 100,
    })

    const result = absensi.map((a) => ({
      id: a.id,
      tanggal: a.tanggal.toISOString(),
      status: (a.siswa[0] as { status: string } | undefined)?.status || "TIDAK_HADIR",
      mataPelajaran: a.mataPelajaran.nama,
    }))

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile absensi error:", e)
    return NextResponse.json({ error: "Gagal memuat absensi" }, { status: 500, headers: corsHeaders })
  }
}
