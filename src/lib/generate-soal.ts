import { z } from "zod"

export const MAKS_UKURAN_MATERI = 10 * 1024 * 1024 // 10 MB

export const soalAiSchema = z.object({
  soal: z.array(
    z.object({
      pertanyaan: z.string().min(1),
      jenisSoal: z.enum(["PILIHAN_GANDA", "ESSAY", "TRUE_FALSE", "ISIAN_SINGKAT", "MATCHING"]).default("PILIHAN_GANDA"),
      tingkatKesulitan: z.enum(["MUDAH", "SEDANG", "SULIT"]).optional(),
      pilihanGanda: z.array(z.object({ label: z.string(), text: z.string() })).optional(),
      trueFalse: z.boolean().optional(),
      jawaban: z.string().default(""),
      pembahasan: z.string().optional(),
      poin: z.number().int().positive().optional(),
    }),
  ),
})

export type SoalAi = z.infer<typeof soalAiSchema>
export type SoalAiItem = SoalAi["soal"][number]

export interface MateriInput {
  nama?: string
  teks?: string
  inline?: { mimeType: string; data: string }
}

const MIME_GAMBAR = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])
const MIME_DOKUMEN = new Set(["application/pdf"])
const MIME_TEKS = new Set(["text/plain", "text/markdown", "text/csv", "application/json", "text/html"])

function tebakMime(nama: string): string {
  const n = nama.toLowerCase()
  if (n.endsWith(".pdf")) return "application/pdf"
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg"
  if (n.endsWith(".png")) return "image/png"
  if (n.endsWith(".webp")) return "image/webp"
  if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic"
  if (n.endsWith(".txt") || n.endsWith(".md")) return "text/plain"
  if (n.endsWith(".csv")) return "text/csv"
  if (n.endsWith(".json")) return "application/json"
  return "application/octet-stream"
}

export async function ekstrakMateri(file: File): Promise<MateriInput> {
  if (!file || file.size === 0) throw new Error("File materi kosong")
  if (file.size > MAKS_UKURAN_MATERI) throw new Error("Ukuran file melebihi 10 MB")
  const mime = file.type || tebakMime(file.name)
  if (MIME_GAMBAR.has(mime)) {
    const buf = Buffer.from(await file.arrayBuffer())
    return { nama: file.name, inline: { mimeType: mime, data: buf.toString("base64") } }
  }
  if (MIME_DOKUMEN.has(mime)) {
    const buf = Buffer.from(await file.arrayBuffer())
    return { nama: file.name, inline: { mimeType: "application/pdf", data: buf.toString("base64") } }
  }
  if (MIME_TEKS.has(mime) || /\.(txt|md|csv|json)$/i.test(file.name)) {
    const teks = await file.text()
    if (!teks.trim()) throw new Error("File teks kosong")
    return { nama: file.name, teks: teks.slice(0, 60000) }
  }
  throw new Error("Format file belum didukung. Unggah foto (JPG/PNG/WebP), PDF, atau teks (.txt/.md/.csv).")
}

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    soal: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          pertanyaan: { type: "STRING" },
          jenisSoal: { type: "STRING", enum: ["PILIHAN_GANDA", "ESSAY", "TRUE_FALSE", "ISIAN_SINGKAT", "MATCHING"] },
          tingkatKesulitan: { type: "STRING", enum: ["MUDAH", "SEDANG", "SULIT"] },
          pilihanGanda: {
            type: "ARRAY",
            nullable: true,
            items: {
              type: "OBJECT",
              properties: { label: { type: "STRING" }, text: { type: "STRING" } },
              required: ["label", "text"],
            },
          },
          trueFalse: { type: "BOOLEAN", nullable: true },
          jawaban: { type: "STRING" },
          pembahasan: { type: "STRING", nullable: true },
          poin: { type: "INTEGER", nullable: true },
        },
        required: ["pertanyaan", "jenisSoal", "jawaban"],
      },
    },
  },
  required: ["soal"],
}

function labelJenis(jenis: string): string {
  switch (jenis) {
    case "PILIHAN_GANDA":
      return "Pilihan Ganda"
    case "ESSAY":
      return "Essay"
    case "TRUE_FALSE":
      return "Benar/Salah"
    case "ISIAN_SINGKAT":
      return "Isian Singkat"
    case "MATCHING":
      return "Menjodohkan"
    default:
      return "Campuran (Pilihan Ganda, Essay, Benar/Salah, Isian Singkat)"
  }
}

function labelTingkat(t: string): string {
  switch (t) {
    case "MUDAH":
      return "Mudah"
    case "SEDANG":
      return "Sedang"
    case "SULIT":
      return "Sulit"
    default:
      return "Campur (Mudah/Sedang/Sulit)"
  }
}

export interface GenerateSoalInput {
  topik?: string
  materi?: MateriInput | null
  jumlah: number
  jenisSoal: string
  tingkatKesulitan: string
  poin: number
}

export async function generateSoalDariMateri(input: GenerateSoalInput): Promise<SoalAi> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY belum diatur. Buat API key di Google AI Studio (https://aistudio.google.com/apikey) lalu simpan di env GOOGLE_API_KEY.")
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
  const jumlah = Math.min(20, Math.max(1, input.jumlah))

  const prompt = [
    "Anda adalah pembuat soal ujian untuk sekolah (guru profesional).",
    "Buat soal berdasarkan materi/topik yang diberikan, dalam Bahasa Indonesia.",
    `Jumlah soal: ${jumlah}.`,
    `Jenis soal: ${labelJenis(input.jenisSoal)}.`,
    `Tingkat kesulitan: ${labelTingkat(input.tingkatKesulitan)}.`,
    `Poin per soal: ${input.poin}.`,
    input.topik ? `Topik tambahan: ${input.topik}.` : "",
    "Aturan:",
    "- Untuk Pilihan Ganda beri tepat 4 opsi (label A-D) dan kunci (label).",
    "- Untuk Benar/Salah beri jawaban 'Benar' atau 'Salah'.",
    "- Untuk Isian Singkat beri kunci singkat.",
    "- Untuk Essay beri pembahasan/kunci jawaban.",
    "- Setiap soal beri pembahasan singkat.",
    "- Pertanyaan jelas, tidak ambigu, sesuai materi.",
    "- Kembalikan HANYA JSON valid sesuai skema, tanpa markdown atau teks lain.",
  ].filter(Boolean).join("\n")

  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (input.materi?.teks) parts.push({ text: `MATERI:\n${input.materi.teks}` })
  if (input.materi?.inline) {
    parts.push({ inlineData: { mimeType: input.materi.inline.mimeType, data: input.materi.inline.data } })
  }
  if (!input.materi && !input.topik) throw new Error("Topik atau materi wajib diisi")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if ((e as Error)?.name === "AbortError") throw new Error("Waktu generate habis. Coba kurangi jumlah soal atau ukuran file.")
    throw new Error("Gagal menghubungi layanan AI. Periksa koneksi internet.")
  }
  clearTimeout(timer)

  if (!res.ok) {
    let detail = ""
    try { detail = await res.text() } catch {}
    if (res.status === 400) throw new Error("Permintaan tidak valid. Periksa file/topik yang diunggah.")
    if (res.status === 401 || res.status === 403) throw new Error("API key AI tidak valid atau tidak punya akses. Periksa env GOOGLE_API_KEY.")
    if (res.status === 429) throw new Error("Kuota AI habis / terlalu banyak permintaan. Coba lagi nanti.")
    if (res.status === 503) throw new Error("Layanan AI sedang sibuk. Coba lagi sebentar.")
    throw new Error(`Layanan AI error (${res.status}). ${detail.slice(0, 200)}`)
  }

  const data = await res.json()
  const candidate = data?.candidates?.[0]
  if (!candidate) throw new Error("AI tidak mengembalikan hasil. Coba lagi.")
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Generate dihentikan: ${candidate.finishReason}. Coba ubah materi.`)
  }
  const text = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") || ""
  if (!text.trim()) throw new Error("AI mengembalikan jawaban kosong. Coba lagi.")

  let parsed: unknown
  try { parsed = JSON.parse(text) } catch {
    throw new Error("AI tidak mengembalikan JSON valid. Coba lagi.")
  }
  const validated = soalAiSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error("Struktur soal dari AI tidak sesuai. Coba lagi.")
  }
  if (validated.data.soal.length === 0) throw new Error("AI tidak menghasilkan soal. Coba ubah materi/topik.")
  return validated.data
}
