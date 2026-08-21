"use server"

import { getTeacherAnalytics as getTeacherAnalyticsAgent, getTeacherStudentInsights as getInsightsAgent } from "@/lib/agents/teacher-analytics"
import { resolveWarning as resolveWarningAgent, getAtRiskStudents as getAtRiskStudentsAgent } from "@/lib/agents/early-warning"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

async function getGuruId() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const { prisma } = await import("@/lib/prisma")
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email }, deletedAt: null },
  })
  if (!guru) redirect("/login")
  return guru.id
}

// Kelas yang boleh dilihat guru: kelas hasil pengajaran + kelas perwaliannya
async function getGuruAllowedKelasIds(guruId: string): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma")
  const [pengajaranKelas, waliKelas] = await Promise.all([
    prisma.pengajaran.findMany({
      where: { guruId, deletedAt: null, mataPelajaran: { deletedAt: null } },
      select: { kelasId: true },
      distinct: ["kelasId"],
    }),
    prisma.kelas.findMany({ where: { guruId, deletedAt: null }, select: { id: true } }),
  ])
  return [...new Set([...pengajaranKelas.map((p) => p.kelasId), ...waliKelas.map((k) => k.id)])]
}

export async function getTeacherAnalytics() {
  const guruId = await getGuruId()
  return getTeacherAnalyticsAgent(guruId)
}

export async function getAtRiskStudents() {
  const guruId = await getGuruId()
  // SCOPE: guru hanya melihat siswa berisiko di kelasnya (fix kebocoran lintas guru)
  const kelasIds = await getGuruAllowedKelasIds(guruId)
  return getAtRiskStudentsAgent(kelasIds)
}

// Phase 17: insight agregat per siswa untuk dashboard/list guru
export async function getStudentInsights(siswaIds?: string[]) {
  const guruId = await getGuruId()
  return getInsightsAgent(guruId, { siswaIds })
}

export async function resolveWarning(warningId: string) {
  const guruId = await getGuruId()
  // OWNERSHIP CHECK (fix IDOR): warning harus milik siswa di kelas guru ini
  const { prisma } = await import("@/lib/prisma")
  const warning = await prisma.earlyWarning.findFirst({
    where: { id: warningId },
    select: { id: true, siswa: { select: { kelasId: true } } },
  })
  if (!warning) throw new Error("Peringatan tidak ditemukan")
  const allowed = await getGuruAllowedKelasIds(guruId)
  if (!warning.siswa?.kelasId || !allowed.includes(warning.siswa.kelasId)) {
    throw new Error("Tidak berhak menutup peringatan ini")
  }
  return resolveWarningAgent(warningId)
}
