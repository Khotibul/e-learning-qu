import { prisma } from "@/lib/prisma"
import { generateContent, geminiEnabled } from "./gemini"
import { cosineSimilarity } from "./retrieval"

export interface Rekomendasi {
  materiId: string
  judul: string
  mapel: string
  nilaiRata: number | null
  alasan: string
  skorRelevansi: number
  sumber: string
  tipeRekomendasi: "weak_subject" | "collaborative" | "mastery_gap" | "engagement" | "diverse"
}

function buildStudentVector(data: {
  nilaiPerMapel: Map<string, number>
  penguasaanPerKompetensi: Map<string, number>
  gayaBelajar: string
  engagementScore: number
  learningVelocity: number
}): number[] {
  const nilais = [...data.nilaiPerMapel.values()]
  const penguasaans = [...data.penguasaanPerKompetensi.values()]

  const avgNilai = nilais.length > 0 ? nilais.reduce((s, v) => s + v, 0) / nilais.length / 100 : 0.5
  const avgPenguasaan = penguasaans.length > 0 ? penguasaans.reduce((s, v) => s + v, 0) / penguasaans.length / 100 : 0.5
  const minNilai = nilais.length > 0 ? Math.min(...nilais) / 100 : 0
  const maxGap = nilais.length > 0 ? (Math.max(...nilais) - Math.min(...nilais)) / 100 : 0

  const styleVec = data.gayaBelajar === "VISUAL" ? [1, 0, 0]
    : data.gayaBelajar === "AUDITORY" ? [0, 1, 0]
    : data.gayaBelajar === "KINESTHETIC" ? [0, 0, 1]
    : [0.33, 0.33, 0.34]

  return [
    avgNilai,
    avgPenguasaan,
    minNilai,
    maxGap,
    data.engagementScore,
    data.learningVelocity,
    ...styleVec,
  ]
}

function contentBasedRecommender(
  studentVec: number[],
  materis: {
    id: string
    judul: string
    mapelNama: string
    avgNilai: number | null
    avgPenguasaan: number | null
    hasLatihan: boolean
  }[],
  weakMapelNames: Set<string>
): Rekomendasi[] {
  const results: Rekomendasi[] = []

  for (const m of materis) {
    let score = 0

    if (m.avgNilai != null && m.avgNilai < 75) {
      score += (75 - m.avgNilai) / 75 * 0.4
    }

    if (m.avgPenguasaan != null && m.avgPenguasaan < 60) {
      score += (60 - m.avgPenguasaan) / 60 * 0.3
    }

    // Bandingkan berdasarkan NAMA mapel (bukan ID — bug lama membandingkan
    // set berisi ID dengan nama sehingga boost tidak pernah aktif)
    if (weakMapelNames.has(m.mapelNama)) {
      score += 0.2
    }

    if (!m.hasLatihan) {
      score -= 0.1
    }

    const diversityBonus = Math.random() * 0.05

    results.push({
      materiId: m.id,
      judul: m.judul,
      mapel: m.mapelNama,
      nilaiRata: m.avgNilai,
      alasan: "",
      skorRelevansi: Math.round((score + diversityBonus) * 100) / 100,
      sumber: "content-based",
      tipeRekomendasi: m.avgNilai != null && m.avgNilai < 75 ? "weak_subject" : "mastery_gap",
    })
  }

  return results.sort((a, b) => b.skorRelevansi - a.skorRelevansi)
}

async function collaborativeFiltering(
  siswaId: string,
  materis: { id: string; judul: string; mapelNama: string }[]
): Promise<Rekomendasi[]> {
  const allNilai = await prisma.nilai.groupBy({
    by: ["siswaId", "mataPelajaranId"],
    where: { deletedAt: null },
    _avg: { nilai: true },
  })

  const siswaNilai = new Map<string, number>()
  const siswaVectors: { siswaId: string; vector: Map<string, number> }[] = []

  const grouped = new Map<string, Map<string, number>>()
  for (const n of allNilai) {
    if (!grouped.has(n.siswaId)) grouped.set(n.siswaId, new Map())
    grouped.get(n.siswaId)!.set(n.mataPelajaranId, n._avg.nilai || 0)
  }

  const currentSiswaNilai = grouped.get(siswaId)
  if (!currentSiswaNilai || currentSiswaNilai.size === 0) return []

  const allMapelIds = new Set<string>()
  for (const [, mapel] of grouped) {
    for (const [mid] of mapel) allMapelIds.add(mid)
  }

  const mapelArr = [...allMapelIds]
  const currentVec = mapelArr.map((mid) => currentSiswaNilai.get(mid) || 0)

  const similarities: { siswaId: string; sim: number }[] = []

  for (const [otherId, otherMapel] of grouped) {
    if (otherId === siswaId) continue
    const otherVec = mapelArr.map((mid) => otherMapel.get(mid) || 0)
    const sim = cosineSimilarity(currentVec, otherVec)
    if (sim > 0.3) {
      similarities.push({ siswaId: otherId, sim })
    }
  }

  if (similarities.length === 0) return []

  similarities.sort((a, b) => b.sim - a.sim)
  const topSim = similarities.slice(0, 10)

  const materiRecommendations = new Map<string, { score: number; reasons: string[] }>()

  for (const sim of topSim) {
    const otherNilai = grouped.get(sim.siswaId)
    if (!otherNilai) continue

    for (const [mid, nilai] of otherNilai) {
      if (!currentSiswaNilai.has(mid) || (currentSiswaNilai.get(mid) || 0) < nilai) {
        const existing = materiRecommendations.get(mid) || { score: 0, reasons: [] }
        existing.score += sim.sim * (nilai / 100) * 0.3
        existing.reasons.push(`Siswa serupa (${Math.round(sim.sim * 100)}% similarity) unggul di mapel ini`)
        materiRecommendations.set(mid, existing)
      }
    }
  }

  const results: Rekomendasi[] = []
  for (const [mid, { score, reasons }] of materiRecommendations) {
    const materi = materis.find((m) => m.id === mid)
    if (!materi) continue
    results.push({
      materiId: materi.id,
      judul: materi.judul,
      mapel: materi.mapelNama,
      nilaiRata: null,
      alasan: reasons[0] || "",
      skorRelevansi: Math.round(Math.min(1, score) * 100) / 100,
      sumber: "collaborative",
      tipeRekomendasi: "collaborative",
    })
  }

  return results.sort((a, b) => b.skorRelevansi - a.skorRelevansi)
}

function diversifyRecommendations(recs: Rekomendasi[], maxPerMapel = 2): Rekomendasi[] {
  const mapelCount = new Map<string, number>()
  const diversified: Rekomendasi[] = []

  for (const r of recs) {
    const count = mapelCount.get(r.mapel) || 0
    if (count < maxPerMapel) {
      diversified.push(r)
      mapelCount.set(r.mapel, count + 1)
    }
  }

  if (diversified.length < 5) {
    for (const r of recs) {
      if (!diversified.find((d) => d.materiId === r.materiId)) {
        diversified.push(r)
      }
      if (diversified.length >= 5) break
    }
  }

  return diversified.slice(0, 8)
}

export async function runHybridRecommender(
  siswaId: string,
  opts?: { engagementScore?: number; gayaBelajar?: string; learningVelocity?: number }
): Promise<{ rekomendasi: Rekomendasi[]; mode: "hybrid" | "content" | "collaborative" | "rule" }> {
  const [nilaiPerMapel, penguasaanList, materiList, latihanList] = await Promise.all([
    prisma.nilai.groupBy({
      by: ["mataPelajaranId"],
      where: { siswaId, deletedAt: null },
      _avg: { nilai: true },
    }),
    prisma.penguasaanKompetensi.findMany({
      where: { siswaId },
      include: { kompetensi: { select: { id: true, mataPelajaranId: true } } },
    }),
    prisma.materi.findMany({
      where: { deletedAt: null },
      include: { mataPelajaran: { select: { nama: true } }, latihanAI: { select: { id: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.latihanAI.findMany({
      where: { siswaId },
      select: { materiId: true, skor: true },
    }),
  ])

  const nilaiMap = new Map<string, number>()
  for (const n of nilaiPerMapel) {
    nilaiMap.set(n.mataPelajaranId, n._avg.nilai || 0)
  }

  const penguasaanMap = new Map<string, number>()
  for (const p of penguasaanList) {
    if (p.kompetensi.mataPelajaranId) penguasaanMap.set(p.kompetensi.mataPelajaranId, p.skor)
  }

  const latihanSkorMap = new Map<string, number[]>()
  for (const l of latihanList) {
    if (l.skor != null) {
      const arr = latihanSkorMap.get(l.materiId) || []
      arr.push(l.skor)
      latihanSkorMap.set(l.materiId, arr)
    }
  }

  const weakMapelIds = new Set<string>()
  for (const [mid, avg] of nilaiMap) {
    if (avg < 75) weakMapelIds.add(mid)
  }

  // Konversi ID→nama untuk content-based scorer (fix: set lama berisi ID
  // tetapi dibandingkan dengan nama mapel)
  const weakMapelNames = new Set(
    materiList
      .filter((m) => weakMapelIds.has(m.mataPelajaranId))
      .map((m) => m.mataPelajaran.nama)
  )

  const studentVec = buildStudentVector({
    nilaiPerMapel: nilaiMap,
    penguasaanPerKompetensi: penguasaanMap,
    gayaBelajar: opts?.gayaBelajar || "UNKNOWN",
    engagementScore: opts?.engagementScore ?? 0.5,
    learningVelocity: opts?.learningVelocity ?? 0.5,
  })

  const materiData = materiList.map((m) => ({
    id: m.id,
    judul: m.judul,
    mapelNama: m.mataPelajaran.nama,
    avgNilai: nilaiMap.get(m.mataPelajaranId) || null,
    avgPenguasaan: penguasaanMap.get(m.mataPelajaranId) || null,
    hasLatihan: m.latihanAI.length > 0,
  }))

  const contentResults = contentBasedRecommender(studentVec, materiData, weakMapelNames)

  let collabResults: Rekomendasi[] = []
  try {
    collabResults = await collaborativeFiltering(siswaId, materiList.map((m) => ({
      id: m.id, judul: m.judul, mapelNama: m.mataPelajaran.nama,
    })))
  } catch { /* fallback */ }

  let mode: "hybrid" | "content" | "collaborative" | "rule" = "rule"
  let combined: Rekomendasi[] = []

  if (contentResults.length > 0 && collabResults.length > 0) {
    const merged = new Map<string, Rekomendasi>()
    for (const r of contentResults) {
      merged.set(r.materiId, { ...r, skorRelevansi: r.skorRelevansi * 0.6 })
    }
    for (const r of collabResults) {
      const existing = merged.get(r.materiId)
      if (existing) {
        existing.skorRelevansi = Math.round((existing.skorRelevansi + r.skorRelevansi * 0.4) * 100) / 100
        existing.alasan += ` | ${r.alasan}`
      } else {
        merged.set(r.materiId, { ...r, skorRelevansi: r.skorRelevansi * 0.4 })
      }
    }
    combined = [...merged.values()].sort((a, b) => b.skorRelevansi - a.skorRelevansi)
    mode = "hybrid"
  } else if (contentResults.length > 0) {
    combined = contentResults
    mode = "content"
  } else if (collabResults.length > 0) {
    combined = collabResults
    mode = "collaborative"
  } else {
    combined = materiList.slice(0, 5).map((m) => ({
      materiId: m.id,
      judul: m.judul,
      mapel: m.mataPelajaran.nama,
      nilaiRata: null,
      alasan: `Materi ${m.mataPelajaran.nama} untuk memperluas pemahaman.`,
      skorRelevansi: 0.3,
      sumber: "rule",
      tipeRekomendasi: "diverse" as const,
    }))
    mode = "rule"
  }

  const diversified = diversifyRecommendations(combined)

  if (geminiEnabled() && diversified.length > 0) {
    try {
      const daftar = diversified.slice(0, 5).map((r) =>
        `- ${r.judul} (${r.mapel})${r.nilaiRata != null ? `, rata-rata ${r.nilaiRata}` : ""} [${r.tipeRekomendasi}]`
      ).join("\n")

      const raw = await generateContent(
        "Kamu adalah Recommender AI untuk personalisasi pembelajaran. Berikan alasan personal untuk setiap materi yang direkomendasikan. Format: 'judul::alasan' per baris. Maksimal 2 kalimat per alasan. Fokus pada kelemahan spesifik siswa dan bagaimana materi ini membantu.",
        `Rekomendasi untuk siswa:\n${daftar}`,
        { temperature: 0.3 }
      )

      const lines = raw.split("\n").filter(Boolean)
      const alasanMap = new Map<string, string>()
      for (const line of lines) {
        const [judul, ...alasan] = line.split("::")
        if (judul) alasanMap.set(judul.trim().toLowerCase(), alasan.join("::").trim())
      }
      for (const r of diversified) {
        const aiAlasan = alasanMap.get(r.judul.toLowerCase())
        if (aiAlasan) r.alasan = aiAlasan
      }
    } catch { /* use existing reasons */ }
  }

  if (mode === "rule") {
    for (const r of diversified) {
      r.alasan = r.nilaiRata != null
        ? `Rata-rata nilaimu ${r.nilaiRata} di ${r.mapel} (target: 75). Materi ini akan memperkuat pemahamanmu.`
        : `Materi ${r.mapel} untuk memperluas cakupan belajarmu.`
    }
  }

  return { rekomendasi: diversified, mode }
}
