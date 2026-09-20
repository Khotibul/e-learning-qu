import { prisma, withRetry } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { trackAssessmentDimulai } from "@/lib/agents/learning-analytics"
import { isAssessmentLocked } from "@/lib/assessment-guard"
import { createExamSession } from "@/lib/exam/session"
import { logExamAudit } from "@/lib/exam/audit"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { id } = await params
    const siswa = await prisma.siswa.findUnique({ where: { userId: user.id } })
    if (!siswa) return NextResponse.json({ error: "Siswa not found" }, { status: 404, headers: corsHeaders })

    const ipEarly = getClientIp(req)
    const rlStart = rateLimit(`start:${ipEarly}:${siswa.id}:${id}`, 8, 60000)
    if (!rlStart.success) {
      return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi 60 detik" }, { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } })
    }

    const ujian = await withRetry(() => prisma.ujian.findUnique({ where: { id }, include: { ujianSoal: { orderBy: { nomor: "asc" } } } }))
    if (!ujian) return NextResponse.json({ error: "Ujian not found" }, { status: 404, headers: corsHeaders })

    const now = new Date()
    if (ujian.mode === "otomatis") {
      const jamMulai = new Date(ujian.jamMulai)
      const jamSelesai = new Date(ujian.jamSelesai)
      if (ujian.status === "DRAFT" && now >= jamMulai) {
        await prisma.ujian.update({ where: { id: ujian.id }, data: { status: "AKTIF" } })
        ujian.status = "AKTIF" as never
      }
      if (ujian.status === "AKTIF" && now >= jamSelesai) {
        await prisma.ujian.update({ where: { id: ujian.id }, data: { status: "SELESAI" } })
        ujian.status = "SELESAI" as never
      }
      if (ujian.status === "DRAFT" && now < jamMulai) return NextResponse.json({ error: "Ujian belum dimulai" }, { status: 400, headers: corsHeaders })
    }

    if (ujian.status !== "AKTIF" && !(ujian.status === "SELESAI" && ujian.bisaRetake) && !(ujian.status === "DITUTUP" && ujian.bisaRetake)) {
      return NextResponse.json({ error: "Ujian tidak aktif" }, { status: 400, headers: corsHeaders })
    }

    if (ujian.status === "SELESAI" && ujian.bisaRetake) {
      const existingNilai = await prisma.nilai.findFirst({ where: { ujianId: id, siswaId: siswa.id } })
      if (!existingNilai) return NextResponse.json({ error: "Belum ada nilai untuk diretake" }, { status: 400, headers: corsHeaders })
    }

    if (ujian.bisaRetake) {
      await prisma.jawabanUjian.deleteMany({ where: { ujianId: id, siswaId: siswa.id } })
      await prisma.nilai.deleteMany({ where: { ujianId: id, siswaId: siswa.id } })
    }

    if (await isAssessmentLocked(id, siswa.id)) {
      return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat dikerjakan ulang" }, { status: 403, headers: corsHeaders })
    }

    const alreadyGraded = await prisma.jawabanUjian.findFirst({ where: { ujianId: id, siswaId: siswa.id, poin: { gt: 0 } } })
    if (alreadyGraded) return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat dikerjakan ulang" }, { status: 403, headers: corsHeaders })

    const existing = await prisma.jawabanUjian.findMany({ where: { ujianId: id, siswaId: siswa.id }, select: { soalId: true, jawaban: true, raguRagu: true } })

    if (existing.length === 0) {
      await prisma.jawabanUjian.createMany({ data: ujian.ujianSoal.map((us) => ({ ujianId: id, siswaId: siswa.id, soalId: us.soalId })) })
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
      const result = await createExamSession({ ujianId: id, siswaId: siswa.id, ipAddress: ip ?? undefined, userAgent: ua ?? undefined })
      sessionId = result.sessionId
      serverTime = result.serverTime
      await logExamAudit({ ujianId: id, siswaId: siswa.id, sessionId, action: "SESSION_STARTED", actorId: siswa.userId, actorRole: "SISWA", detail: { ipAddress: ip, userAgent: ua }, ipAddress: ip ?? undefined })
    } catch {}

    return NextResponse.json({ success: true, savedAnswers, savedRagu, sessionId, serverTime }, { headers: corsHeaders })
  } catch (error) {
    console.error("Error starting ujian mobile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders })
  }
}
