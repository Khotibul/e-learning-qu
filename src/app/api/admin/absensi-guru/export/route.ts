import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { dayEnd, dayStart, hitungRekap } from "@/lib/absensi-guru"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  BELUM_ABSEN: "Belum Absen",
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  TIDAK_HADIR: "Tidak Hadir",
}

async function ambilData(req: Request) {
  const session = await auth()
  if (!session?.user?.email || session.user.role !== "ADMIN") return null

  const { searchParams } = new URL(req.url)
  const start = searchParams.get("start") || new Date().toISOString().slice(0, 10)
  const end = searchParams.get("end") || start
  const guruId = searchParams.get("guruId") || undefined
  const kelasId = searchParams.get("kelasId") || undefined
  const mataPelajaranId = searchParams.get("mataPelajaranId") || undefined
  const semesterId = searchParams.get("semesterId") || undefined

  const where: Record<string, unknown> = {
    tanggal: { gte: dayStart(new Date(start)), lte: dayEnd(new Date(end)) },
  }
  if (guruId) where.guruId = guruId

  const jadwalWhere: Record<string, unknown> = {}
  const mapelWhere: Record<string, unknown> = {}
  if (kelasId) jadwalWhere.kelasId = kelasId
  if (mataPelajaranId) mapelWhere.id = mataPelajaranId
  if (semesterId) mapelWhere.semesterId = semesterId
  if (Object.keys(mapelWhere).length > 0) jadwalWhere.mataPelajaran = mapelWhere
  if (Object.keys(jadwalWhere).length > 0) where.jadwal = jadwalWhere

  const rows = await prisma.absensiGuruSesi.findMany({
    where: where as never,
    include: {
      guru: { select: { nama: true, nip: true } },
      jadwal: {
        select: {
          jamMulai: true,
          jamSelesai: true,
          kelas: { select: { nama: true } },
          mataPelajaran: { select: { nama: true } },
        },
      },
    },
    orderBy: [{ tanggal: "asc" }, { jadwal: { jamMulai: "asc" } }],
    take: 5000,
  })

  return { rows, start, end }
}

export async function GET(req: Request) {
  try {
    const data = await ambilData(req)
    if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { rows, start, end } = data
    const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx"
    const rekap = hitungRekap(rows)

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Absensi Guru")
      ws.mergeCells("A1:I1")
      ws.getCell("A1").value = `LAPORAN ABSENSI GURU — ${start} s/d ${end}`
      ws.getCell("A1").font = { bold: true, size: 14 }
      ws.addRow([])
      ws.addRow([
        "Tanggal",
        "Guru",
        "NIP",
        "Kelas",
        "Mata Pelajaran",
        "Jam",
        "Masuk",
        "Selesai",
        "Status",
      ])
      ws.getRow(ws.rowCount).font = { bold: true }
      for (const r of rows) {
        ws.addRow([
          r.tanggal.toISOString().slice(0, 10),
          r.guru.nama,
          r.guru.nip ?? "-",
          r.jadwal.kelas.nama,
          r.jadwal.mataPelajaran.nama,
          `${r.jadwal.jamMulai}-${r.jadwal.jamSelesai}`,
          r.jamMasuk ?? "-",
          r.jamSelesai ?? "-",
          STATUS_LABEL[r.status] ?? r.status,
        ])
      }
      ws.addRow([])
      ws.addRow([
        "REKAP",
        `Total ${rekap.totalSesi}`,
        `Hadir ${rekap.hadir}`,
        `Terlambat ${rekap.terlambat}`,
        `Izin ${rekap.izin}`,
        `Sakit ${rekap.sakit}`,
        `Tidak Hadir ${rekap.tidakHadir}`,
        "",
        `Kehadiran ${rekap.rataKehadiranPersen}%`,
      ])
      ws.getRow(ws.rowCount).font = { bold: true }
      ws.columns.forEach((c) => (c.width = 18))

      const buffer = await wb.xlsx.writeBuffer()
      return new NextResponse(buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="absensi-guru-${start}-${end}.xlsx"`,
        },
      })
    }

    // PDF
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ margin: 36, size: "A4" })
    doc.on("data", (c: Buffer) => chunks.push(c))
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()))

    doc.fontSize(14).text(`LAPORAN ABSENSI GURU`, { align: "center" })
    doc.fontSize(10).text(`Periode: ${start} s/d ${end}`, { align: "center" })
    doc.moveDown()

    doc.fontSize(8)
    const kolom = [36, 110, 200, 275, 375, 470, 520, 570]
    const header = ["Tanggal", "Guru", "Kelas", "Mapel", "Jam", "Masuk", "Selesai", "Status"]
    kolom.forEach((x, i) => doc.text(header[i], x, doc.y, { width: 80, lineBreak: false }))
    doc.moveTo(36, doc.y + 12).lineTo(560, doc.y + 12).stroke()
    doc.moveDown(0.6)

    for (const r of rows.slice(0, 200)) {
      const y = doc.y
      const baris = [
        r.tanggal.toISOString().slice(0, 10),
        r.guru.nama,
        r.jadwal.kelas.nama,
        r.jadwal.mataPelajaran.nama,
        `${r.jadwal.jamMulai}-${r.jadwal.jamSelesai}`,
        r.jamMasuk ?? "-",
        r.jamSelesai ?? "-",
        STATUS_LABEL[r.status] ?? r.status,
      ]
      kolom.forEach((x, i) => doc.text(baris[i], x, y, { width: i === 1 ? 85 : 70, lineBreak: false, ellipsis: true }))
      if (doc.y > 780) {
        doc.addPage()
      } else {
        doc.moveDown(0.5)
      }
    }

    doc.moveDown()
    doc.fontSize(9).text(
      `Rekap: Total ${rekap.totalSesi} • Hadir ${rekap.hadir} • Terlambat ${rekap.terlambat} • Izin ${rekap.izin} • Sakit ${rekap.sakit} • Tidak Hadir ${rekap.tidakHadir} • Kehadiran ${rekap.rataKehadiranPersen}%`
    )
    doc.end()
    await done

    const buffer = Buffer.concat(chunks)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="absensi-guru-${start}-${end}.pdf"`,
      },
    })
  } catch (e) {
    console.error("Export absensi guru error:", e)
    return NextResponse.json({ error: "Gagal export" }, { status: 500 })
  }
}
