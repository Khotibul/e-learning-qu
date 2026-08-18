"use server"

import { getTeacherAnalytics as getTeacherAnalyticsAgent } from "@/lib/agents/teacher-analytics"
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

export async function getTeacherAnalytics() {
  const guruId = await getGuruId()
  return getTeacherAnalyticsAgent(guruId)
}

export { resolveWarningAgent as resolveWarning }

export async function getAtRiskStudents() {
  const guruId = await getGuruId()
  return getAtRiskStudentsAgent(guruId)
}
