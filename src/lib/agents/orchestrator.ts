export type AgentIntent = "tutor" | "assessor" | "recommender"

export function detectIntent(query: string): AgentIntent {
  const t = query.toLowerCase()
  if (/(latihan|kuis|quiz|buatkan soal|buat soal|soal latihan|latihan dari|kerjakan latihan)/.test(t)) return "assessor"
  if (/(rekomendasi|rekomendasi materi|belajar apa|saran belajar|materi apa yang|sebaiknya saya belajar)/.test(t)) return "recommender"
  return "tutor"
}

export function extractMateriMention(query: string, materis: { id: string; judul: string }[]): string | null {
  const t = query.toLowerCase()
  for (const m of materis) {
    if (m.judul && t.includes(m.judul.toLowerCase())) return m.id
  }
  return null
}
