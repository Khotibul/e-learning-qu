import { prisma } from "@/lib/prisma"
import { generateContent, geminiEnabled } from "./gemini"

export interface HybridRekomendasi {
  materiId: string
  judul: string
  mapel: string
  nilaiRata: number | null
  alasan: string
  sumber: "content" | "collaborative" | "hybrid"
  skor: number
}

export async function runHybridRecommender(siswaId: string): Promise<{ rekomendasi: HybridRekomendasi[]; mode: string }> {
  const [kelompok, allSiswa, profile] = await Promise.all([
    prisma.nilai.groupBy({
      by: ["mataPelajaranId"],
      where: { siswaId, deletedAt: null },
      _avg: { nilai: true },
      _count: { _all: true },
    }),
    prisma.nilai.groupBy({
      by: ["siswaId", "mataPelajaranId"],
      where: { deletedAt: null },
      _avg: { nilai: true },
    }),
    prisma.studentProfile.findUnique({ where: { siswaId } }),
  ])

  const rataMapel = new Map<string, { avg: number; count: number }>()
  for (const g of kelompok) {
    rataMapel.set(g.mataPelajaranId, { avg: g._avg.nilai ?? 0, count: g._count._all })
  }

  const weakMapel = [...rataMapel.entries()].filter(([, v]) => v.avg < 75)
  const urutLemah = weakMapel.sort((a, b) => a[1].avg - b[1].avg)
  const mapelIds = urutLemah.map(([id]) => id)

  const contentRecs: HybridRekomendasi[] = []
  if (mapelIds.length > 0) {
    const materis = await prisma.materi.findMany({
      where: { deletedAt: null, mataPelajaranId: { in: mapelIds } },
      include: { mataPelajaran: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    for (const m of materis) {
      const avg = rataMapel.get(m.mataPelajaranId)?.avg ?? null
      contentRecs.push({
        materiId: m.id,
        judul: m.judul,
        mapel: m.mataPelajaran.nama,
        nilaiRata: avg != null ? Math.round(avg) : null,
        alasan: "",
        sumber: "content",
        skor: avg != null ? (100 - avg) / 100 : 0.5,
      })
    }
  }

  const siswaScores = new Map<string, Map<string, number>>()
  for (const ns of allSiswa) {
    if (!siswaScores.has(ns.siswaId)) siswaScores.set(ns.siswaId, new Map())
    siswaScores.get(ns.siswaId)!.set(ns.mataPelajaranId, ns._avg.nilai ?? 0)
  }

  const myScores = siswaScores.get(siswaId)
  if (!myScores) return { rekomendasi: contentRecs.slice(0, 5), mode: "content-only" }

  const collaborativeRecs: HybridRekomendasi[] = []
  const similarSiswas: { id: string; similarity: number }[] = []

  for (const [otherId, otherScores] of siswaScores) {
    if (otherId === siswaId) continue
    let dotProduct = 0, normA = 0, normB = 0
    let common = 0
    for (const [mapId, scoreA] of myScores) {
      const scoreB = otherScores.get(mapId)
      if (scoreB !== undefined) {
        dotProduct += scoreA * scoreB
        normA += scoreA * scoreA
        normB += scoreB * scoreB
        common++
      }
    }
    if (common >= 2) {
      const sim = normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
      if (sim > 0.3) similarSiswas.push({ id: otherId, similarity: sim })
    }
  }

  similarSiswas.sort((a, b) => b.similarity - a.similarity)
  const topK = similarSiswas.slice(0, 10)

  const recommendedBySimilar = new Map<string, number>()
  for (const sim of topK) {
    const simScores = siswaScores.get(sim.id)!
    for (const [mapId, score] of simScores) {
      if (!myScores.has(mapId) && score >= 80) {
        recommendedBySimilar.set(mapId, (recommendedBySimilar.get(mapId) ?? 0) + sim.similarity)
      }
    }
  }

  if (recommendedBySimilar.size > 0) {
    const sortedMapIds = [...recommendedBySimilar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const mapIds = sortedMapIds.map(([id]) => id)
    const materis = await prisma.materi.findMany({
      where: { deletedAt: null, mataPelajaranId: { in: mapIds } },
      include: { mataPelajaran: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    })
    for (const m of materis) {
      collaborativeRecs.push({
        materiId: m.id,
        judul: m.judul,
        mapel: m.mataPelajaran.nama,
        nilaiRata: null,
        alasan: "",
        sumber: "collaborative",
        skor: (recommendedBySimilar.get(m.mataPelajaranId) ?? 0) / topK.length,
      })
    }
  }

  const mergedMap = new Map<string, HybridRekomendasi>()
  for (const r of [...contentRecs, ...collaborativeRecs]) {
    const existing = mergedMap.get(r.materiId)
    if (existing) {
      existing.skor = Math.max(existing.skor, r.skor)
      existing.sumber = "hybrid"
    } else {
      mergedMap.set(r.materiId, { ...r })
    }
  }

  const sorted = [...mergedMap.values()].sort((a, b) => b.skor - a.skor).slice(0, 5)

  let mode = "content-only"
  if (collaborativeRecs.length > 0 && contentRecs.length > 0) mode = "hybrid"
  else if (collaborativeRecs.length > 0) mode = "collaborative"

  if (sorted.length > 0 && geminiEnabled()) {
    try {
      const daftar = sorted
        .map((r) => `- ${r.judul} (${r.mapel})${r.nilaiRata != null ? `, nilai rata ${r.nilaiRata}` : ""}, sumber: ${r.sumber}`)
        .join("\n")
      const styleHint = profile?.gayaBelajar ? `Gaya belajar siswa: ${profile.gayaBelajar}.` : ""
      const raw = await generateContent(
        `Kamu adalah Recommender Agent untuk personalisasi pembelajaran. Berikan alasan personal untuk setiap materi. Format per baris: 'judul materi::alasan singkat'. Tanpa komentar lain. ${styleHint}`,
        `Rekomendasi hybrid (content+collaborative):\n${daftar}`,
        { temperature: 0.3 }
      )
      const alasanMap = new Map<string, string>()
      for (const line of raw.split("\n").filter(Boolean)) {
        const [judul, ...alasan] = line.split("::")
        if (judul) alasanMap.set(judul.trim().toLowerCase(), alasan.join("::").trim())
      }
      for (const r of sorted) {
        r.alasan = alasanMap.get(r.judul.toLowerCase()) || ""
      }
    } catch { /* keep empty alasan */ }
  }

  if (!sorted.some((r) => r.alasan)) {
    for (const r of sorted) {
      if (r.alasan) continue
      r.alasan = r.sumber === "collaborative"
        ? `Siswa dengan pola belajar mirip berhasil menguasai materi ini.`
        : r.nilaiRata != null
          ? `Rata-rata nilaimu di ${r.mapel} ${r.nilaiRata} (di bawah 75). Perkuat dengan materi ini.`
          : `Materi ${r.mapel} untuk memperluas pemahamanmu.`
    }
  }

  return { rekomendasi: sorted, mode }
}
