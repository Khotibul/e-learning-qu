import { prisma } from "@/lib/prisma"

export async function isAssessmentLocked(ujianId: string, siswaId: string): Promise<boolean> {
  const nilai = await prisma.nilai.findFirst({
    where: { ujianId, siswaId, deletedAt: null },
  })
  if (nilai) return true

  const graded = await prisma.jawabanUjian.findFirst({
    where: { ujianId, siswaId, poin: { gt: 0 } },
  })
  if (graded) return true

  return false
}

export async function getAssessmentStatus(
  ujianId: string,
  siswaId: string
): Promise<{ isLocked: boolean; gradedAt: Date | null; score: number | null }> {
  const nilai = await prisma.nilai.findFirst({
    where: { ujianId, siswaId, deletedAt: null },
  })
  if (nilai) {
    return { isLocked: true, gradedAt: nilai.updatedAt, score: nilai.nilai }
  }

  const graded = await prisma.jawabanUjian.findFirst({
    where: { ujianId, siswaId, poin: { gt: 0 } },
    orderBy: { updatedAt: "desc" },
  })
  if (graded) {
    return { isLocked: true, gradedAt: graded.updatedAt, score: null }
  }

  return { isLocked: false, gradedAt: null, score: null }
}

export async function lockAssessment(ujianId: string, siswaId: string): Promise<void> {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      kelas: {
        include: {
          siswas: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  })
  if (!ujian) return

  const siswaIds = ujian.kelas.siswas.map((s) => s.id)

  const distinctSubmitters = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    distinct: ["siswaId"],
    select: { siswaId: true },
  })
  const submittedIds = distinctSubmitters.map((j) => j.siswaId)
  const relevantSubmitted = submittedIds.filter((id) => siswaIds.includes(id))

  if (relevantSubmitted.length === 0) return

  const allGraded = await Promise.all(
    relevantSubmitted.map(async (sid) => {
      const hasNilai = await prisma.nilai.findFirst({
        where: { ujianId, siswaId: sid, deletedAt: null },
      })
      return !!hasNilai
    })
  )

  if (allGraded.every(Boolean)) {
    await prisma.ujian.update({
      where: { id: ujianId },
      data: { status: "DITUTUP" },
    })
  }
}

export async function getSubmissionCount(
  ujianId: string
): Promise<{ total: number; graded: number; pending: number }> {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      kelas: {
        include: {
          siswas: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  })
  if (!ujian) return { total: 0, graded: 0, pending: 0 }

  const siswaIds = ujian.kelas.siswas.map((s) => s.id)

  const distinctSubmitters = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    distinct: ["siswaId"],
    select: { siswaId: true },
  })
  const submittedIds = distinctSubmitters.map((j) => j.siswaId)
  const total = submittedIds.filter((id) => siswaIds.includes(id)).length

  const nilaiCount = await prisma.nilai.count({
    where: { ujianId, siswaId: { in: siswaIds }, deletedAt: null },
  })

  return { total, graded: nilaiCount, pending: total - nilaiCount }
}
