import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import PDFDocument from "pdfkit"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hariTanggal, getKebijakanHarian } from "@/lib/absensi-harian"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const start = searchParams.get("tanggal") || new Date().toISOString().slice(0, 10)
    const end = searchParams.get("end") || start
    const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx"
    const kelasId = searchParams.get("kelasId") || undefined

    const where: Record<string, unknown> = {
      tanggal: { gte: hariTanggal(new Date(start)), lte: hariTanggal(new Date(end)) },
    }
    if (kelasId) where.siswa = { kelasId }

    const rows = await prisma.absensiHarianSiswa.findMany({
      where: where as never,
      include: {
        siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
      },
      orderBy: [{ tanggal: "asc" }, { siswa: { nama: "asc" } }],
      take: 5000,
    })
    const kebijakan = await getKebijakanHarian()

    const data = rows.map((r) => ({
      tanggal: r.tanggal.toISOString().slice(0, 10),
      nama: r.siswa.nama,
      nis: r.siswa.nis ?? "-",
      kelas: r.siswa.kelas?.nama ?? "-",
      jamMasuk: r.jamMasuk ?? "-",
      statusMasuk: r.statusMasuk ?? "BELUM",
      terlambat: r.terlambatMenit ?? 0,
      jamPulang: r.jamPulang ?? "-",
      statusPulang: r.statusPulang ?? "BELUM",
      sumber: [r.sumberMasuk, r.sumberPulang].filter(Boolean).join("/") || "-",
      catatan: r.koreksiAlasan ?? "-",
    }))

    const rekap = {
      total: data.length,
      masuk: data.filter((d) => d.jamMasuk !== "-").length,
      hadirTepat: data.filter((d) => d.statusMasuk === "HADIR").length,
      terlambat: data.filter((d) => d.statusMasuk === "TERLAMBAT").length,
      pulangNormal: data.filter((d) => d.statusPulang === "NORMAL").length,
      pulangAwal: data.filter((d) => d.statusPulang === "AWAL").length,
    }

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Absensi Harian")
      ws.mergeCells("A1:K1")
      ws.getCell("A1").value = `ABSENSI HARIAN SISWA (FINGERPRINT) — ${start} s/d ${end}`
      ws.getCell("A1").font = { bold: true, size: 14 }
      ws.addRow([])
      ws.addRow(["Kebijakan", `Masuk ≤ ${kebijakan.jamMasuk} (+${kebijakan.toleransiMasukMenit} mnt)`, `Pulang ≥ ${kebijakan.jamPulang} (−${kebijakan.toleransiPulangMenit} mnt)`])
      ws.addRow([])
      ws.addRow(["Tanggal", "Nama", "NIS", "Kelas", "Masuk", "Status Masuk", "Terlambat (mnt)", "Pulang", "Status Pulang", "Sumber", "Catatan"])
      ws.getRow(ws.rowCount).font = { bold: true }
      for (const d of data) {
        ws.addRow([d.tanggal, d.nama, d.nis, d.kelas, d.jamMasuk, d.statusMasuk, d.terlambat, d.jamPulang, d.statusPulang, d.sumber, d.catatan])
      }
      ws.addRow([])
      ws.addRow(["REKAP", `Baris ${rekap.total}`, `Masuk ${rekap.masuk}`, `Hadir Tepat ${rekap.hadirTepat}`, `Terlambat ${rekap.terlambat}`, `Pulang Normal ${rekap.pulangNormal}`, `Pulang Awal ${rekap.pulangAwal}`])
      ws.getRow(ws.rowCount).font = { bold: true }
      ws.columns.forEach((c) => (c.width = 16))

      const buffer = await wb.xlsx.writeBuffer()
      return new NextResponse(buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="absensi-harian-${start}-${end}.xlsx"`,
        },
      })
    }

    // PDF
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ margin: 36, size: "A4" })
    doc.on("data", (c: Buffer) => chunks.push(c))
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()))

    doc.fontSize(13).text("ABSENSI HARIAN SISWA (FINGERPRINT)", { align: "center" })
    doc.fontSize(9).text(`Periode: ${start} s/d ${end}`, { align: "center" })
    doc.moveDown(0.5)
    doc.fontSize(8).text(`Kebijakan: masuk ≤ ${kebijakan.jamMasuk} (+${kebijakan.toleransiMasukMenit} mnt) • pulang ≥ ${kebijakan.jamPulang} (−${kebijakan.toleransiPulangMenit} mnt)`)
    doc.moveDown(0.6)

    doc.fontSize(8)
    const kolom = [36, 150, 230, 300, 350, 410, 470, 520]
    const header = ["Nama", "NIS", "Kelas", "Masuk", "Status", "Pulang", "Status", "Terlambat"]
    kolom.forEach((x, i) => doc.text(header[i], x, doc.y, { width: 70, lineBreak: false }))
    doc.moveTo(36, doc.y + 12).lineTo(560, doc.y + 12).stroke()
    doc.moveDown(0.6)

    for (const d of data.slice(0, 250)) {
      const y = doc.y
      const baris = [d.nama, d.nis, d.kelas, d.jamMasuk, d.statusMasuk, d.jamPulang, d.statusPulang, d.terlambat ? `${d.terlambat}m` : "-"]
      kolom.forEach((x, i) => doc.text(String(baris[i]), x, y, { width: i === 0 ? 110 : 68, lineBreak: false, ellipsis: true }))
      if (doc.y > 780) doc.addPage()
      else doc.moveDown(0.5)
    }

    doc.moveDown()
    doc.fontSize(9).text(
      `Rekap: Baris ${rekap.total} • Masuk ${rekap.masuk} • Hadir Tepat ${rekap.hadirTepat} • Terlambat ${rekap.terlambat} • Pulang Normal ${rekap.pulangNormal} • Pulang Awal ${rekap.pulangAwal}`
    )
    if (data.length > 250) doc.fontSize(8).text(`(menampilkan 250 baris pertama dari ${data.length} — gunakan Excel untuk data lengkap)`)
    doc.end()
    await done

    const buffer = Buffer.concat(chunks)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="absensi-harian-${start}-${end}.pdf"`,
      },
    })
  } catch (e) {
    console.error("Export absensi harian error:", e)
    return NextResponse.json({ error: "Gagal export" }, { status: 500 })
  }
}
