import { prisma } from "@/lib/prisma"
import { generateContent, geminiEnabled } from "./gemini"

export interface Rekomendasi {
  materiId: string
  judul: string
  mapel: string
  nilaiRata: number | null
  alasan: string
}

export async function runRecommenderAgent(siswaId: string): Promise<{ rekomendasi: Rekomendasi[]; mode: "ai" | "rule" }> {
  const kelompok = await prisma.nilai.groupBy({
    by: ["mataPelajaranId"],
    where: { siswaId, deletedAt: null },
    _avg: { nilai: true },
    _count: { _all: true },
  })

  const rataMapel = new Map<string, { avg: number; count: number }>()
  for (const g of kelompok) {
    rataMapel.set(g.mataPelajaranId, { avg: g._avg.nilai ?? 0, count: g._count._all })
  }

  const weakMapel = [...rataMapel.entries()].filter(([, v]) => v.avg < 75)
  const urutLemah = weakMapel.sort((a, b) => a[1].avg - b[1].avg)

  const mapelIds = urutLemah.map(([id]) => id)

  const materis = await prisma.materi.findMany({
    where: {
      deletedAt: null,
      ...(mapelIds.length ? { mataPelajaranId: { in: mapelIds } } : {}),
    },
    include: { mataPelajaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
    take: mapelIds.length ? 12 : 5,
  })

  const rekomendasi: Rekomendasi[] = materis.slice(0, 5).map((m) => {
    const avg = rataMapel.get(m.mataPelajaranId)?.avg ?? null
    return {
      materiId: m.id,
      judul: m.judul,
      mapel: m.mataPelajaran.nama,
      nilaiRata: avg != null ? Math.round(avg) : null,
      alasan: "",
    }
  })

  let mode: "ai" | "rule" = "rule"
  if (rekomendasi.length > 0 && geminiEnabled()) {
    try {
      const daftar = rekomendasi.map((r) => `- ${r.judul} (${r.mapel})${r.nilaiRata != null ? `, rata-rata nilai kamu ${r.nilaiRata}` : ""}`).join("\n")
      const raw = await generateContent(
        "Kamu adalah Recommender Agent untuk personalisasi pembelajaran. Berikan 1-2 kalimat alasan personal untuk TANPA komentar: materi yang direkomendasikan karena kelemahan siswa. Untuk setiap materi buat format: 'judul materi::alasan singkat' per baris.",
        `Siswa memiliki nilai rendah di mapel berikut. Rekomendasikan materi:\n${daftar}`,
        { temperature: 0.3 }
      )
      const lines = raw.split("\n").filter(Boolean)
      const alasanMap = new Map<string, string>()
      for (const line of lines) {
        const [judul, ...alasan] = line.split("::")
        if (judul) alasanMap.set(judul.trim().toLowerCase(), alasan.join("::").trim())
      }
      for (const r of rekomendasi) {
        r.alasan = alasanMap.get(r.judul.toLowerCase()) || ""
      }
      mode = "ai"
    } catch { mode = "rule" }
  }

  if (mode === "rule") {
    for (const r of rekomendasi) {
      r.alasan =
        r.nilaiRata != null
          ? `Rata-rata nilaimu di ${r.mapel} ${r.nilaiRata} (di bawah 75). Perkuat dengan mempelajari materi ini.`
          : `Materi ${r.mapel} untuk memperluas pemahamanmu.`
    }
  }

  return { rekomendasi, mode }
}
