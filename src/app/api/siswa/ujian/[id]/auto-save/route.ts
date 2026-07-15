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
    const { answers, raguRagu } = await req.json()

    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })

    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    if (answers && typeof answers === "object") {
      for (const [soalId, jawaban] of Object.entries(answers)) {
        await prisma.jawabanUjian.upsert({
          where: {
            ujianId_siswaId_soalId: {
              ujianId: id,
              siswaId: siswa.id,
              soalId,
            },
          },
          update: {
            jawaban: jawaban as string,
            raguRagu: Array.isArray(raguRagu) && raguRagu.includes(soalId),
          },
          create: {
            ujianId: id,
            siswaId: siswa.id,
            soalId,
            jawaban: jawaban as string,
            raguRagu: Array.isArray(raguRagu) && raguRagu.includes(soalId),
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error auto-saving:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
