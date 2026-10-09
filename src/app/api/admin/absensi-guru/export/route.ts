import { ymd } from "@/lib/utils"
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
  const start = searchParams.get("start") || ymd()
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

  // ── Absensi siswa per sesi (sheet terpisah) ──
  const absensiSiswaWhere: Record<string, unknown> = {
    tanggal: { gte: dayStart(new Date(start)), lte: dayEnd(new Date(end)) },
  }
  if (kelasId) absensiSiswaWhere.kelasId = kelasId
  if (mataPelajaranId) absensiSiswaWhere.mataPelajaranId = mataPelajaranId
  const absensiSiswa = await prisma.absensi.findMany({
    where: absensiSiswaWhere as never,
    include: {
      kelas: { select: { nama: true } },
      mataPelajaran: { select: { nama: true } },
      jadwal: { select: { jamMulai: true, jamSelesai: true } },
      guruPencatat: { select: { nama: true } },
      siswa: { include: { siswa: { select: { nama: true, nis: true } } } },
    },
    orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
    take: 3000,
  })

  return { rows, absensiSiswa, start, end }
}

function ringkasSiswa(absensi: { siswa: { status: string }[] }) {
  const c = { HADIR: 0, TERLAMBAT: 0, IZIN: 0, SAKIT: 0, ALPA: 0, TIDAK_HADIR: 0 }
  for (const s of absensi.siswa) {
    if (s.status in c) (c as Record<string, number>)[s.status]++
  }
  return c
}

function teksVerifikasi(r: {
  fotoUrl: string | null
  gpsJarakMeter: number | null
  gpsValid: boolean | null
  sidikJariVerified: boolean
  mockLocation: boolean | null
  verifikasiCatatan: string | null
}): string {
  const bagian: string[] = []
  bagian.push(r.fotoUrl ? "Foto ✓" : "Foto –")
  bagian.push(
    r.gpsJarakMeter != null ? `GPS ${r.gpsJarakMeter}m${r.gpsValid ? " ✓" : " ✗"}` : "GPS –"
  )
  bagian.push(r.sidikJariVerified ? "Sidik ✓" : "Sidik –")
  if (r.mockLocation) bagian.push("mock?")
  if (r.verifikasiCatatan) bagian.push(r.verifikasiCatatan)
  return bagian.join(" • ")
}

export async function GET(req: Request) {
  try {
    const data = await ambilData(req)
    if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { rows, absensiSiswa, start, end } = data
    const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx"
    const rekap = hitungRekap(rows)

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Absensi Guru")
      ws.mergeCells("A1:N1")
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
        "Durasi (mnt)",
        "Terlambat (mnt)",
        "Status",
        "Metode",
        "Verifikasi (Foto/GPS/Sidik)",
        "Koordinat GPS",
      ])
      ws.getRow(ws.rowCount).font = { bold: true }
      for (const r of rows) {
        ws.addRow([
          ymd(r.tanggal),
          r.guru.nama,
          r.guru.nip ?? "-",
          r.jadwal.kelas.nama,
          r.jadwal.mataPelajaran.nama,
          `${r.jadwal.jamMulai}-${r.jadwal.jamSelesai}`,
          r.jamMasuk ?? "-",
          r.jamSelesai ?? "-",
          r.durasiMenit ?? "-",
          r.terlambatMenit ?? 0,
          STATUS_LABEL[r.status] ?? r.status,
          r.metodeDigunakan ?? "-",
          teksVerifikasi(r),
          r.gpsLat != null && r.gpsLng != null ? `${r.gpsLat}, ${r.gpsLng} (akurasi ${r.gpsAkurasiMeter != null ? Math.round(r.gpsAkurasiMeter) : "-"}m)` : "-",
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
        "",
        "",
        `Kehadiran ${rekap.rataKehadiranPersen}%`,
        "",
        "",
        "",
      ])
      ws.getRow(ws.rowCount).font = { bold: true }
      ws.columns.forEach((c) => (c.width = 18))

      // ── Sheet 2: rekap absensi siswa per sesi ──
      const ws2 = wb.addWorksheet("Absensi Siswa")
      ws2.addRow(["Tanggal", "Kelas", "Mata Pelajaran", "Jam", "Guru", "Hadir", "Terlambat", "Izin", "Sakit", "Alpa", "Tidak Hadir", "Total"])
      ws2.getRow(ws2.rowCount).font = { bold: true }
      for (const a of absensiSiswa) {
        const c = ringkasSiswa(a)
        ws2.addRow([
          ymd(a.tanggal),
          a.kelas.nama,
          a.mataPelajaran.nama,
          a.jadwal ? `${a.jadwal.jamMulai}-${a.jadwal.jamSelesai}` : "-",
          a.guruPencatat?.nama ?? "-",
          c.HADIR,
          c.TERLAMBAT,
          c.IZIN,
          c.SAKIT,
          c.ALPA,
          c.TIDAK_HADIR,
          a.siswa.length,
        ])
      }
      ws2.columns.forEach((c) => (c.width = 16))

      // ── Sheet 3: detail kehadiran siswa ──
      const ws3 = wb.addWorksheet("Detail Siswa")
      ws3.addRow(["Tanggal", "Kelas", "Mata Pelajaran", "Nama Siswa", "NIS", "Status", "Keterangan"])
      ws3.getRow(ws3.rowCount).font = { bold: true }
      let detailCount = 0
      for (const a of absensiSiswa) {
        if (detailCount > 8000) break
        for (const s of a.siswa) {
          ws3.addRow([
            ymd(a.tanggal),
            a.kelas.nama,
            a.mataPelajaran.nama,
            s.siswa.nama,
            s.siswa.nis ?? "-",
            STATUS_LABEL[s.status as string] ?? s.status,
            s.keterangan ?? "",
          ])
          detailCount++
          if (detailCount > 8000) break
        }
      }
      ws3.columns.forEach((c) => (c.width = 18))

      const buffer = await wb.xlsx.writeBuffer()
      return new NextResponse(buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="absensi-${start}-${end}.xlsx"`,
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
        ymd(r.tanggal),
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
      `Rekap Guru: Total ${rekap.totalSesi} • Hadir ${rekap.hadir} • Terlambat ${rekap.terlambat} • Izin ${rekap.izin} • Sakit ${rekap.sakit} • Tidak Hadir ${rekap.tidakHadir} • Kehadiran ${rekap.rataKehadiranPersen}%`
    )
    const adaFoto = rows.filter((r) => r.fotoUrl).length
    const gpsValid = rows.filter((r) => r.gpsValid).length
    const gpsCek = rows.filter((r) => r.gpsJarakMeter != null).length
    const sidik = rows.filter((r) => r.sidikJariVerified).length
    const mock = rows.filter((r) => r.mockLocation).length
    doc.moveDown(0.3)
    doc
      .fontSize(8)
      .text(
        `Verifikasi: foto ${adaFoto}/${rows.length} • GPS tercatat ${gpsCek} (valid ${gpsValid}) • sidik jari ${sidik} • indikasi mock ${mock}`
      )

    // ── Ringkasan absensi siswa (halaman terpisah) ──
    if (absensiSiswa.length > 0) {
      doc.addPage()
      doc.fontSize(12).text("RINGKASAN ABSENSI SISWA PER SESI", { align: "center" })
      doc.fontSize(8).moveDown(0.5)
      const kolomS = [36, 105, 200, 300, 375, 430, 475, 520]
      const headerS = ["Tanggal", "Kelas", "Mapel", "Jam", "Hadir", "Terlambat", "Izin/Sakit", "Alpa"]
      kolomS.forEach((x, i) => doc.text(headerS[i], x, doc.y, { width: 80, lineBreak: false }))
      doc.moveTo(36, doc.y + 12).lineTo(560, doc.y + 12).stroke()
      doc.moveDown(0.6)
      for (const a of absensiSiswa.slice(0, 150)) {
        const y = doc.y
        const c = ringkasSiswa(a)
        const baris = [
          ymd(a.tanggal),
          a.kelas.nama,
          a.mataPelajaran.nama,
          a.jadwal ? `${a.jadwal.jamMulai}-${a.jadwal.jamSelesai}` : "-",
          String(c.HADIR),
          String(c.TERLAMBAT),
          `${c.IZIN}/${c.SAKIT}`,
          String(c.ALPA),
        ]
        kolomS.forEach((x, i) => doc.text(baris[i], x, y, { width: 75, lineBreak: false, ellipsis: true }))
        if (doc.y > 780) doc.addPage()
        else doc.moveDown(0.5)
      }
    }

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
