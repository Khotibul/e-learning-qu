import { prisma } from "@/lib/prisma"
import { generateContent, geminiEnabled } from "./gemini"

export interface Explanation {
  type: "recommendation" | "mastery" | "warning" | "learning_style"
  summary: string
  factors: { factor: string; weight: number; impact: "positive" | "negative" | "neutral"; value: any }[]
  counterfactuals: { scenario: string; outcome: string }[]
  confidence: number
  rawEvidence: any
}

function confidenceFromFactors(factors: Explanation["factors"]): number {
  if (factors.length === 0) return 0.1
  const totalWeight = factors.reduce((s, f) => s + Math.abs(f.weight), 0)
  if (totalWeight === 0) return 0.2
  const topFactorWeight = Math.max(...factors.map((f) => Math.abs(f.weight)))
  return Math.min(0.95, 0.3 + (topFactorWeight / totalWeight) * 0.5 + factors.length * 0.03)
}

export async function explainRecommendation(siswaId: string, materiId: string): Promise<Explanation> {
  const [materi, penguasaanList, nilaiHistory, profile] = await Promise.all([
    prisma.materi.findFirst({ where: { id: materiId }, include: { mataPelajaran: { select: { nama: true } } } }),
    prisma.penguasaanKompetensi.findMany({ where: { siswaId }, include: { kompetensi: { select: { nama: true, mataPelajaranId: true } } } }),
    prisma.nilai.findMany({ where: { siswaId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10, select: { nilai: true, mataPelajaran: { select: { nama: true } } } }),
    prisma.studentProfile.findFirst({ where: { siswaId } }),
  ])

  if (!materi) return { type: "recommendation", summary: "Materi tidak ditemukan.", factors: [], counterfactuals: [], confidence: 0, rawEvidence: null }

  const factors: Explanation["factors"] = []
  const nilaiMapel = nilaiHistory.filter((n) => n.mataPelajaran.nama === materi.mataPelajaran.nama).map((n) => n.nilai)
  const avgMapel = nilaiMapel.length > 0 ? nilaiMapel.reduce((s, v) => s + v, 0) / nilaiMapel.length : null

  if (avgMapel != null && avgMapel < 75) {
    factors.push({ factor: `Nilai rata-rata ${materi.mataPelajaran.nama}`, weight: 0.4, impact: "negative", value: `${Math.round(avgMapel)}/100 (target: 75)` })
  }

  const penguasaanMapel = penguasaanList.filter((p) => p.kompetensi.mataPelajaranId === materi.mataPelajaranId).map((p) => ({ nama: p.kompetensi.nama, skor: p.skor }))
  const lowMastery = penguasaanMapel.filter((p) => p.skor < 40)
  if (lowMastery.length > 0) {
    factors.push({ factor: `Penguasaan lemah (${lowMastery.length} kompetensi)`, weight: 0.35, impact: "negative", value: lowMastery.map((p) => `${p.nama}: ${p.skor}%`).join(", ") })
  }

  if (profile) {
    if (profile.engagementScore < 0.3) factors.push({ factor: "Engagement rendah", weight: 0.15, impact: "negative", value: `${Math.round(profile.engagementScore * 100)}%` })
  }

  if (factors.length === 0) {
    factors.push({ factor: "Materi untuk pemahaman menyeluruh", weight: 0.5, impact: "neutral", value: "Penguasaan sudah baik" })
  }

  const counterfactuals = [
    { scenario: `Jika nilai ${materi.mataPelajaran.nama} naik ke 75`, outcome: `Materi ini akan dianggap tidak mendesak.` },
    { scenario: "Jika semua kompetensi dasar dikuasai (>60)", outcome: "Sistem akan merekomendasikan materi lanjut." },
  ]

  let summary = `Materi "${materi.judul}" (${materi.mataPelajaran.nama}) direkomendasikan karena: ${factors.map((f) => f.factor.toLowerCase()).join("; ")}.`

  if (geminiEnabled()) {
    try {
      const factorText = factors.map((f) => `- ${f.factor}: ${f.value}`).join("\n")
      summary = await generateContent("Jelaskan mengapa materi ini direkomendasikan. Maks 3 kalimat.", `Materi: ${materi.judul}\nFaktor:\n${factorText}`, { temperature: 0.3 })
    } catch { /* use default */ }
  }

  return { type: "recommendation", summary, factors, counterfactuals, confidence: confidenceFromFactors(factors), rawEvidence: { avgMapel, lowMastery } }
}

export async function explainMastery(siswaId: string, kompetensiId: string): Promise<Explanation> {
  const penguasaan = await prisma.penguasaanKompetensi.findFirst({
    where: { siswaId, kompetensiId },
    include: { kompetensi: { select: { nama: true, kode: true } } },
  })

  if (!penguasaan) return { type: "mastery", summary: "Belum ada data penguasaan.", factors: [], counterfactuals: [], confidence: 0, rawEvidence: null }

  const skor = penguasaan.skor
  const akurasi = penguasaan.jumlahLatihan > 0 ? Math.round((penguasaan.jumlahSoalBenar / penguasaan.jumlahLatihan) * 100) : 0

  const factors: Explanation["factors"] = [
    { factor: "Skor Bayesian penguasaan", weight: 0.4, impact: skor >= 60 ? "positive" : "negative", value: `${skor}%` },
    { factor: "Jumlah latihan", weight: 0.2, impact: penguasaan.jumlahLatihan >= 5 ? "positive" : "negative", value: `${penguasaan.jumlahLatihan} kali` },
    { factor: "Akurasi latihan", weight: 0.25, impact: akurasi >= 70 ? "positive" : "negative", value: `${akurasi}%` },
  ]

  const counterfactuals = [
    { scenario: "Jika mengerjakan 3 latihan lagi dengan skor >80", outcome: `Skor diprediksi naik ke ${Math.min(95, skor + 15)}%` },
    { scenario: "Jika tidak ada latihan selama 2 minggu", outcome: `Skor akan turun (~${Math.round(skor * 0.85)}%) karena forgetting curve` },
  ]

  const level = skor >= 85 ? "Mastery" : skor >= 65 ? "Proficient" : skor >= 40 ? "Developing" : skor >= 20 ? "Basic" : "Beginner"
  let summary = `Penguasaan "${penguasaan.kompetensi.nama}" ${skor}% (${level}). Akurasi latihan: ${akurasi}%, ${penguasaan.jumlahLatihan} latihan.`

  if (geminiEnabled()) {
    try {
      const factorText = factors.map((f) => `- ${f.factor}: ${f.value}`).join("\n")
      summary = await generateContent("Jelaskan penguasaan siswa dan langkah selanjutnya. Maks 3 kalimat.", `Kompetensi: ${penguasaan.kompetensi.nama}\nSkor: ${skor}%\nFaktor:\n${factorText}`, { temperature: 0.3 })
    } catch { /* use default */ }
  }

  return { type: "mastery", summary, factors, counterfactuals, confidence: confidenceFromFactors(factors), rawEvidence: { skor, akurasi, jumlahLatihan: penguasaan.jumlahLatihan } }
}

export async function explainEarlyWarning(siswaId: string, warningId: string): Promise<Explanation> {
  const warning = await prisma.earlyWarning.findFirst({ where: { id: warningId, siswaId } })
  if (!warning) return { type: "warning", summary: "Peringatan tidak ditemukan.", factors: [], counterfactuals: [], confidence: 0, rawEvidence: null }

  const factors: Explanation["factors"] = [
    { factor: "Tipe peringatan", weight: 0.4, impact: "negative", value: warning.tipe },
    { factor: "Tingkat keparahan", weight: 0.35, impact: "negative", value: warning.severity },
    { factor: "Skor risiko", weight: 0.25, impact: "negative", value: `${warning.skor || 0}` },
  ]

  const counterfactuals = [
    { scenario: "Jika siswa aktif kembali dalam 3 hari", outcome: "Peringatan INAKTIF akan otomatis resolve" },
    { scenario: "Jika nilai ujian berikutnya >75", outcome: "Peringatan NILAI_DROP akan resolve" },
  ]

  let summary = `Peringatan ${warning.severity}: ${warning.message}`

  if (geminiEnabled()) {
    try {
      summary = await generateContent("Jelaskan peringatan ini dan saran tindakan. Maks 3 kalimat.", `Tipe: ${warning.tipe}\nSeverity: ${warning.severity}\nPesan: ${warning.message}\nDetail: ${JSON.stringify(warning.detail)}`, { temperature: 0.3 })
    } catch { /* use default */ }
  }

  return { type: "warning", summary, factors, counterfactuals, confidence: confidenceFromFactors(factors), rawEvidence: warning.detail }
}
