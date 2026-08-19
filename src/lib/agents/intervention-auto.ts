import { prisma } from "@/lib/prisma"
import type { InterventionTipe } from "@prisma/client"

const WARNING_TO_ACTION: Record<string, { tipe: InterventionTipe; actionPrefix: string }> = {
  NILAI_DROP: {
    tipe: "REMEDIAL",
    actionPrefix: "Berikan sesi remedial untuk mata pelajaran yang mengalami penurunan nilai",
  },
  INAKTIF: {
    tipe: "FOLLOW_UP",
    actionPrefix: "Hubungi siswa untuk mengetahui kondisi dan memberikan motivasi",
  },
  RENDAH_PENGUASAAN: {
    tipe: "TUGAS_TAMBAHAN",
    actionPrefix: "Berikan latihan tambahan untuk kompetensi yang lemah",
  },
  GAGAL_UJIAN: {
    tipe: "MENTORING",
    actionPrefix: "Sesi mentoring untuk membahas kesulitan belajar",
  },
  LOW_MOTIVASI: {
    tipe: "KONSULTASI",
    actionPrefix: "Konsultasi untuk memahami faktor yang mempengaruhi motivasi belajar",
  },
}

export async function autoCreateIntervention(
  siswaId: string,
  warning: { tipe: string; severity: string; message: string; skor: number }
): Promise<string | null> {
  const config = WARNING_TO_ACTION[warning.tipe]
  if (!config) return null

  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    include: { kelas: { select: { guruId: true, nama: true } } },
  })
  if (!siswa?.kelas?.guruId) return null

  const guruId = siswa.kelas.guruId
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const existing = await prisma.intervention.findFirst({
    where: {
      siswaId,
      tipe: config.tipe,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      createdAt: { gte: fourteenDaysAgo },
    },
  })
  if (existing) return null

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const intervention = await prisma.intervention.create({
    data: {
      siswaId,
      guruId,
      tipe: config.tipe,
      reason: `[Auto] ${warning.message}`,
      action: `${config.actionPrefix}. Severity: ${warning.severity}. Skor: ${warning.skor}.`,
      deadline,
      notes: "Dibuat otomatis oleh sistem early warning",
    },
  })

  return intervention.id
}

export async function autoCreateInterventionsFromWarnings(
  siswaId: string,
  warnings: { tipe: string; severity: string; message: string; skor: number }[]
): Promise<string[]> {
  const created: string[] = []

  const highPriority = warnings.filter((w) => w.severity === "HIGH" || w.severity === "CRITICAL")

  for (const warning of highPriority) {
    const id = await autoCreateIntervention(siswaId, warning)
    if (id) created.push(id)
  }

  if (created.length === 0 && warnings.length > 0) {
    for (const warning of warnings.slice(0, 1)) {
      const id = await autoCreateIntervention(siswaId, warning)
      if (id) created.push(id)
    }
  }

  return created
}
