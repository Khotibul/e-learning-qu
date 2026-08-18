import { prisma } from "@/lib/prisma"
import type { AktivitasJenis } from "@prisma/client"

interface AdaptivePath {
  id: string
  kompetensi: string
  items: {
    id: string
    judul: string
    jenis: string
    status: string
    urutan: number
  }[]
  progres: number
}

export async function generateAdaptivePath(siswaId: string) {
  const penguasaan = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    include: {
      kompetensi: {
        select: {
          id: true,
          kode: true,
          nama: true,
          prasyarat: { select: { prasyaratKompetensi: { select: { id: true, nama: true } } } },
          materis: {
            where: { deletedAt: null },
            select: { id: true, judul: true },
            orderBy: { createdAt: "asc" },
          },
          soals: {
            where: { deletedAt: null },
            select: { id: true, pertanyaan: true },
            take: 5,
          },
        },
      },
    },
    orderBy: { skor: "asc" },
  })

  const existingPath = await prisma.learningPath.findUnique({
    where: { siswaId },
    include: { items: { orderBy: { urutan: "asc" } } },
  })

  const pathItems: { kompetensiId: string; materiId?: string; jenis: AktivitasJenis; urutan: number }[] = []
  let urutan = 1

  for (const p of penguasaan) {
    if (p.kategori === "ADVANCED") continue

    const prasyaratIds = p.kompetensi.prasyarat.map((pr) => pr.prasyaratKompetensi.id)
    const prasyaratPenguasaan = penguasaan.filter((pe) => prasyaratIds.includes(pe.kompetensiId))
    const prasyaratTerpenuhi = prasyaratPenguasaan.every((pp) => pp.skor >= 40)

    if (prasyaratIds.length > 0 && !prasyaratTerpenuhi) continue

    for (const materi of p.kompetensi.materis) {
      const alreadyExists = existingPath?.items.some(
        (item) => item.materiId === materi.id
      )
      if (!alreadyExists) {
        pathItems.push({
          kompetensiId: p.kompetensi.id,
          materiId: materi.id,
          jenis: "MATERI_DIBUKA",
          urutan: urutan++,
        })
      }
    }

    if (p.skor < 40 && p.kompetensi.soals.length > 0) {
      const alreadyHasLatihan = existingPath?.items.some(
        (item) => item.kompetensiId === p.kompetensi.id && item.jenis === "LATIHAN_SELESAI"
      )
      if (!alreadyHasLatihan) {
        pathItems.push({
          kompetensiId: p.kompetensi.id,
          jenis: "LATIHAN_SELESAI",
          urutan: urutan++,
        })
      }
    }
  }

  if (pathItems.length === 0 && existingPath) {
    return formatPath(existingPath)
  }

  if (pathItems.length === 0) {
    const allKompetensi = await prisma.kompetensi.findMany({
      where: { deletedAt: null },
      include: {
        materis: {
          where: { deletedAt: null },
          select: { id: true, judul: true },
          orderBy: { createdAt: "asc" },
          take: 2,
        },
      },
      orderBy: { urutan: "asc" },
      take: 5,
    })
    for (const k of allKompetensi) {
      for (const m of k.materis) {
        pathItems.push({
          kompetensiId: k.id,
          materiId: m.id,
          jenis: "MATERI_DIBUKA",
          urutan: urutan++,
        })
      }
    }
  }

  if (existingPath) {
    await prisma.learningPathItem.deleteMany({ where: { learningPathId: existingPath.id } })
    if (pathItems.length > 0) {
      await prisma.learningPathItem.createMany({
        data: pathItems.map((item) => ({
          learningPathId: existingPath.id,
          kompetensiId: item.kompetensiId,
          materiId: item.materiId ?? null,
          jenis: item.jenis as AktivitasJenis,
          urutan: item.urutan,
          status: "PENDING" as const,
        })),
      })
    }
    return prisma.learningPath.findUnique({
      where: { siswaId },
      include: { items: { orderBy: { urutan: "asc" } } },
    })
  }

  const newPath = await prisma.learningPath.create({
    data: {
      siswaId,
      progres: 0,
      items: {
        create: pathItems.map((item) => ({
          kompetensiId: item.kompetensiId,
          materiId: item.materiId ?? null,
          jenis: item.jenis as AktivitasJenis,
          urutan: item.urutan,
          status: "PENDING" as const,
        })),
      },
    },
    include: { items: { orderBy: { urutan: "asc" } } },
  })

  return newPath
}

function formatPath(path: any): AdaptivePath {
  return {
    id: path.id,
    kompetensi: path.kompetensiId ?? "-",
    items: path.items.map((item: any) => ({
      id: item.id,
      judul: item.materiId ?? item.jenis,
      jenis: item.jenis,
      status: item.status,
      urutan: item.urutan,
    })),
    progres: path.progres,
  }
}

export async function markPathItemComplete(siswaId: string, itemId: string) {
  const item = await prisma.learningPathItem.findFirst({
    where: { id: itemId, learningPath: { siswaId } },
  })
  if (!item) return null

  await prisma.learningPathItem.update({
    where: { id: itemId },
    data: { status: "SELESAI" },
  })

  const path = await prisma.learningPath.findUnique({
    where: { id: item.learningPathId },
    include: { items: true },
  })
  if (!path) return null

  const totalItems = path.items.length
  const doneItems = path.items.filter((i) => i.status === "SELESAI").length
  const progres = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  await prisma.learningPath.update({
    where: { id: path.id },
    data: { progres },
  })

  return { progres, doneItems, totalItems }
}

export async function getAdaptivePath(siswaId: string) {
  const existing = await prisma.learningPath.findUnique({
    where: { siswaId },
    include: {
      items: {
        orderBy: { urutan: "asc" },
        include: {
          materi: { select: { id: true, judul: true, fileUrl: true, fileType: true } },
          kompetensi: { select: { id: true, nama: true, kode: true } },
        },
      },
    },
  })
  if (existing) return existing
  return generateAdaptivePath(siswaId)
}
