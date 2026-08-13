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

function escPdf(s: string): string {
  let out = ""
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c === 40) out += "\\("
    else if (c === 41) out += "\\)"
    else if (c === 92) out += "\\\\"
    else if (c > 31 && c < 127 || c > 160) out += ch
    else out += "?"
  }
  return out
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

function toPdf(title: string, headers: string[], rows: Row[], colWidths: number[], dateLabel = "Dicetak"): Buffer {
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
  const pw = Buffer.byteLength(String(title), "binary")
  const dw = Buffer.byteLength(escPdf(dateStr), "binary")

  const colX: number[] = []
  let cur = ML
  const totW = colWidths.reduce((a, b) => a + b, 0)
  for (let i = 0; i < headers.length; i++) {
    colX.push(cur)
    cur += (colWidths[i] / totW) * usableW
  }

  function pageStream(y0: number): string {
    let s = "BT /F1 14 Tf 1 0 0 1 " + ML + " 560 Tm (" + escPdf(title) + ") Tj ET\n"
    s += "BT /F1 8 Tf 1 0 0 1 " + (W - MR - dw) + " 565 Tm (" + escPdf(dateStr) + ") Tj ET\n"
    s += "1 0 0 1 40 " + (y0 + 20) + " cm 762 0.5 re f\n"
    return s
  }

  function headerStream(y0: number): string {
    let s = "BT /F2 10 Tf\n"
    for (let i = 0; i < headers.length; i++) {
      const x = colX[i]
      const w = ((colWidths[i] / totW) * usableW) - 6
      s += "1 0 0 1 " + x + " " + y0 + " Tm (" + trunc(escPdf(headers[i]), 60) + ") Tj ET\n"
      s += "0 0 0 rg 1 0 0 1 " + x + " " + (y0 - 10) + " m " + (x + w) + " " + (y0 - 10) + " l S\n"
      s += "BT /F2 10 Tf\n"
    }
    return s + "ET\n"
  }

  function rowStream(y0: number, r: Row): string {
    let s = "BT /F1 9 Tf\n"
    for (let i = 0; i < headers.length; i++) {
      const x = colX[i]
      const w = ((colWidths[i] / totW) * usableW) - 6
      let cell = String(r[headers[i]] ?? "")
      if (cell.length > 0) cell = trunc(escPdf(cell), Math.floor(w / 4.6))
      s += "1 0 0 1 " + x + " " + y0 + " Tm (" + cell + ") Tj ET\n"
      s += "BT /F1 9 Tf\n"
    }
    return s + "ET\n"
  }

  const objs: string[] = []
  const perPage = Math.max(1, Math.floor((H - MT - MB - headerH - 10) / rowH))

  const chunks: Row[][] = []
  for (let i = 0; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage))
  if (chunks.length === 0) chunks.push([])

  const nPages = chunks.length
  for (let pi = 0; pi < nPages; pi++) {
    const contentY = H - MT - headerH - 10
    let body = ""
    let y = contentY
    for (const r of chunks[pi]) {
      body += rowStream(y, r)
      y -= rowH
    }
    const content = pageStream(H - MT) + headerStream(contentY + 26) + body
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

function toExcel(title: string, headers: string[], rows: Row[]): Buffer {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const tr = (cells: string[], bold = false) =>
    `<tr>${cells.map((c) => `<td ${bold ? 'style="font-weight:bold;background-color:#f1f5f9"' : ""}>${esc(c)}</td>`).join("")}</tr>`

  const head = tr(headers.map(String), true)
  const body = rows.map((r) => tr(headers.map((h) => String(r[h] ?? "")))).join("")
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(title)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1"><tr><td colspan="${headers.length}" style="font-weight:bold;font-size:14px">${esc(title)}</td></tr>${head}${body}</table></body></html>`

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
    ? toPdf("Data Guru", headers, rows, [20, 20, 30, 15, 15])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Data Guru", headers, rows)

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
    ? toPdf("Data Murid", headers, rows, [15, 15, 30, 20, 20])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Data Murid", headers, rows)

  return respond(out, format, `murid_${new Date().toISOString().split("T")[0]}.${ext}`)
}

async function exportNilai(format: string, ujianId: string | null) {
  if (!ujianId) {
    return NextResponse.json({ error: "ujianId required" }, { status: 400 })
  }

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: { nama: true },
  })

  const data = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    orderBy: { siswa: { nama: "asc" } },
    include: {
      siswa: { select: { nama: true, nis: true } },
      soal: { select: { pertanyaan: true, poin: true } },
    },
  })

  const headers = ["NIS", "Nama", "Soal", "Jawaban", "Benar", "Poin"]
  const rows: Row[] = data.map((j) => ({
    NIS: j.siswa.nis || "-",
    Nama: j.siswa.nama,
    Soal: j.soal.pertanyaan,
    Jawaban: j.jawaban || "",
    Benar: j.isCorrect ? "Ya" : "Tidak",
    Poin: j.poin || 0,
  }))

  const title = `Nilai Ujian: ${ujian?.nama || "Tanpa judul"}`
  const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xls"
  const out = format === "pdf"
    ? toPdf(title, headers, rows, [10, 20, 40, 20, 5, 5])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel(title, headers, rows)

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
    ? toPdf("Bank Soal", headers, rows, [30, 12, 10, 15, 20, 5, 8])
    : format === "csv"
      ? toCsv(headers, rows)
      : toExcel("Bank Soal", headers, rows)

  return respond(out, format, `soal_${new Date().toISOString().split("T")[0]}.${ext}`)
}
