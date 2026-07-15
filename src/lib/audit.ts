import { prisma } from "./prisma"

export async function createAuditLog(params: {
  userId: string
  action: string
  entity: string
  entityId?: string
  detail?: Record<string, unknown>
  ipAddress?: string
}) {
  try {
    await prisma.auditLog.create({ data: params as any })
  } catch (error) {
    console.error("Failed to create audit log:", error)
  }
}
