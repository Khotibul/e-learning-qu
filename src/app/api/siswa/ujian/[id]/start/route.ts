import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { trackAssessmentDimulai } from "@/lib/agents/learning-analytics"
import { isAssessmentLocked } from "@/lib/assessment-guard"
import { createExamSession } from "@/lib/exam/session"
import { logExamAudit } from "@/lib/exam/audit"

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

    if (ujian.status !== "AKTIF" && !(ujian.status === "SELESAI" && ujian.bisaRetake) && !(ujian.status === "DITUTUP" && ujian.bisaRetake)) {
      return NextResponse.json({ error: "Ujian tidak aktif" }, { status: 400 })
    }

    if (ujian.status === "SELESAI" && ujian.bisaRetake) {
      const existingNilai = await prisma.nilai.findFirst({
        where: { ujianId: id, siswaId: siswa.id },
      })
      if (!existingNilai) {
        return NextResponse.json({ error: "Belum ada nilai untuk diretake" }, { status: 400 })
      }
    }

    // ── Retake: clear old data BEFORE locked/graded checks ──
    if (ujian.bisaRetake) {
      await prisma.jawabanUjian.deleteMany({
        where: { ujianId: id, siswaId: siswa.id },
      })
      await prisma.nilai.deleteMany({
        where: { ujianId: id, siswaId: siswa.id },
      })
    }

    if (await isAssessmentLocked(id, siswa.id)) {
      return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat dikerjakan ulang" }, { status: 403 })
    }

    const alreadyGraded = await prisma.jawabanUjian.findFirst({
      where: {
        ujianId: id,
        siswaId: siswa.id,
        poin: { gt: 0 },
      },
    })
    if (alreadyGraded) {
      return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat dikerjakan ulang" }, { status: 403 })
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

    let sessionId: string | null = null
    let serverTime = Date.now()
    try {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined
      const ua = req.headers.get("user-agent") || undefined
      const result = await createExamSession({
        ujianId: id,
        siswaId: siswa.id,
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      })
      sessionId = result.sessionId
      serverTime = result.serverTime
      await logExamAudit({
        ujianId: id,
        siswaId: siswa.id,
        sessionId,
        action: "SESSION_STARTED",
        actorId: siswa.userId,
        actorRole: "SISWA",
        detail: { ipAddress: ip, userAgent: ua },
        ipAddress: ip ?? undefined,
      })
    } catch {}

    return NextResponse.json({ success: true, savedAnswers, savedRagu, sessionId, serverTime })
  } catch (error) {
    console.error("Error starting ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
