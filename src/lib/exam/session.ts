import { prisma } from "@/lib/prisma"

export async function createExamSession(params: {
  ujianId: string
  siswaId: string
  ipAddress?: string
  userAgent?: string
}): Promise<{ sessionId: string; serverTime: number }> {
  const now = new Date()

  const existing = await prisma.examSession.findUnique({
    where: {
      ujianId_siswaId: {
        ujianId: params.ujianId,
        siswaId: params.siswaId,
      },
    },
    include: {
      ujian: { select: { bisaRetake: true } },
    },
  })

  if (existing) {
    if (existing.status === "IN_PROGRESS") {
      return { sessionId: existing.id, serverTime: now.getTime() }
    }
    if (existing.status === "SUBMITTED" && !existing.ujian?.bisaRetake) {
      throw new Error("Exam already submitted and retake is not allowed")
    }
  }

  const session = await prisma.examSession.upsert({
    where: {
      ujianId_siswaId: {
        ujianId: params.ujianId,
        siswaId: params.siswaId,
      },
    },
    create: {
      ujianId: params.ujianId,
      siswaId: params.siswaId,
      startedAt: now,
      serverStartedAt: now,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: "IN_PROGRESS",
    },
    update: {
      startedAt: now,
      serverStartedAt: now,
      submittedAt: null,
      serverSubmitAt: null,
      totalDurationMs: null,
      status: "IN_PROGRESS",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      tabSwitchCount: 0,
      totalBlurMs: 0,
      cheatingScore: 0,
      isFlagged: false,
      flagReason: null,
    },
  })

  return { sessionId: session.id, serverTime: now.getTime() }
}

export async function examHeartbeat(sessionId: string): Promise<{
  serverTime: number
  remainingMs: number
  isExpired: boolean
}> {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { ujian: { select: { durasi: true } } },
  })

  if (!session) throw new Error("Session not found")
  if (session.status !== "IN_PROGRESS") {
    throw new Error(`Session is ${session.status}, not IN_PROGRESS`)
  }

  const now = new Date()
  const durationMs = session.ujian.durasi * 60 * 1000
  const elapsed = now.getTime() - session.serverStartedAt.getTime()
  const remainingMs = Math.max(0, durationMs - elapsed)
  const isExpired = remainingMs <= 0

  if (isExpired) {
    await prisma.examSession.updateMany({
      where: { id: sessionId, status: "IN_PROGRESS" },
      data: {
        status: "TIMED_OUT",
        submittedAt: now,
        serverSubmitAt: now,
        totalDurationMs: durationMs,
      },
    })
  }

  return { serverTime: now.getTime(), remainingMs, isExpired }
}

export async function submitExamSession(sessionId: string): Promise<{
  serverTime: number
  durationMs: number
}> {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) throw new Error("Session not found")
  if (session.status === "SUBMITTED" || session.status === "TIMED_OUT") {
    // Submit ganda / race dengan heartbeat — idempoten, jangan lempar error
    return { serverTime: Date.now(), durationMs: session.totalDurationMs ?? 0 }
  }

  const now = new Date()
  const durationMs = now.getTime() - session.serverStartedAt.getTime()

  const tr = await prisma.examSession.updateMany({
    where: { id: sessionId, status: { in: ["IN_PROGRESS", "FLAGGED"] } },
    data: {
      submittedAt: now,
      serverSubmitAt: now,
      totalDurationMs: durationMs,
      status: "SUBMITTED",
    },
  })

  if (tr.count === 0) {
    // Transisi sudah dilakukan pihak lain (race) — kembalikan durasi tersimpan
    const fresh = await prisma.examSession.findUnique({ where: { id: sessionId } })
    return {
      serverTime: now.getTime(),
      durationMs: fresh?.totalDurationMs ?? durationMs,
    }
  }

  return { serverTime: now.getTime(), durationMs }
}

export async function flagSession(
  sessionId: string,
  reason: string,
  cheatingScore: number
): Promise<void> {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) throw new Error("Session not found")

  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      isFlagged: true,
      flagReason: reason,
      cheatingScore,
    },
  })

  if (cheatingScore >= 50) {
    // Transisi status hanya dari IN_PROGRESS — jangan menimpa TIMED_OUT/SUBMITTED
    await prisma.examSession.updateMany({
      where: { id: sessionId, status: "IN_PROGRESS" },
      data: { status: "FLAGGED" },
    })
  }
}

export async function getActiveSession(ujianId: string, siswaId: string) {
  const session = await prisma.examSession.findFirst({
    where: {
      ujianId,
      siswaId,
      status: "IN_PROGRESS",
    },
  })

  return session ?? null
}

export async function getSessionStats(ujianId: string) {
  const sessions = await prisma.examSession.findMany({
    where: { ujianId },
    select: {
      status: true,
      cheatingScore: true,
      isFlagged: true,
      siswaId: true,
      tabSwitchCount: true,
      totalBlurMs: true,
      totalDurationMs: true,
    },
  })

  const total = sessions.length
  const completed = sessions.filter((s) => s.status === "SUBMITTED").length
  const timedOut = sessions.filter((s) => s.status === "TIMED_OUT").length
  const flagged = sessions.filter((s) => s.status === "FLAGGED" || s.isFlagged).length

  const avgCheatingScore =
    total > 0
      ? sessions.reduce((sum, s) => sum + s.cheatingScore, 0) / total
      : 0

  const flaggedSessions = sessions
    .filter((s) => s.isFlagged)
    .sort((a, b) => b.cheatingScore - a.cheatingScore)

  const topFlagged = flaggedSessions.slice(0, 10)

  const avgDuration =
    completed > 0
      ? sessions
          .filter((s) => s.totalDurationMs != null)
          .reduce((sum, s) => sum + (s.totalDurationMs ?? 0), 0) / completed
      : 0

  return {
    total,
    completed,
    timedOut,
    flagged,
    avgCheatingScore: Math.round(avgCheatingScore),
    avgDuration: Math.round(avgDuration),
    topFlagged,
  }
}
