"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { auditRaport, type HasilAudit } from "@/lib/audit-raport"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Akses ditolak")
  return session.user
}

/**
 * Jalankan audit raport atas permintaan admin. Read-only, memakai inti audit
 * yang sama dengan cron harian dan skrip CLI.
 */
export async function jalankanAuditRaport(): Promise<HasilAudit> {
  await requireAdmin()
  return auditRaport(prisma)
}
