import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logExamAudit } from "@/lib/exam/audit"
import type { CheatingType, CheatingSeverity } from "@prisma/client"

const SEVERITY_MAP: Record<string, { severity: CheatingSeverity; score: number }> = {
  TAB_SWITCH: { severity: "MEDIUM", score: 15 },
  WINDOW_BLUR: { severity: "LOW", score: 10 },
  COPY_ATTEMPT: { severity: "HIGH", score: 20 },
  PASTE_ATTEMPT: { severity: "HIGH", score: 20 },
  PASTE_DETECTED: { severity: "CRITICAL", score: 30 },
  RIGHT_CLICK: { severity: "LOW", score: 5 },
  DEVTOOLS: { severity: "CRITICAL", score: 25 },
  FULLSCREEN_EXIT: { severity: "MEDIUM", score: 15 },
  KEYBOARD_SHORTCUT: { severity: "HIGH", score: 15 },
  SCREENSHOT: { severity: "CRITICAL", score: 25 },
}

const TYPE_MESSAGE_MAP: Record<string, string> = {
  TAB_SWITCH: "Tab dipindahkan",
  WINDOW_BLUR: "Jendela kehilangan fokus",
  COPY_ATTEMPT: "Percobaan copy",
  PASTE_ATTEMPT: "Percobaan paste",
  PASTE_DETECTED: "Paste terdeteksi",
  RIGHT_CLICK: "Klik kanan",
  DEVTOOLS: "Akses devtools",
  FULLSCREEN_EXIT: "Keluar dari fullscreen",
  KEYBOARD_SHORTCUT: "Shortcut keyboard",
  SCREENSHOT: "Screenshot terdeteksi",
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { type, detail, clientTimestamp } = body as {
      type?: string
      detail?: Record<string, unknown>
      clientTimestamp?: number
    }

    if (!type || !SEVERITY_MAP[type]) {
      return NextResponse.json({ error: "Invalid cheating event type" }, { status: 400 })
    }

    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })

    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    const examSession = await prisma.examSession.findFirst({
      where: {
        ujianId: id,
        siswaId: siswa.id,
        status: "IN_PROGRESS",
      },
    })

    if (!examSession) {
      return NextResponse.json(
        { error: "No active exam session found" },
        { status: 404 }
      )
    }

    const { severity, score } = SEVERITY_MAP[type]

    const event = await prisma.cheatingEvent.create({
      data: {
        sessionId: examSession.id,
        type: type as CheatingType,
        severity,
        message: TYPE_MESSAGE_MAP[type] ?? type,
        detail: (detail ?? undefined) as any,
        clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined,
      },
    })

    const newScore = Math.min(100, examSession.cheatingScore + score)

    const updateData: Record<string, unknown> = {
      cheatingScore: newScore,
    }

    if (type === "TAB_SWITCH") {
      updateData.tabSwitchCount = examSession.tabSwitchCount + 1
    }

    if (type === "WINDOW_BLUR" && detail?.durationMs) {
      updateData.totalBlurMs =
        examSession.totalBlurMs + (detail.durationMs as number)
    }

    if (newScore >= 75 && !examSession.isFlagged) {
      updateData.isFlagged = true
      updateData.flagReason = `Cheating score reached ${newScore}`
      if (examSession.status === "IN_PROGRESS") {
        updateData.status = "FLAGGED"
      }
    }

    const updatedSession = await prisma.examSession.update({
      where: { id: examSession.id },
      data: updateData,
    })

    await logExamAudit({
      ujianId: id,
      siswaId: siswa.id,
      sessionId: examSession.id,
      action: "CHEATING_DETECTED",
      actorId: siswa.userId,
      actorRole: "SISWA",
      detail: {
        eventType: type,
        severity,
        score,
        cumulativeScore: newScore,
        eventId: event.id,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    })

    return NextResponse.json({
      success: true,
      shouldAutoSubmit: updatedSession.cheatingScore >= 75,
    })
  } catch (error) {
    console.error("Error reporting cheating event:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
