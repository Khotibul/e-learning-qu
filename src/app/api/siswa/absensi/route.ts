import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  try {
    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })
    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    const where: any = {
      siswa: { some: { siswaId: siswa.id } },
    }
    if (start) {
      where.tanggal = { ...(where.tanggal || {}), gte: new Date(start) }
    }
    if (end) {
      const endDate = new Date(end)
      endDate.setHours(23, 59, 59, 999)
      where.tanggal = { ...(where.tanggal || {}), lte: endDate }
    }

    const absensi = await prisma.absensi.findMany({
      where,
      include: {
        mataPelajaran: { select: { nama: true } },
        siswa: {
          where: { siswaId: siswa.id },
          select: { status: true },
        },
      },
      orderBy: { tanggal: "desc" },
    })

    const result = absensi.map((a) => ({
      id: a.id,
      tanggal: a.tanggal.toISOString(),
      status: a.siswa[0]?.status || "TIDAK_HADIR",
      mataPelajaran: a.mataPelajaran.nama,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching absensi siswa:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
