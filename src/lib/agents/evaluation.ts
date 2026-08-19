import { prisma } from "@/lib/prisma"
import { trackPretest, trackPosttest } from "./learning-analytics"

export async function recordPretestPosttest(siswaId: string, ujianId: string, tipe: "PRETEST" | "POSTTEST") {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } })
  if (!ujian) throw new Error("Ujian tidak ditemukan")

  const nilai = await prisma.nilai.findFirst({
    where: { siswaId, ujianId, deletedAt: null },
    select: { nilai: true },
  })
  if (!nilai) throw new Error("Belum ada nilai untuk ujian ini")

  const existing = await prisma.pretestPosttest.findUnique({
    where: { siswaId_ujianId: { siswaId, ujianId } },
  })

  if (tipe === "PRETEST") {
    if (existing) {
      const result = await prisma.pretestPosttest.update({
        where: { id: existing.id },
        data: { pretestNilai: nilai.nilai },
      })
      trackPretest(siswaId, undefined, ujian.mataPelajaranId ?? undefined, { ujianId, skor: nilai.nilai }).catch(() => {})
      return result
    }
    const result = await prisma.pretestPosttest.create({
      data: {
        siswaId,
        ujianId,
        mataPelajaranId: ujian.mataPelajaranId,
        tipe: "PRETEST",
        pretestNilai: nilai.nilai,
      },
    })
    trackPretest(siswaId, undefined, ujian.mataPelajaranId ?? undefined, { ujianId, skor: nilai.nilai }).catch(() => {})
    return result
  } else {
    let record = existing
    if (!record) {
      record = await prisma.pretestPosttest.create({
        data: {
          siswaId,
          ujianId,
          mataPelajaranId: ujian.mataPelajaranId,
          tipe: "POSTTEST",
        },
      })
    }

    const pretest = record.pretestNilai ?? 0
    const posttest = nilai.nilai
    const maxPossible = 100
    const nGain = maxPossible - pretest > 0
      ? Math.round(((posttest - pretest) / (maxPossible - pretest)) * 100) / 100
      : 0

    return prisma.pretestPosttest.update({
      where: { id: record.id },
      data: {
        posttestNilai: posttest,
        nGain,
        tipe: "POSTTEST",
      },
    }).then((result) => {
      trackPosttest(siswaId, undefined, ujian.mataPelajaranId ?? undefined, { ujianId, pretest, posttest, nGain }).catch(() => {})
      return result
    })
  }
}

export async function getNGainForMapel(mataPelajaranId: string) {
  const data = await prisma.pretestPosttest.findMany({
    where: { mataPelajaranId, pretestNilai: { not: null }, posttestNilai: { not: null } },
    include: { siswa: { select: { nama: true } } },
  })

  if (data.length === 0) return { average: 0, efektivitas: "Belum ada data", detail: [] }

  const gains = data.map((d) => {
    const pre = d.pretestNilai ?? 0
    const post = d.posttestNilai ?? 0
    const maxPossible = 100
    const gain = maxPossible - pre > 0 ? (post - pre) / (maxPossible - pre) : 0
    return {
      siswa: d.siswa.nama,
      pretest: pre,
      posttest: post,
      nGain: Math.round(gain * 100) / 100,
    }
  })

  const avgGain = gains.reduce((s, g) => s + g.nGain, 0) / gains.length
  const efektivitas = avgGain >= 0.7 ? "Efektif" : avgGain >= 0.4 ? "Cukup Efektif" : "Kurang Efektif"

  return {
    average: Math.round(avgGain * 100) / 100,
    efektivitas,
    detail: gains,
  }
}

export async function submitSUSSurvey(siswaId: string, jawaban: number[], komentar?: string) {
  if (jawaban.length !== 10) throw new Error("SUS harus 10 pertanyaan")
  const oddCorrected = [1, 3, 5, 7, 9].map((i) => (jawaban[i] || 0) - 1)
  const evenCorrected = [2, 4, 6, 8].map((i) => 5 - (jawaban[i] || 0))
  const rawScore = oddCorrected.reduce((a, b) => a + b, 0) + evenCorrected.reduce((a, b) => a + b, 0)
  const skor = rawScore * 2.5

  return prisma.sUSResponse.create({
    data: {
      siswaId,
      skor,
      jawaban: jawaban as any,
      komentar: komentar || null,
    },
  })
}

export async function getSUSResults() {
  const results = await prisma.sUSResponse.findMany({
    include: { siswa: { select: { nama: true, kelas: { select: { nama: true } } } } },
    orderBy: { createdAt: "desc" },
  })

  if (results.length === 0) {
    return { average: 0, total: 0, distribusi: { excellent: 0, good: 0, ok: 0, poor: 0, terrible: 0 }, results: [] }
  }

  const distribusi = { excellent: 0, good: 0, ok: 0, poor: 0, terrible: 0 }
  for (const r of results) {
    if (r.skor >= 80) distribusi.excellent++
    else if (r.skor >= 68) distribusi.good++
    else if (r.skor >= 50) distribusi.ok++
    else if (r.skor >= 25) distribusi.poor++
    else distribusi.terrible++
  }

  return {
    average: Math.round(results.reduce((s, r) => s + r.skor, 0) / results.length),
    total: results.length,
    distribusi,
    results: results.map((r) => ({
      id: r.id,
      siswa: r.siswa?.nama ?? "-",
      kelas: r.siswa?.kelas?.nama ?? "-",
      skor: r.skor,
      komentar: r.komentar,
      tanggal: r.createdAt,
    })),
  }
}

export async function recordAIEvaluation(data: {
  siswaId?: string
  tipe: string
  metrik: string
  skor: number
  detail?: any
  periode?: string
}) {
  return prisma.aIEvaluation.create({ data })
}

export async function getAIEvaluationSummary(periode?: string) {
  const where: any = {}
  if (periode) where.periode = periode

  const evaluations = await prisma.aIEvaluation.findMany({ where, orderBy: { createdAt: "desc" } })

  const byMetrik = new Map<string, number[]>()
  for (const e of evaluations) {
    if (!byMetrik.has(e.metrik)) byMetrik.set(e.metrik, [])
    byMetrik.get(e.metrik)!.push(e.skor)
  }

  const summary = [...byMetrik.entries()].map(([metrik, skors]) => ({
    metrik,
    rataRata: Math.round(skors.reduce((a, b) => a + b, 0) / skors.length),
    total: skors.length,
    min: Math.min(...skors),
    max: Math.max(...skors),
  }))

  return { summary, total: evaluations.length }
}
