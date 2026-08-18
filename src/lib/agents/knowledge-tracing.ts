import { prisma } from "@/lib/prisma"

interface MasteryState {
  pMastery: number
  pGuessing: number
  pSlipping: number
  pTransit: number
  attempts: number
  correctCount: number
  lastUpdate: Date
}

const DEFAULT_STATE: MasteryState = {
  pMastery: 0.1,
  pGuessing: 0.2,
  pSlipping: 0.15,
  pTransit: 0.3,
  attempts: 0,
  correctCount: 0,
  lastUpdate: new Date(),
}

function bayesianUpdate(state: MasteryState, correct: boolean): MasteryState {
  const { pMastery, pGuessing, pSlipping, pTransit } = state

  let pCorrectGivenMastery: number
  let pCorrectGivenNotMastery: number

  if (correct) {
    pCorrectGivenMastery = 1 - pSlipping
    pCorrectGivenNotMastery = pGuessing
  } else {
    pCorrectGivenMastery = pSlipping
    pCorrectGivenNotMastery = 1 - pGuessing
  }

  const pCorrect = pCorrectGivenMastery * pMastery + pCorrectGivenNotMastery * (1 - pMastery)
  let newPMastery: number

  if (pCorrect > 0) {
    newPMastery = (pCorrectGivenMastery * pMastery) / pCorrect
  } else {
    newPMastery = pMastery
  }

  newPMastery = newPMastery + (1 - newPMastery) * pTransit * 0.1

  return {
    ...state,
    pMastery: Math.max(0.01, Math.min(0.99, newPMastery)),
    attempts: state.attempts + 1,
    correctCount: state.correctCount + (correct ? 1 : 0),
    lastUpdate: new Date(),
  }
}

function applyForgettingCurve(state: MasteryState, hoursSinceLastUpdate: number): MasteryState {
  const lambda = 0.05
  const forgettingFactor = Math.exp(-lambda * hoursSinceLastUpdate / 24)
  const forgottenMastery = state.pMastery * forgettingFactor
  const retainedMastery = Math.max(0.05, forgottenMastery)

  return {
    ...state,
    pMastery: retainedMastery,
    lastUpdate: new Date(),
  }
}

function masteryToScore(pMastery: number): number {
  return Math.round(pMastery * 100)
}

function scoreToKategori(score: number): string {
  if (score >= 85) return "ADVANCED"
  if (score >= 65) return "PROFICIENT"
  if (score >= 40) return "DEVELOPING"
  if (score >= 20) return "BASIC"
  return "BEGINNER"
}

async function getOrCreatePenguasaan(siswaId: string, kompetensiId: string) {
  let penguasaan = await prisma.penguasaanKompetensi.findFirst({
    where: { siswaId, kompetensiId },
  })

  if (!penguasaan) {
    penguasaan = await prisma.penguasaanKompetensi.create({
      data: {
        siswaId,
        kompetensiId,
        skor: 10,
    jumlahLatihan: 0,
    jumlahSoalBenar: 0,
    jumlahSoalSalah: 0,
      },
    })
  }

  return penguasaan
}

export async function updatePenguasaanAfterUjian(
  siswaId: string,
  ujianId: string,
  jawabanData: { kompetensiId?: string | null; isCorrect: boolean }[]
) {
  const kompetensiScores = new Map<string, { correct: number; total: number }>()

  for (const j of jawabanData) {
    if (!j.kompetensiId) continue
    const existing = kompetensiScores.get(j.kompetensiId) || { correct: 0, total: 0 }
    existing.total++
    if (j.isCorrect) existing.correct++
    kompetensiScores.set(j.kompetensiId, existing)
  }

  for (const [kompetensiId, { correct, total }] of kompetensiScores) {
    const penguasaan = await getOrCreatePenguasaan(siswaId, kompetensiId)
    let state: MasteryState = {
      pMastery: penguasaan.skor / 100,
      pGuessing: DEFAULT_STATE.pGuessing,
      pSlipping: DEFAULT_STATE.pSlipping,
      pTransit: DEFAULT_STATE.pTransit,
      attempts: penguasaan.jumlahLatihan,
      correctCount: penguasaan.jumlahSoalBenar,
      lastUpdate: penguasaan.updatedAt || penguasaan.createdAt,
    }

    const hoursSince = (Date.now() - state.lastUpdate.getTime()) / (1000 * 60 * 60)
    if (hoursSince > 24) {
      state = applyForgettingCurve(state, hoursSince)
    }

    for (let i = 0; i < total; i++) {
      state = bayesianUpdate(state, i < correct)
    }

    const newSkor = masteryToScore(state.pMastery)
    await prisma.penguasaanKompetensi.update({
      where: { id: penguasaan.id },
      data: {
        skor: newSkor,
        jumlahLatihan: state.attempts,
        jumlahSoalBenar: state.correctCount,
      },
    })
  }
}

export async function updatePenguasaanAfterLatihan(
  siswaId: string,
  materiId: string,
  skor: number
) {
  const chunks = await prisma.materiChunk.findMany({
    where: { materiId },
    select: { materiId: true },
  })

  if (chunks.length === 0) return

  const kompetensi = await prisma.kompetensi.findFirst({
    where: { materis: { some: { id: materiId } } },
  })

  if (!kompetensi) return

  const penguasaan = await getOrCreatePenguasaan(siswaId, kompetensi.id)
  let state: MasteryState = {
    pMastery: penguasaan.skor / 100,
    pGuessing: DEFAULT_STATE.pGuessing,
    pSlipping: DEFAULT_STATE.pSlipping,
    pTransit: DEFAULT_STATE.pTransit,
    attempts: penguasaan.jumlahLatihan,
    correctCount: penguasaan.jumlahSoalBenar,
    lastUpdate: penguasaan.updatedAt || penguasaan.createdAt,
  }

  const hoursSince = (Date.now() - state.lastUpdate.getTime()) / (1000 * 60 * 60)
  if (hoursSince > 24) {
    state = applyForgettingCurve(state, hoursSince)
  }

  const correct = skor >= 70
  state = bayesianUpdate(state, correct)

  if (skor >= 80) {
    state = bayesianUpdate(state, true)
  }

  const newSkor = masteryToScore(state.pMastery)
  await prisma.penguasaanKompetensi.update({
    where: { id: penguasaan.id },
    data: {
      skor: newSkor,
      jumlahLatihan: state.attempts,
      jumlahSoalBenar: state.correctCount,
    },
  })
}

export async function updatePenguasaanAfterChat(
  siswaId: string,
  mapelId: string | null
) {
  if (!mapelId) return

  const kompetensiList = await prisma.kompetensi.findMany({
    where: { mataPelajaranId: mapelId },
    take: 3,
  })

  for (const k of kompetensiList) {
    const penguasaan = await getOrCreatePenguasaan(siswaId, k.id)
    const state: MasteryState = {
      pMastery: penguasaan.skor / 100,
      pGuessing: DEFAULT_STATE.pGuessing,
      pSlipping: DEFAULT_STATE.pSlipping,
      pTransit: DEFAULT_STATE.pTransit,
      attempts: penguasaan.jumlahLatihan,
      correctCount: penguasaan.jumlahSoalBenar,
      lastUpdate: penguasaan.updatedAt || penguasaan.createdAt,
    }

    const newPMastery = Math.min(0.99, state.pMastery + 0.02)
    const newSkor = masteryToScore(newPMastery)

    await prisma.penguasaanKompetensi.update({
      where: { id: penguasaan.id },
      data: {
        skor: newSkor,
        jumlahLatihan: state.attempts + 1,
        jumlahSoalBenar: state.correctCount + 1,
      },
    })
  }
}

export async function updatePenguasaanAfterMateri(
  siswaId: string,
  materiId: string
) {
  const kompetensi = await prisma.kompetensi.findFirst({
    where: { materis: { some: { id: materiId } } },
  })

  if (!kompetensi) return

  const penguasaan = await getOrCreatePenguasaan(siswaId, kompetensi.id)

  const newPMastery = Math.min(0.95, penguasaan.skor / 100 + 0.05)
  const newSkor = masteryToScore(newPMastery)

  await prisma.penguasaanKompetensi.update({
    where: { id: penguasaan.id },
    data: {
      skor: newSkor,
      jumlahLatihan: penguasaan.jumlahLatihan + 1,
      jumlahSoalBenar: penguasaan.jumlahSoalBenar + 1,
    },
  })
}

export async function getPenguasaanOverview(siswaId: string) {
  const penguasaanList = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    include: {
      kompetensi: {
        select: { kode: true, nama: true, mataPelajaran: { select: { nama: true } } },
      },
    },
  })

  const distribusi = { ADVANCED: 0, PROFICIENT: 0, DEVELOPING: 0, BASIC: 0, BEGINNER: 0 }
  let totalSkor = 0

  const penguasaan = penguasaanList.map((p) => {
    const skor = p.skor
    const kategori = scoreToKategori(skor)
    distribusi[kategori as keyof typeof distribusi]++
    totalSkor += skor

    const hoursSinceUpdate = (Date.now() - p.updatedAt.getTime()) / (1000 * 60 * 60)
    const projectedMastery = hoursSinceUpdate > 48
      ? Math.max(5, skor * Math.exp(-0.05 * hoursSinceUpdate / 24))
      : skor

    return {
      id: p.id,
      kode: p.kompetensi.kode,
      kompetensi: p.kompetensi.nama,
      mapel: p.kompetensi.mataPelajaran?.nama ?? "",
      skor,
      kategori,
      jumlahLatihan: p.jumlahLatihan,
      jumlahSoalBenar: p.jumlahSoalBenar,
      projectedSkor: Math.round(projectedMastery),
      hoursSinceUpdate: Math.round(hoursSinceUpdate),
    }
  })

  const total = penguasaan.length
  const rataSkor = total > 0 ? Math.round(totalSkor / total) : 0

  return { penguasaan, distribusi, rataSkor, total }
}
