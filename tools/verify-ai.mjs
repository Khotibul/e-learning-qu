// ============================================================
// VERIFY-AI: Uji end-to-end LLM + RAG tanpa perlu jalankan Next.js
//
// Pemakaian:
//   node tools/verify-ai.mjs             → cek status + uji retrieval + uji tutor
//   node tools/verify-ai.mjs --embed     → + hitung embedding utk semua materi (butuh API key)
//   node tools/verify-ai.mjs --ask "pertanyaan"  → uji satu pertanyaan ke tutor pipeline
// ============================================================
import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

import { pathToFileURL } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

// ── load .env manual ──
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

// ── kompilasi gemini.ts & retrieval.ts (nol dependency) ──
const tmp = path.join(root, "tmp-verify")
if (!fs.existsSync(tmp)) {
  fs.mkdirSync(tmp, { recursive: true })
  execSync(
    `npx tsc src/lib/agents/gemini.ts src/lib/agents/retrieval.ts --outDir "${tmp}" --module esnext --target es2020 --moduleResolution bundler --skipLibCheck`,
    { cwd: root, stdio: "pipe" }
  )
}
const { generateContent, embedText, geminiEnabled } = await import(pathToFileURL(path.join(tmp, "gemini.js")).href)
const { retrieveHybrid } = await import(pathToFileURL(path.join(tmp, "retrieval.js")).href)

const { PrismaClient } = await import(pathToFileURL(path.join(root, "node_modules", "@prisma", "client", "index.js")).href)
const prisma = new PrismaClient()

function hr() { console.log("\n" + "─".repeat(58)) }

try {
  hr(); console.log("1) STATUS PROVIDER")
  const keyOk = geminiEnabled()
  console.log(`   GOOGLE_GEMINI_API_KEY : ${keyOk ? "TERSEDIA ✓" : "KOSONG ✗  (isi di .env lalu restart)"}`)

  let llmLive = false
  if (keyOk) {
    try {
      const pong = await generateContent("Balas satu kata saja.", "Sebutkan angka 2 + 2?", { cache: false })
      console.log(`   Tes LLM live          : "${pong.slice(0, 40)}" ✓`)
      llmLive = true
    } catch (e) {
      console.log(`   Tes LLM live          : GAGAL ✗ — ${String(e.message).slice(0, 120)}`)
    }
  }

  // ── optional: hitung embedding semua materi ──
  if (process.argv.includes("--embed")) {
    hr(); console.log("2) REINDEX EMBEDDING")
    if (!llmLive) { console.log("   Dilewati — API key belum aktif.") }
    else {
      const materis = await prisma.materi.findMany({ where: { deletedAt: null }, select: { id: true, judul: true, konten: true, deskripsi: true, mataPelajaranId: true } })
      for (const m of materis) {
        const teks = [m.judul, m.deskripsi, m.konten].filter(Boolean).join("\n\n").trim()
        if (!teks) { console.log(`   SKIP (kosong): ${m.judul}`); continue }
        // chunk sederhana 900 char sama seperti chunker
        const bagian = []
        for (let i = 0; i < teks.length; i += 750) bagian.push(teks.slice(i, i + 900))
        await prisma.materiChunk.deleteMany({ where: { materiId: m.id } })
        let ok = 0
        for (let i = 0; i < bagian.length; i++) {
          try {
            const emb = await embedText(bagian[i], { taskType: "RETRIEVAL_DOCUMENT" })
            await prisma.materiChunk.create({ data: { index: i, text: bagian[i], tokenCount: Math.ceil(bagian[i].length / 4), embedding: emb, materiId: m.id, mataPelajaranId: m.mataPelajaranId } })
            ok++
          } catch (e) { console.log(`   Embed gagal (${m.judul} #${i}): ${String(e.message).slice(0, 80)}`) }
        }
        console.log(`   ✓ ${m.judul}: ${ok}/${bagian.length} chunk ter-embed`)
      }
    }
  }

  hr(); console.log("3) KONDISI KNOWLEDGE BASE")
  const chunks = await prisma.materiChunk.findMany({
    include: { materi: { select: { judul: true, mataPelajaran: { select: { nama: true } } } } },
  })
  const withEmb = chunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0).length
  console.log(`   Chunk total           : ${chunks.length}`)
  console.log(`   Chunk ber-embedding   : ${withEmb}/${chunks.length} ${withEmb === chunks.length && chunks.length > 0 ? "(semantic siap ✓)" : withEmb === 0 ? "(jalur keyword saja — jalankan --embed setelah key aktif)" : "(parsial — jalankan --embed)"}`)

  hr(); console.log("4) UJI TUTOR END-TO-END")
  const pertanyaanIdx = process.argv.indexOf("--ask")
  const pertanyaan = pertanyaanIdx > -1 && process.argv[pertanyaanIdx + 1]
    ? process.argv[pertanyaanIdx + 1]
    : "apa itu keamanan jaringan?"

  console.log(`   Pertanyaan            : "${pertanyaan}"`)
  let qEmb = null
  if (llmLive && withEmb > 0) {
    try { qEmb = await embedText(pertanyaan) } catch {}
  }
  const hasil = retrieveHybrid(chunks, pertanyaan, qEmb, 5, 0.6)

  const MIN_RELEVANCE = 0.12
  if (hasil.length === 0 || hasil[0].skor < MIN_RELEVANCE) {
    console.log("   Hasil                 : TIDAK ADA KONTEN RELEVAN → respons terkendali (jujur), bukan jawaban ngawur ✓")
  } else {
    const konteks = hasil.map((h, i) =>
      `[S${i + 1}] (${h.chunk.materi.mataPelajaran.nama} - ${h.chunk.materi.judul})\n${h.chunk.text}`
    ).join("\n\n---\n\n")
    console.log(`   Retrieval             : ${hasil.length} chunk, top skor ${(hasil[0].skor * 100).toFixed(0)}%`)
    for (const h of hasil.slice(0, 3)) {
      console.log(`     • [${(h.skor * 100).toFixed(0)}%] ${h.chunk.materi.judul}`)
    }
    if (!llmLive) {
      console.log("\n   ⚠ Mode TANPA LLM: konteks ditemukan, tapi sintesis jawaban butuh GOOGLE_GEMINI_API_KEY.")
      console.log("   Konteks yang AKAN diberikan ke LLM (potongan):")
      console.log("   " + konteks.slice(0, 200).replace(/\n/g, "\n   ") + "…")
    } else {
      const system = `Kamu Tutor AI. Jawab Bahasa Indonesia HANYA dari konteks materi ([S1],[S2],..). Jika konteks tak memuat jawaban, katakan jujur.`
      const t0 = Date.now()
      const jawaban = await generateContent(system, `Konteks materi:\n${konteks}\n\nPertanyaan siswa:\n${pertanyaan}`, { temperature: 0.4 })
      console.log(`   Jawaban LLM (${Date.now() - t0}ms):\n`)
      console.log("   " + jawaban.slice(0, 600).replace(/\n/g, "\n   "))
    }
  }

  hr()
  console.log("RINGKASAN:")
  console.log(`   • LLM       : ${llmLive ? "AKTIF" : keyOk ? "KEY ADA TAPI GAGAL (cek nilai key)" : "BELUM AKTIF — isi GOOGLE_GEMINI_API_KEY di .env"}`)
  console.log(`   • Semantic  : ${withEmb > 0 ? "SIAP" : "BELUM — jalankan: node tools/verify-ai.mjs --embed"}`)
  console.log(`   • Keyword   : SELALU AKTIF (BM25 + sinonim)`)
  console.log(`   • Gate      : skor < 12% → respons jujur \"tidak ditemukan\"`)
} finally {
  await prisma.$disconnect()
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
}
