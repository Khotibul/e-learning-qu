import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { trackAssessmentDimulai } from "@/lib/agents/learning-analytics"

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

    const now = new Date()

    // ── Auto‑transition for otomatis mode ──
    if (ujian.mode === "otomatis") {
      const jamMulai = new Date(ujian.jamMulai)
      const jamSelesai = new Date(ujian.jamSelesai)

      if (ujian.status === "DRAFT" && now >= jamMulai) {
        await prisma.ujian.update({
          where: { id: ujian.id },
          data: { status: "AKTIF" },
        })
        ujian.status = "AKTIF"
      }

      if (ujian.status === "AKTIF" && now >= jamSelesai) {
        await prisma.ujian.update({
          where: { id: ujian.id },
          data: { status: "SELESAI" },
        })
        ujian.status = "SELESAI"
      }

      if (ujian.status === "DRAFT" && now < jamMulai) {
        return NextResponse.json({ error: "Ujian belum dimulai" }, { status: 400 })
      }
    }

    if (ujian.status !== "AKTIF") {
      return NextResponse.json({ error: "Ujian tidak aktif" }, { status: 400 })
    }

    // ── Retake: clear old answers if bisaRetake is enabled ──
    if (ujian.bisaRetake) {
      await prisma.jawabanUjian.deleteMany({
        where: { ujianId: id, siswaId: siswa.id },
      })
      await prisma.nilai.deleteMany({
        where: { ujianId: id, siswaId: siswa.id },
      })
    }

    const existing = await prisma.jawabanUjian.findMany({
      where: { ujianId: id, siswaId: siswa.id },
      select: { soalId: true, jawaban: true, raguRagu: true },
    })

    if (existing.length === 0) {
      await prisma.jawabanUjian.createMany({
        data: ujian.ujianSoal.map((us) => ({
          ujianId: id,
          siswaId: siswa.id,
          soalId: us.soalId,
        })),
      })
    }

    const savedAnswers: Record<string, string> = {}
    const savedRagu: string[] = []
    for (const j of existing) {
      if (j.jawaban) {
        let val = j.jawaban
        try { const p = JSON.parse(val); if (Array.isArray(p)) val = "" } catch {}
        if (val) savedAnswers[j.soalId] = val
      }
      if (j.raguRagu) savedRagu.push(j.soalId)
    }

    trackAssessmentDimulai(siswa.id, id, ujian.mataPelajaranId ?? undefined).catch(() => {})

    return NextResponse.json({ success: true, savedAnswers, savedRagu })
  } catch (error) {
    console.error("Error starting ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
