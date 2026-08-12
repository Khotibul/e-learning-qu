import { generateContent, geminiEnabled } from "./gemini"

export interface SoalAI {
  tanya: string
  jawaban: string
  kunci: string
}

export interface HasilPenilaian {
  skor: number
  umpanBalik: string
  perSoal: { tanya: string; benar: boolean; umpan: string }[]
}

function sanitizeText(s: string) {
  return s.toLowerCase().replace(/[.,;:!?()"']/g, "").replace(/\s+/g, " ").trim()
}

function kunciCocok(jawabanSiswa: string, kunci: string): boolean {
  const a = sanitizeText(jawabanSiswa)
  const k = sanitizeText(kunci)
  if (!a || !k) return false
  const kataKunci = k.split(" ").filter((w) => w.length > 3)
  if (!kataKunci.length) return a.includes(k)
  const cocok = kataKunci.filter((w) => a.includes(w)).length
  return cocok / kataKunci.length >= 0.6
}

export async function generateQuiz(chunks: string[]): Promise<SoalAI[]> {
  const materiText = chunks.join("\n\n")
  if (materiText.trim().length === 0) throw new Error("Tidak ada konten materi untuk latihan")

  if (geminiEnabled()) {
    const prompt = `Buatkan 5 soal latihan pemahaman (isian singkat/uraian pendek) dari materi berikut.
Format JSON array, setiap item: {"tanya": "...", "jawaban": "contoh jawaban siswa", "kunci": "kata kunci jawaban yang benar"}.
Hanya keluarkan JSON, tanpa teks lain.\n\nMateri:\n${materiText.slice(0, 12000)}`
    const raw = await generateContent("Kamu adalah Assessor Agent yang membuat soal latihan.", prompt, { temperature: 0.7 })
    const match = raw.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : raw)
    if (!Array.isArray(parsed)) throw new Error("Format soal tidak valid")
    return parsed.slice(0, 5).map((q: any) => ({
      tanya: String(q.tanya || ""),
      jawaban: String(q.jawaban || ""),
      kunci: String(q.kunci || ""),
    })).filter((q: SoalAI) => q.tanya && q.kunci)
  }

  const kalimat = materiText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300)
  const picked = kalimat.slice(0, 5)
  return picked.map((s) => ({
    tanya: `Jelaskan dengan kata-kata sendiri: ${s.slice(0, 180)}${s.length > 180 ? "…" : ""}`,
    jawaban: s,
    kunci: s,
  }))
}

export async function gradeQuiz(soal: SoalAI[], jawabanSiswa: Record<number, string>): Promise<HasilPenilaian> {
  const perSoal: HasilPenilaian["perSoal"] = []
  let benar = 0

  if (geminiEnabled()) {
    const prompt = soal
      .map((s, i) => `${i + 1}. Tanya: ${s.tanya}\nKunci: ${s.kunci}\nJawaban siswa: ${jawabanSiswa[i] || "-"}`)
      .join("\n\n")
    const raw = await generateContent(
      "Kamu adalah Assessor Agent. Nilai tiap jawaban siswa terhadap kunci. Keluarkan JSON array: [{\"benar\": true/false, \"umpan\": \"penjelasan singkat\"}]. Hanya JSON.",
      prompt,
      { temperature: 0.2 }
    ).catch(() => null)
    const match = raw?.match(/\[[\s\S]*\]/)
    if (raw && match) {
      try {
        const hasil = JSON.parse(match[0])
        soal.forEach((s, i) => {
          const h = hasil[i] || { benar: false, umpan: "" }
          if (h.benar) benar++
          perSoal.push({ tanya: s.tanya, benar: !!h.benar, umpan: String(h.umpan || "") })
        })
      } catch { /* fallback ke rule */ }
    }
  }

  if (perSoal.length === 0) {
    soal.forEach((s, i) => {
      const ok = kunciCocok(jawabanSiswa[i] || "", s.kunci)
      if (ok) benar++
      perSoal.push({
        tanya: s.tanya,
        benar: ok,
        umpan: ok ? "Jawaban sesuai kunci." : `Kunci: ${s.kunci.slice(0, 150)}`,
      })
    })
  }

  const skor = soal.length ? Math.round((benar / soal.length) * 100) : 0
  const umpanBalik =
    skor >= 80
      ? `Bagus sekali! Kamu menguasai ${skor}% materi ini. Lanjutkan ke materi berikutnya.`
      : skor >= 60
        ? `Cukup baik (${skor}%). Pelajari ulang bagian yang belum dikuasai, lalu coba lagi.`
        : `Skor kamu ${skor}%. Sebaiknya baca kembali materinya, lalu kerjakan latihan ini lagi.`

  return { skor, umpanBalik, perSoal }
}
