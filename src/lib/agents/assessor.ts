import { generateContent, geminiEnabled } from "./gemini"

export interface SoalAI {
  tanya: string
  jawaban: string
  kunci: string
  difficulty: "easy" | "medium" | "hard"
  tipe: "short_answer" | "essay" | "conceptual"
  hints: string[]
}

export interface HasilPenilaian {
  skor: number
  umpanBalik: string
  perSoal: { tanya: string; benar: boolean; umpan: string; skorPartial: number }[]
  masteryDelta: number
  levelTercapai: string
}

function sanitizeText(s: string) {
  return s.toLowerCase().replace(/[.,;:!?()"'\-–—]/g, "").replace(/\s+/g, " ").trim()
}

function semanticSimilarity(a: string, b: string): number {
  const tokensA = new Set(sanitizeText(a).split(" "))
  const tokensB = sanitizeText(b).split(" ")
  if (tokensB.length === 0) return 0

  let hits = 0
  for (const w of tokensB) {
    if (tokensA.has(w)) {
      hits++
    } else {
      for (const ta of tokensA) {
        if (ta.length > 3 && w.length > 3 && (ta.includes(w) || w.includes(ta))) {
          hits += 0.7
          break
        }
      }
    }
  }

  const jaccard = hits / (tokensA.size + tokensB.length - hits)
  const coverage = hits / tokensB.length
  return jaccard * 0.4 + coverage * 0.6
}

function getAdaptiveDifficulty(history: { skor: number }[]): "easy" | "medium" | "hard" {
  if (history.length === 0) return "easy"
  const recent = history.slice(-3)
  const avg = recent.reduce((s, h) => s + h.skor, 0) / recent.length
  if (avg >= 80) return "hard"
  if (avg >= 50) return "medium"
  return "easy"
}

export async function generateQuiz(
  chunks: string[],
  opts?: {
    difficulty?: "easy" | "medium" | "hard"
    history?: { skor: number }[]
    count?: number
    learningStyle?: string
  }
): Promise<SoalAI[]> {
  const materiText = chunks.join("\n\n")
  if (materiText.trim().length === 0) throw new Error("Tidak ada konten materi untuk latihan")

  const difficulty = opts?.difficulty || getAdaptiveDifficulty(opts?.history || [])
  const count = opts?.count || 5
  const learningStyle = opts?.learningStyle || "UNKNOWN"

  const styleHint = learningStyle === "VISUAL" ? "Buat soal yang menguji pemahaman visual, pemetaan konsep, dan perbandingan."
    : learningStyle === "KINESTHETIC" ? "Buat soal praktis yang menguji aplikasi langkah demi langkah."
    : learningStyle === "AUDITORI" ? "Buat soal yang menguji kemampuan menjelaskan dengan kata-kata sendiri."
    : "Campuran soal konseptual dan aplikatif."

  const difficultyHint = difficulty === "easy"
    ? "Level mudah: definisi, identifikasi konsep dasar, pengertian."
    : difficulty === "medium"
    ? "Level menengah: penerapan konsep, analisis sederhana, pemecahan masalah terstruktur."
    : "Level sulit: analisis kritis, sintesis ide, evaluasi, pemecahan masalah terbuka."

  if (geminiEnabled()) {
    const prompt = `Buatkan ${count} soal latihan pemahaman dari materi berikut.

${difficultyHint}
${styleHint}

ATURAN:
1. Soal harus bermakna (bukan hafalan), menguji pemahaman konsep
2. Variasikan tipe: short_answer (isian singkat), essay (uraian singkat), conceptual (penjelasan konsep)
3. Berikan hints (petunjuk ringkas) untuk setiap soal
4. Kunci jawaban harus komprehensif tapi fleksibel (bukan exact match)

Format JSON array, setiap item:
{
  "tanya": "pertanyaan",
  "jawaban": "contoh jawaban ideal",
  "kunci": "kata/frasa kunci yang harus ada dalam jawaban",
  "difficulty": "easy|medium|hard",
  "tipe": "short_answer|essay|conceptual",
  "hints": ["petunjuk 1", "petunjuk 2"]
}

HANYA keluarkan JSON array, tanpa teks lain.

Materi:
${materiText.slice(0, 12000)}`

    const raw = await generateContent("Kamu adalah Assessor AI Expert yang membuat soal berkualitas tinggi. Soal harus menguji pemahaman, bukan hafalan.", prompt, { temperature: 0.7 })
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return parsed.slice(0, count).map((q: any) => ({
            tanya: String(q.tanya || ""),
            jawaban: String(q.jawaban || ""),
            kunci: String(q.kunci || ""),
            difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : difficulty,
            tipe: ["short_answer", "essay", "conceptual"].includes(q.tipe) ? q.tipe : "short_answer",
            hints: Array.isArray(q.hints) ? q.hints.map(String) : [],
          })).filter((q: SoalAI) => q.tanya && q.kunci)
        }
      } catch { /* fallback */ }
    }
  }

  // Rule-based fallback
  const kalimat = materiText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300)

  const difficultyFilter = difficulty === "easy"
    ? kalimat.filter((s) => s.length < 150)
    : difficulty === "hard"
    ? kalimat.filter((s) => s.length > 100)
    : kalimat

  const picked = (difficultyFilter.length > 0 ? difficultyFilter : kalimat).slice(0, count)

  return picked.map((s, i) => ({
    tanya: difficulty === "easy"
      ? `Apa definisi dari konsep berikut: "${s.slice(0, 120)}${s.length > 120 ? "…" : ""}"?`
      : difficulty === "hard"
      ? `Jelaskan kritik atau kelebihan dari: "${s.slice(0, 120)}${s.length > 120 ? "…" : ""}"`
      : `Jelaskan dengan kata-kata sendiri: ${s.slice(0, 180)}${s.length > 180 ? "…" : ""}`,
    jawaban: s,
    kunci: s.split(" ").filter((w) => w.length > 4).slice(0, 5).join(" "),
    difficulty: difficulty,
    tipe: difficulty === "easy" ? "short_answer" : difficulty === "hard" ? "conceptual" : "essay",
    hints: [`Perhatikan bagian: "${s.slice(0, 60)}..."`, "Gunakan kosakata dari materi"],
  }))
}

export async function gradeQuiz(
  soal: SoalAI[],
  jawabanSiswa: Record<number, string>,
  opts?: { adaptive?: boolean }
): Promise<HasilPenilaian> {
  const perSoal: HasilPenilaian["perSoal"] = []
  let benar = 0
  let totalPartial = 0

  if (geminiEnabled()) {
    const prompt = soal
      .map((s, i) => `[Soal ${i + 1}] Tanya: ${s.tanya}\nKunci: ${s.kunci}\nContoh jawaban ideal: ${s.jawaban}\nTipe: ${s.tipe}\nDifficulty: ${s.difficulty}\nJawaban siswa: "${jawabanSiswa[i] || "(kosong)"}"`)
      .join("\n\n")

    const raw = await generateContent(
      `Kamu adalah Assessor AI Expert. Nilai jawaban siswa dengan KETAT tapi ADIL.

PENILAIAN:
- Benar (skorPartial: 1.0): jawaban lengkap dan akurat
- Sebagian benar (skorPartial: 0.3-0.7): ada benar tapi kurang lengkap/akurat
- Salah (skorPartial: 0): tidak sesuai atau kosong

Keluarkan JSON array: [{"benar": true/false, "umpan": "penjelasan singkat + saran perbaikan", "skorPartial": 0.0-1.0}]

HANYA JSON, tanpa teks lain.`,
      prompt,
      { temperature: 0.2, cache: false }
    )

    const match = raw?.match(/\[[\s\S]*\]/)
    if (raw && match) {
      try {
        const hasil = JSON.parse(match[0])
        soal.forEach((s, i) => {
          const h = hasil[i] || { benar: false, umpan: "", skorPartial: 0 }
          const partial = Math.max(0, Math.min(1, Number(h.skorPartial) || 0))
          const isBenar = !!h.benar || partial >= 0.7
          if (isBenar) benar++
          totalPartial += partial
          perSoal.push({
            tanya: s.tanya,
            benar: isBenar,
            umpan: String(h.umpan || ""),
            skorPartial: Math.round(partial * 100) / 100,
          })
        })
      } catch { /* fallback */ }
    }
  }

  // Fallback: semantic similarity grading
  if (perSoal.length === 0) {
    soal.forEach((s, i) => {
      const jawaban = jawabanSiswa[i] || ""
      if (!jawaban.trim()) {
        perSoal.push({ tanya: s.tanya, benar: false, umpan: "Jawaban kosong.", skorPartial: 0 })
        return
      }
      const sim = semanticSimilarity(jawaban, s.kunci + " " + s.jawaban)
      const isBenar = sim >= 0.4
      const partial = Math.min(1, sim * 1.2)
      if (isBenar) benar++
      totalPartial += partial
      perSoal.push({
        tanya: s.tanya,
        benar: isBenar,
        umpan: isBenar
          ? "Jawaban sudah sesuai dengan konsep kunci."
          : `Kata kunci yang perlu ada: ${s.kunci.slice(0, 150)}. Coba jelaskan dengan lebih lengkap.`,
        skorPartial: Math.round(partial * 100) / 100,
      })
    })
  }

  const rawSkor = soal.length ? totalPartial / soal.length : 0
  const skor = Math.round(rawSkor * 100)
  const masteryDelta = skor >= 80 ? 5 : skor >= 60 ? 3 : skor >= 40 ? 1 : -2

  let levelTercapai = ""
  if (skor >= 90) levelTercapai = "Mastery tinggi! Kamu siap ke materi lebih lanjut."
  else if (skor >= 75) levelTercapai = "Penguasaan baik. Sedikit penguasaan lagi dan kamu mastery."
  else if (skor >= 50) levelTercapai = "Penguasaan cukup. Ulangi latihan untuk memperkuat."
  else if (skor >= 30) levelTercapai = "Perlu belajar ulang. Fokus ke konsep dasar."
  else levelTercapai = "Perlu bimbingan intensif. Baca materi dari awal dan minta bantuan guru."

  const umpanBalik = `Skor: ${skor}/100 (Level: ${levelTercapai})\n` +
    `Benar: ${benar}/${soal.length}\n` +
    (skor >= 75
      ? "Lanjutkan ke materi berikutnya atau coba soal level lebih sulit!"
      : skor >= 50
      ? "Cukup baik! Ulangi soal yang salah dan pelajari bagian yang belum jelas."
      : "Jangan menyerah! Baca kembali materi, lalu coba latihan ini lagi.")

  return { skor, umpanBalik, perSoal, masteryDelta, levelTercapai }
}

export async function generateAdaptiveQuiz(
  chunks: string[],
  history: { skor: number; materiId: string }[],
  opts?: { learningStyle?: string; count?: number }
): Promise<SoalAI[]> {
  return generateQuiz(chunks, {
    history,
    learningStyle: opts?.learningStyle,
    count: opts?.count || 5,
  })
}
