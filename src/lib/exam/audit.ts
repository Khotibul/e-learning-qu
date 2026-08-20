import { prisma } from "@/lib/prisma"
import type { ExamAuditAction } from "@prisma/client"

export async function logExamAudit(params: {
  ujianId: string
  siswaId?: string
  sessionId?: string
  action: ExamAuditAction
  actorId: string
  actorRole: string
  detail?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  try {
    await prisma.examAuditLog.create({
      data: {
        ujianId: params.ujianId,
        siswaId: params.siswaId ?? null,
        sessionId: params.sessionId ?? null,
        action: params.action,
        actorId: params.actorId,
        actorRole: params.actorRole,
        detail: (params.detail ?? undefined) as never,
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (error) {
    console.error("Failed to create exam audit log:", error)
  }
}

export async function getExamAuditLogs(
  ujianId: string,
  params?: {
    page?: number
    limit?: number
    action?: ExamAuditAction
    siswaId?: string
  }
) {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { ujianId }

  if (params?.action) where.action = params.action
  if (params?.siswaId) where.siswaId = params.siswaId

  const [data, total] = await Promise.all([
    prisma.examAuditLog.findMany({
      where,
      include: {
        siswa: {
          select: { nama: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.examAuditLog.count({ where }),
  ])

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getExamAuditStats(ujianId: string) {
  const logs = await prisma.examAuditLog.findMany({
    where: { ujianId },
    select: {
      action: true,
      actorRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const byAction: Record<string, number> = {}
  const byActorRole: Record<string, number> = {}

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] ?? 0) + 1
    byActorRole[log.actorRole] = (byActorRole[log.actorRole] ?? 0) + 1
  }

  const timeline = logs.map((log) => ({
    action: log.action,
    actorRole: log.actorRole,
    createdAt: log.createdAt,
  }))

  return {
    total: logs.length,
    byAction,
    byActorRole,
    timeline,
  }
}
