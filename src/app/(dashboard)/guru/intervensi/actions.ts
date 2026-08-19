"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { InterventionTipe, InterventionStatus } from "@prisma/client"

async function getGuruId() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email! }, deletedAt: null },
  })
  if (!guru) redirect("/login")
  return guru.id
}

export async function getInterventions(params?: { siswaId?: string; status?: InterventionStatus }) {
  const guruId = await getGuruId()
  const where: Record<string, unknown> = { guruId }
  if (params?.siswaId) where.siswaId = params.siswaId
  if (params?.status) where.status = params.status

  const interventions = await prisma.intervention.findMany({
    where,
    include: { siswa: { select: { id: true, nama: true, kelas: { select: { nama: true } } } } },
    orderBy: { createdAt: "desc" },
  })

  return interventions.map((i) => ({
    id: i.id,
    siswa: { id: i.siswa.id, nama: i.siswa.nama, kelas: i.siswa.kelas?.nama ?? "-" },
    tipe: i.tipe,
    reason: i.reason,
    action: i.action,
    deadline: i.deadline?.toISOString() ?? null,
    status: i.status,
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
  }))
}

export async function createIntervention(data: {
  siswaId: string
  tipe: InterventionTipe
  reason: string
  action: string
  deadline?: string | null
  notes?: string | null
}) {
  const guruId = await getGuruId()
  return prisma.intervention.create({
    data: {
      siswaId: data.siswaId,
      guruId,
      tipe: data.tipe,
      reason: data.reason,
      action: data.action,
      deadline: data.deadline ? new Date(data.deadline) : null,
      notes: data.notes ?? null,
    },
  })
}

export async function updateInterventionStatus(id: string, status: InterventionStatus, notes?: string) {
  const guruId = await getGuruId()
  const intervention = await prisma.intervention.findUnique({ where: { id } })
  if (!intervention || intervention.guruId !== guruId) throw new Error("Unauthorized")
  return prisma.intervention.update({
    where: { id },
    data: { status, ...(notes !== undefined ? { notes } : {}) },
  })
}

export async function deleteIntervention(id: string) {
  const guruId = await getGuruId()
  const intervention = await prisma.intervention.findUnique({ where: { id } })
  if (!intervention || intervention.guruId !== guruId) throw new Error("Unauthorized")
  return prisma.intervention.delete({ where: { id } })
}
