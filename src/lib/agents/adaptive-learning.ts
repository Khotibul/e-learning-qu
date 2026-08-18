import { prisma } from "@/lib/prisma"

export interface PathItem {
  id: string
  jenis: string
  materiId: string | null
  kompetensiId: string | null
  judul: string
  difficulty: string
  status: string
  urutan: number
  prasyarat: string[]
}

export interface AdaptivePath {
  id: string
  siswaId: string
  items: PathItem[]
  progres: number
  currentDifficulty: "easy" | "medium" | "hard"
  isStuck: boolean
  stuckCount: number
}

function getDifficultyFromMastery(masterySkor: number): "easy" | "medium" | "hard" {
  if (masterySkor >= 75) return "hard"
  if (masterySkor >= 40) return "medium"
  return "easy"
}

function estimateDifficulty(materiId: string, masterySkor: number): "easy" | "medium" | "hard" {
  return getDifficultyFromMastery(masterySkor)
}

export async function generateAdaptivePath(siswaId: string): Promise<AdaptivePath> {
  const existingPath = await prisma.learningPath.findFirst({
    where: { siswaId },
    include: { items: { orderBy: { urutan: "asc" } } },
  })

  if (existingPath) {
    const allItems = existingPath.items
    const completed = allItems.filter((i) => i.status === "SELESAI").length
    const progres = allItems.length > 0 ? (completed / allItems.length) * 100 : 0

    const stuckItems = allItems.filter((i) => i.status === "PENDING" && (i as any).failedAttempts > 0)
    const isStuck = stuckItems.length >= 2

    return {
      id: existingPath.id,
      siswaId,
      items: allItems.map((i) => ({
        id: i.id,
        jenis: i.jenis,
        materiId: i.materiId,
        kompetensiId: i.kompetensiId,
        judul: (i as any).materi?.judul || (i as any).kompetensi?.nama || i.jenis,
        difficulty: "medium",
        status: i.status,
        urutan: i.urutan,
        prasyarat: [],
      })),
      progres,
      currentDifficulty: getDifficultyFromMastery(progres),
      isStuck,
      stuckCount: stuckItems.length,
    }
  }

  const penguasaanList = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    include: {
      kompetensi: {
        select: {
          id: true,
          kode: true,
          nama: true,
          mataPelajaranId: true,
          materis: { select: { id: true, judul: true } },
        },
      },
    },
  })

  const prasyaratList = await prisma.kompetensiPrasyarat.findMany({
    select: { kompetensiId: true, prasyaratKompetensiId: true },
  })

  const materiList = await prisma.materi.findMany({
    where: { deletedAt: null },
    include: { mataPelajaran: { select: { nama: true } } },
    orderBy: { createdAt: "asc" },
  })

  const masteryMap = new Map<string, number>()
  for (const p of penguasaanList) {
    masteryMap.set(p.kompetensiId, p.skor)
  }

  const items: PathItem[] = []
  let urutan = 1

  const weakKompetensi = penguasaanList
    .filter((p) => p.skor < 60)
    .sort((a, b) => a.skor - b.skor)

  for (const p of weakKompetensi) {
    const k = p.kompetensi
    const difficulty = getDifficultyFromMastery(p.skor)

    const prasyaratIds = prasyaratList
      .filter((pr) => pr.kompetensiId === k.id)
      .map((pr) => pr.prasyaratKompetensiId)

    const allPrasyaratMet = prasyaratIds.every((pid) => (masteryMap.get(pid) || 0) >= 40)

    if (!allPrasyaratMet) continue

    for (const m of k.materis) {
      items.push({
        id: `gen-${urutan}`,
        jenis: "MATERI_DIBUKA",
        materiId: m.id,
        kompetensiId: k.id,
        judul: m.judul,
        difficulty,
        status: "PENDING",
        urutan,
        prasyarat: prasyaratIds,
      })
      urutan++
    }

    if (k.materis.length > 0) {
      items.push({
        id: `gen-${urutan}`,
        jenis: "LATIHAN_SELESAI",
        materiId: k.materis[0].id,
        kompetensiId: k.id,
        judul: `Latihan: ${k.nama}`,
        difficulty,
        status: "PENDING",
        urutan,
        prasyarat: prasyaratIds,
      })
      urutan++
    }
  }

  const allAvg = penguasaanList.length > 0
    ? penguasaanList.reduce((s, p) => s + p.skor, 0) / penguasaanList.length
    : 0

  if (allAvg >= 60 && materiList.length > 0) {
    const unmasteredMateri = materiList.filter((m) => {
      const k = penguasaanList.find((p) => p.kompetensi.materis.some((km) => km.id === m.id))
      return !k || k.skor < 80
    })

    for (const m of unmasteredMateri.slice(0, 3)) {
      items.push({
        id: `gen-${urutan}`,
        jenis: "MATERI_SELESAI",
        materiId: m.id,
        kompetensiId: null,
        judul: `Review: ${m.judul}`,
        difficulty: "hard",
        status: "PENDING",
        urutan,
        prasyarat: [],
      })
      urutan++
    }
  }

  if (items.length === 0 && materiList.length > 0) {
    for (const m of materiList.slice(0, 5)) {
      items.push({
        id: `gen-${urutan}`,
        jenis: "MATERI_DIBUKA",
        materiId: m.id,
        kompetensiId: null,
        judul: m.judul,
        difficulty: "easy",
        status: "PENDING",
        urutan,
        prasyarat: [],
      })
      urutan++
    }
  }

  const completed = items.filter((i) => i.status === "SELESAI").length
  const progres = items.length > 0 ? (completed / items.length) * 100 : 0

  const newPath = await prisma.learningPath.create({
    data: {
      siswaId,
      progres,
      items: {
        create: items.map((i) => ({
          jenis: i.jenis as any,
          materiId: i.materiId,
          kompetensiId: i.kompetensiId,
          status: i.status as any,
          urutan: i.urutan,
        })),
      },
    },
    include: { items: true },
  })

  return {
    id: newPath.id,
    siswaId,
    items,
    progres,
    currentDifficulty: getDifficultyFromMastery(allAvg),
    isStuck: false,
    stuckCount: 0,
  }
}

export async function getAdaptivePath(siswaId: string): Promise<AdaptivePath> {
  return generateAdaptivePath(siswaId)
}

export async function markPathItemComplete(itemId: string, siswaId: string, success: boolean) {
  const item = await prisma.learningPathItem.findFirst({
    where: { id: itemId, learningPath: { siswaId } },
  })

  if (!item) throw new Error("Item tidak ditemukan")

  if (!success) {
    await prisma.learningPathItem.update({
      where: { id: itemId },
      data: { status: "PENDING" },
    })
    return
  }

  await prisma.learningPathItem.update({
    where: { id: itemId },
    data: { status: "SELESAI" },
  })

  const path = await prisma.learningPath.findFirst({
    where: { siswaId },
    include: { items: true },
  })

  if (path) {
    const completed = path.items.filter((i) => i.status === "SELESAI").length
    const progres = path.items.length > 0 ? (completed / path.items.length) * 100 : 0
    await prisma.learningPath.update({
      where: { id: path.id },
      data: { progres },
    })
  }

  if (item.materiId) {
    const { updatePenguasaanAfterMateri } = await import("./knowledge-tracing")
    await updatePenguasaanAfterMateri(siswaId, item.materiId)
  }
}

export async function getStuckAlternatives(siswaId: string, itemId: string) {
  const item = await prisma.learningPathItem.findFirst({
    where: { id: itemId, learningPath: { siswaId } },
  })

  if (!item || !item.kompetensiId) return []

  const kompetensi = await prisma.kompetensi.findFirst({
    where: { id: item.kompetensiId },
    include: { materis: { select: { id: true, judul: true } } },
  })

  if (!kompetensi) return []

  const alternatives = kompetensi.materis
    .filter((m) => m.id !== item.materiId)
    .map((m) => ({
      materiId: m.id,
      judul: m.judul,
      reason: `Materi alternatif untuk ${kompetensi.nama} — coba pendekatan berbeda`,
    }))

  return alternatives
}
