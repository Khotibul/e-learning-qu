"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getGuruId() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email! }, deletedAt: null },
  })
  if (!guru) redirect("/login")
  return guru.id
}

export async function getExamsWithStats() {
  const guruId = await getGuruId()
  const ujians = await prisma.ujian.findMany({
    where: { guruId, deletedAt: null },
    include: {
      mataPelajaran: { select: { nama: true, kode: true } },
      kelas: { select: { nama: true } },
      examSessions: {
        select: {
          id: true,
          isFlagged: true,
          cheatingScore: true,
          tabSwitchCount: true,
          totalBlurMs: true,
          status: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { tanggal: "desc" },
  })

  return ujians.map((u) => {
    const sessions = u.examSessions
    const totalSessions = sessions.length
    const flaggedCount = sessions.filter((s) => s.isFlagged).length
    const avgCheatingScore =
      totalSessions > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.cheatingScore, 0) / totalSessions)
        : 0
    const avgTabSwitch =
      totalSessions > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.tabSwitchCount, 0) / totalSessions)
        : 0

    return {
      id: u.id,
      nama: u.nama,
      mataPelajaran: u.mataPelajaran.nama,
      kelas: u.kelas.nama,
      tanggal: u.tanggal.toISOString(),
      status: u.status,
      totalSessions,
      flaggedCount,
      avgCheatingScore,
      avgTabSwitch,
    }
  })
}

export async function getCheatingReport(ujianId: string) {
  const guruId = await getGuruId()
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, guruId, deletedAt: null },
  })
  if (!ujian) throw new Error("Ujian tidak ditemukan")

  const sessions = await prisma.examSession.findMany({
    where: { ujianId },
    include: {
      siswa: { select: { id: true, nama: true, nis: true } },
      cheatingEvents: { orderBy: { timestamp: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  })

  return sessions.map((s) => ({
    id: s.id,
    siswa: { id: s.siswa.id, nama: s.siswa.nama, nis: s.siswa.nis },
    startedAt: s.startedAt.toISOString(),
    submittedAt: s.submittedAt?.toISOString() ?? null,
    totalDurationMs: s.totalDurationMs,
    tabSwitchCount: s.tabSwitchCount,
    totalBlurMs: s.totalBlurMs,
    cheatingScore: s.cheatingScore,
    isFlagged: s.isFlagged,
    flagReason: s.flagReason,
    status: s.status,
    events: s.cheatingEvents.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      message: e.message,
      timestamp: e.timestamp.toISOString(),
    })),
  }))
}

export async function getEventTimeline(sessionId: string) {
  const events = await prisma.cheatingEvent.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  })
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    severity: e.severity,
    message: e.message,
    detail: e.detail,
    timestamp: e.timestamp.toISOString(),
  }))
}

export async function clearCheatingFlag(sessionId: string, reason: string) {
  const guruId = await getGuruId()
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    select: { ujianId: true, siswaId: true },
  })
  if (!session) throw new Error("Session tidak ditemukan")

  await prisma.$transaction([
    prisma.examSession.update({
      where: { id: sessionId },
      data: { isFlagged: false, flagReason: `Dibatalkan: ${reason}` },
    }),
    prisma.examAuditLog.create({
      data: {
        ujianId: session.ujianId,
        siswaId: session.siswaId,
        sessionId,
        action: "CHEATING_CLEARED",
        actorId: guruId,
        actorRole: "GURU",
        detail: { reason },
      },
    }),
  ])

  revalidatePath("/guru/anti-cheat")
  return { success: true }
}

export async function getExamAuditLogs(ujianId: string, page = 1, limit = 20) {
  const guruId = await getGuruId()
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, guruId, deletedAt: null },
  })
  if (!ujian) throw new Error("Ujian tidak ditemukan")

  const skip = (page - 1) * limit
  const [logs, total] = await Promise.all([
    prisma.examAuditLog.findMany({
      where: { ujianId },
      include: { siswa: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.examAuditLog.count({ where: { ujianId } }),
  ])

  return {
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      actorRole: l.actorRole,
      siswaName: l.siswa?.nama ?? null,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  }
}
