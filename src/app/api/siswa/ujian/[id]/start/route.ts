import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })

    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        ujianSoal: {
          orderBy: { nomor: "asc" },
        },
      },
    })

    if (!ujian) {
      return NextResponse.json({ error: "Ujian not found" }, { status: 404 })
    }

    if (ujian.status !== "AKTIF") {
      return NextResponse.json({ error: "Ujian tidak aktif" }, { status: 400 })
    }

    const existing = await prisma.jawabanUjian.findFirst({
      where: { ujianId: id, siswaId: siswa.id },
    })

    if (!existing) {
      await prisma.jawabanUjian.createMany({
        data: ujian.ujianSoal.map((us) => ({
          ujianId: id,
          siswaId: siswa.id,
          soalId: us.soalId,
        })),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
