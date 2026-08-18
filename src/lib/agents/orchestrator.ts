export type AgentIntent = "tutor" | "assessor" | "recommender" | "adaptive" | "mastery" | "analytics" | "warning" | "explain"

export function detectIntent(query: string): AgentIntent {
  const t = query.toLowerCase()
  if (/(latihan|kuis|quiz|buatkan soal|buat soal|soal latihan|latihan dari|kerjakan latihan|ujian)/.test(t)) return "assessor"
  if (/(rekomendasi|rekomendasi materi|belajar apa|saran belajar|materi apa yang|sebaiknya saya belajar|apa yang harus)/.test(t)) return "recommender"
  if (/(jalur belajar|learning path|atur jalur|susun jalur|adaptive|path belajar|rencana belajar)/.test(t)) return "adaptive"
  if (/(penguasaan|kompetensi|mastery|seberapa kuat|kuasai|skor mastery|level belajar)/.test(t)) return "mastery"
  if (/(analitik|statistik|statistik siswa|grafik|analytics|data belajar|ringkasan belajar)/.test(t)) return "analytics"
  if (/(peringatan|warning|at risk|bermasalah|tidak aktif|nilai turun|motivasi rendah|early warning)/.test(t)) return "warning"
  if (/(kenapa.*direkomendasikan|penjelasan|alasan|explain|kenapa.*dipilih|bagaimana.*keputusan)/.test(t)) return "explain"
  return "tutor"
}

export function extractMateriMention(query: string, materis: { id: string; judul: string }[]): string | null {
  const t = query.toLowerCase()
  for (const m of materis) {
    if (m.judul && t.includes(m.judul.toLowerCase())) return m.id
  }
  return null
}
