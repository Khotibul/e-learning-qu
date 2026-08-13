import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")
  const format = (searchParams.get("format") || "excel").toLowerCase()

  try {
    switch (type) {
      case "guru":
        return await exportGuru(format)
      case "murid":
        return await exportMurid(format)
      case "nilai":
        return await exportNilai(format, searchParams.get("ujianId"))
      case "soal":
        return await exportSoal(format, searchParams.get("guruId"))
      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}

interface Row {
  [key: string]: string | number | null | undefined
}

interface Section {
  title: string
  headers: string[]
  rows: Row[]
  colWidths?: number[]
}

function escPdf(s: string): string {
  let out = ""
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c === 40) out += "\\("
    else if (c === 41) out += "\\)"
    else if (c === 92) out += "\\\\"
    else if ((c > 31 && c < 127) || c > 160) out += ch
    else out += "?"
  }
  return out
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

function toPdf(docTitle: string, sections: Section[]): Buffer {
  const W = 842
  const H = 595
  const ML = 40
  const MR = 40
  const MT = 60
  const MB = 50
  const rowH = 22
  const headerH = 24
  const usableW = W - ML - MR
  const dateStr = new Date().toLocaleString("id-ID")
  const dw = Buffer.byteLength(escPdf(dateStr), "binary")
  const perPage = Math.max(1, Math.floor((H - MT - MB - headerH - 20) / rowH))

  const pages: { label: string; headers: string[]; rows: Row[]; colWidths: number[] }[] = []
  for (const sec of sections) {
    const colWidths = sec.colWidths?.length === sec.headers.length
      ? sec.colWidths
      : sec.headers.map(() => 100 / sec.headers.length)
    const chunks: Row[][] = []
    for (let i = 0; i < sec.rows.length; i += perPage) chunks.push(sec.rows.slice(i, i + perPage))
    if (chunks.length === 0) chunks.push([])
    for (const chunk of chunks) {
      pages.push({ label: sec.title, headers: sec.headers, rows: chunk, colWidths })
    }
  }

  const objs: string[] = []
  const nPages = pages.length
  for (let pi = 0; pi < nPages; pi++) {
    const { label, headers, rows, colWidths } = pages[pi]
    const totW = colWidths.reduce((a, b) => a + b, 0)
    const colX: number[] = []
    let cur = ML
    for (let i = 0; i < headers.length; i++) {
      colX.push(cur)
      cur += (colWidths[i] / totW) * usableW
    }

    let s = "BT /F1 14 Tf 1 0 0 1 " + ML + " 560 Tm (" + escPdf(docTitle) + ") Tj ET\n"
    s += "BT /F1 8 Tf 1 0 0 1 " + (W - MR - dw) + " 565 Tm (" + escPdf(dateStr) + ") Tj ET\n"
    s += "1 0 0 1 40 " + 555 + " cm 762 0.5 re f\n"
    if (label) {
      s += "BT /F2 10 Tf 1 0 0 1 " + ML + " 542 Tm (" + trunc(escPdf(label), 90) + ") Tj ET\n"
    }

    const contentY = H - MT - headerH - 20
    const headerY = 522
    s += "BT /F2 9 Tf\n"
    for (let i = 0; i < headers.length; i++) {
      const x = colX[i]
      const w = ((colWidths[i] / totW) * usableW) - 6
      s += "1 0 0 1 " + x + " " + headerY + " Tm (" + trunc(escPdf(headers[i]), 60) + ") Tj ET\n"
      s += "0 0 0 rg 1 0 0 1 " + x + " " + (headerY - 10) + " m " + (x + w) + " " + (headerY - 10) + " l S\n"
      s += "BT /F2 9 Tf\n"
    }
    s += "ET\n"

    let y = contentY
    for (const r of rows) {
      s += "BT /F1 9 Tf\n"
      for (let i = 0; i < headers.length; i++) {
        const x = colX[i]
        const w = ((colWidths[i] / totW) * usableW) - 6
        let cell = String(r[headers[i]] ?? "")
        if (cell.length > 0) cell = trunc(escPdf(cell), Math.floor(w / 4.6))
        s += "1 0 0 1 " + x + " " + y + " Tm (" + cell + ") Tj ET\n"
        s += "BT /F1 9 Tf\n"
      }
      s += "ET\n"
      y -= rowH
    }

    const content = s
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${3 + nPages * 2} 0 R /F2 ${4 + nPages * 2} 0 R >> >> /Contents ${4 + pi * 2} 0 R >>`
    )
    objs.push(`<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`)
  }

  const fontH = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
  const fontB = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  const allObjs: string[] = []
  allObjs.push(`<< /Type /Catalog /Pages 2 0 R >>`)
  const kidsRefs = Array.from({ length: nPages }, (_, i) => `${3 + i * 2} 0 R`).join(" ")
  allObjs.push(`<< /Type /Pages /Kids [${kidsRefs}] /Count ${nPages} >>`)
  for (const o of objs) allObjs.push(o)
  allObjs.push(fontH)
  allObjs.push(fontB)

  for (let i = 0; i < allObjs.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "binary"))
    pdf += `${i + 1} 0 obj\n${allObjs[i]}\nendobj\n`
  }

  const xrefStart = Buffer.byteLength(pdf, "binary")
  pdf += `xref\n0 ${allObjs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) {
    pdf += String(off).padStart(10, "0") + " 00000 n \n"
  }
  pdf += `trailer\n<< /Size ${allObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return Buffer.from(pdf, "binary")
}

function toExcel(docTitle: string, sections: Section[]): Buffer {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const maxCols = Math.max(...sections.map((sec) => sec.headers.length), 1)
  const tr = (cells: string[], bold = false, bg = "") =>
    `<tr>${cells.map((c) => `<td ${bold ? `style="font-weight:bold;background-color:${bg || "#f1f5f9"}"` : ""}>${esc(c)}</td>`).join("")}</tr>`

  const parts: string[] = [
    `<tr><td colspan="${maxCols}" style="font-weight:bold;font-size:14px">${esc(docTitle)}</td></tr>`,
  ]
  for (const sec of sections) {
    parts.push(`<tr><td colspan="${sec.headers.length}" style="font-weight:bold;background-color:#e2e8f0">${esc(sec.title)}</td></tr>`)
    parts.push(tr(sec.headers.map(String), true))
    for (const r of sec.rows) parts.push(tr(sec.headers.map((h) => String(r[h] ?? ""))))
    parts.push(`<tr><td colspan="${sec.headers.length}">&nbsp;</td></tr>`)
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(docTitle)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1">${parts.join("")}</table></body></html>`

  return Buffer.from("\ufeff" + html, "utf8")
}

function toCsv(headers: string[], rows: Row[]): string {
  const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`
  return [headers.map((h) => q(h)).join(","), ...rows.map((r) => headers.map((h) => q(String(r[h] ?? ""))).join(","))].join("\r\n")
}

function respond(data: Buffer | string, format: string, filename: string): NextResponse {
  if (format === "csv") {
    return new NextResponse(data as string, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}.csv`,
      },
    })
  }
  const body = new Uint8Array(new Uint8Array(data as Buffer))
  if (format === "pdf") {
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}.pdf`,
      },
    })
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename=${filename}.xls`,
    },
  })
}

async function exportGuru(format: string) {
  const data = await prisma.guru.findMany({
    where: { deletedAt: null },
    orderBy: { nama: "asc" },
    select: { nip: true, nuptk: true, nama: true, noTelp: true, createdAt: true },
  })

  const headers = ["NIP", "NUPTK", "Nama", "No Telp", "Terdaftar"]
  const rows: Row[] = data.map((g) => ({
    NIP: g.nip || "-",
    NUPTK: g.nuptk || "-",
    Nama: g.nama,
    "No Telp": g.noTelp || "-",
    Terdaftar: g.createdAt.toLocaleDateString("id-ID"),
  }))

  const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xls"
  const out = format === "pdf"
    ? toPdf("Data Guru", [{ title: "", headers, rows, colWidths: [20, 20, 30, 15, 15] }])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Data Guru", [{ title: "", headers, rows }])

  return respond(out, format, `guru_${new Date().toISOString().split("T")[0]}.${ext}`)
}

async function exportMurid(format: string) {
  const data = await prisma.siswa.findMany({
    where: { deletedAt: null },
    orderBy: { nama: "asc" },
    include: { kelas: { select: { nama: true } } },
  })

  const headers = ["NIS", "NISN", "Nama", "Kelas", "No Telp"]
  const rows: Row[] = data.map((s) => ({
    NIS: s.nis || "-",
    NISN: s.nisn || "-",
    Nama: s.nama,
    Kelas: s.kelas?.nama || "-",
    "No Telp": s.noTelp || "-",
  }))

  const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xls"
  const out = format === "pdf"
    ? toPdf("Data Murid", [{ title: "", headers, rows, colWidths: [15, 15, 30, 20, 20] }])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Data Murid", [{ title: "", headers, rows }])

  return respond(out, format, `murid_${new Date().toISOString().split("T")[0]}.${ext}`)
}

async function exportNilai(format: string, ujianId: string | null) {
  if (!ujianId) {
    return NextResponse.json({ error: "ujianId required" }, { status: 400 })
  }

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      nama: true,
      isLatihan: true,
      nilaiMinimum: true,
      mataPelajaran: { select: { nama: true } },
      kelas: { select: { nama: true } },
    },
  })

  const jawabans = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    orderBy: [{ siswa: { nama: "asc" } }, { createdAt: "asc" }],
    include: {
      siswa: { select: { id: true, nama: true, nis: true } },
      soal: { select: { id: true, jenisSoal: true, pertanyaan: true, poin: true, jawaban: true } },
      penilaianEssay: { select: { nilai: true, komentar: true } },
    },
  })

  const nilaiRecords = await prisma.nilai.findMany({
    where: { ujianId, deletedAt: null },
    select: { siswaId: true, nilai: true },
  })
  const nilaiMap: Record<string, number> = Object.fromEntries(nilaiRecords.map((n) => [n.siswaId, n.nilai]))

  const grouped: Record<string, { nama: string; nis: string | null; jawabans: typeof jawabans }> = {}
  for (const j of jawabans) {
    if (!grouped[j.siswa.id]) {
      grouped[j.siswa.id] = { nama: j.siswa.nama, nis: j.siswa.nis, jawabans: [] }
    }
    grouped[j.siswa.id].jawabans.push(j)
  }

  const rekapHeaders = ["No", "Nama", "NIS", "Nilai", "PG Benar", "Essay Dinilai", "Status"]
  const rekapRows: Row[] = Object.entries(grouped)
    .sort(([aid], [bid]) => (nilaiMap[bid] ?? -1) - (nilaiMap[aid] ?? -1))
    .map(([sid, g], idx) => {
      const auto = g.jawabans.filter((j) => j.soal.jenisSoal !== "ESSAY")
      const essay = g.jawabans.filter((j) => j.soal.jenisSoal === "ESSAY")
      const correct = auto.filter((j) => j.isCorrect === true).length
      const essayGraded = essay.filter((j) => j.penilaianEssay?.nilai != null).length
      const finalScore = nilaiMap[sid]
      const nMin = ujian?.nilaiMinimum ?? 0
      return {
        "No": idx + 1,
        "Nama": g.nama,
        "NIS": g.nis || "-",
        "Nilai": finalScore !== undefined ? finalScore : "-",
        "PG Benar": auto.length > 0 ? `${correct}/${auto.length}` : "-",
        "Essay Dinilai": essay.length > 0 ? `${essayGraded}/${essay.length}` : "-",
        "Status": finalScore === undefined ? "-" : finalScore >= nMin ? "LULUS" : "TL",
      }
    })

  const detailHeaders = ["No", "NIS", "Nama", "Jenis", "Soal", "Jawaban Siswa", "Kunci", "Benar", "Poin"]
  const detailRows: Row[] = jawabans.map((j, idx) => {
    const isEssay = j.soal.jenisSoal === "ESSAY"
    return {
      "No": idx + 1,
      "NIS": j.siswa.nis || "-",
      "Nama": j.siswa.nama,
      "Jenis": isEssay ? "Essay" : "PG",
      "Soal": j.soal.pertanyaan,
      "Jawaban Siswa": isEssay ? (j.esaiJawaban || "-") : (j.jawaban || "-"),
      "Kunci": isEssay ? (j.penilaianEssay ? `${j.penilaianEssay.nilai}` : "") : j.soal.jawaban,
      "Benar": isEssay ? (j.penilaianEssay?.nilai != null ? "Dinilai" : "-") : j.isCorrect === true ? "Ya" : j.isCorrect === false ? "Tidak" : "-",
      "Poin": j.poin ?? (j.penilaianEssay?.nilai ?? ""),
    }
  })

  const jenis = ujian?.isLatihan ? "Latihan" : "Ujian"
  const title = `Nilai ${jenis}: ${ujian?.nama || "Tanpa judul"}${ujian?.mataPelajaran?.nama ? ` (${ujian.mataPelajaran.nama})` : ""}`

  const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xls"
  let out: Buffer | string
  if (format === "pdf") {
    out = toPdf(title, [
      { title: "Rekap Nilai", headers: rekapHeaders, rows: rekapRows, colWidths: [4, 22, 10, 8, 10, 12, 8] },
      { title: "Detail Jawaban", headers: detailHeaders, rows: detailRows, colWidths: [4, 8, 14, 6, 20, 18, 8, 6, 5] },
    ])
  } else if (format === "csv") {
    out = toCsv(detailHeaders, detailRows)
  } else {
    out = toExcel(title, [
      { title: "Rekap Nilai", headers: rekapHeaders, rows: rekapRows },
      { title: "Detail Jawaban", headers: detailHeaders, rows: detailRows },
    ])
  }

  return respond(out, format, `nilai_${ujianId.slice(0, 8)}.${ext}`)
}

async function exportSoal(format: string, guruId: string | null) {
  const where: any = { deletedAt: null }
  if (guruId) where.guruId = guruId

  const data = await prisma.soal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { mataPelajaran: { select: { nama: true } } },
  })

  const headers = ["Pertanyaan", "Jenis", "Tingkat", "Mapel", "Jawaban", "Poin", "Bab"]
  const rows: Row[] = data.map((s) => ({
    Pertanyaan: s.pertanyaan,
    Jenis: s.jenisSoal === "ESSAY" ? "Essay" : "Pilihan Ganda",
    Tingkat: s.tingkatKesulitan,
    Mapel: s.mataPelajaran.nama,
    Jawaban: s.jawaban,
    Poin: s.poin,
    Bab: s.bab || "",
  }))

  const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xls"
  const out = format === "pdf"
    ? toPdf("Bank Soal", [{ title: "", headers, rows, colWidths: [30, 12, 10, 15, 20, 5, 8] }])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Bank Soal", [{ title: "", headers, rows }])

  return respond(out, format, `soal_${new Date().toISOString().split("T")[0]}.${ext}`)
}
