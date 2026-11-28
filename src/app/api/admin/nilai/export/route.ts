import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getRekapKelas } from "@/app/(dashboard)/raport/actions"
import { predikatDari } from "@/lib/raport"

export const dynamic = "force-dynamic"

function namaFile(teks: string) {
  return teks.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "kelas"
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const kelasId = searchParams.get("kelasId")
    if (!kelasId) return NextResponse.json({ error: "Pilih kelas terlebih dahulu" }, { status: 400 })

    const semesterId =
      searchParams.get("semesterId") ||
      (
        await prisma.semester.findFirst({
          where: { deletedAt: null },
          select: { id: true },
          orderBy: [{ isAktif: "desc" }, { createdAt: "desc" }],
        })
      )?.id
    if (!semesterId) return NextResponse.json({ error: "Semester tidak ditemukan" }, { status: 400 })

    const [kelas, semester, rekap] = await Promise.all([
      prisma.kelas.findFirst({ where: { id: kelasId, deletedAt: null }, select: { nama: true } }),
      prisma.semester.findUnique({
        where: { id: semesterId },
        select: { nama: true, tahunAjaran: { select: { nama: true } } },
      }),
      getRekapKelas(kelasId, semesterId),
    ])
    if (!kelas) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 })
    if (!semester) return NextResponse.json({ error: "Semester tidak ditemukan" }, { status: 404 })

    const baris = rekap.siswas.map((siswa, i) => {
      const nilai = rekap.mapels.map((mapel) => rekap.nilai[siswa.id]?.[mapel.id] ?? null)
      const terisi = nilai.filter((n): n is number => n != null)
      const rata = terisi.length ? Math.round((terisi.reduce((a, b) => a + b, 0) / terisi.length) * 100) / 100 : null
      return {
        no: i + 1,
        nama: siswa.nama,
        nis: siswa.nis ?? "-",
        nisn: siswa.nisn ?? "-",
        nilai,
        rata,
        predikat: rata == null ? "-" : predikatDari(rata, rekap.pengaturan),
      }
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Rekap Nilai")
    const jumlahKolom = 4 + rekap.mapels.length + 2

    ws.mergeCells(1, 1, 1, jumlahKolom)
    ws.getCell(1, 1).value = `REKAP NILAI AKHIR — ${kelas.nama}`
    ws.getCell(1, 1).font = { bold: true, size: 14 }
    ws.mergeCells(2, 1, 2, jumlahKolom)
    ws.getCell(2, 1).value = `Semester ${semester.nama} (${semester.tahunAjaran.nama}) • Sumber: perhitungan raport • KKM ${rekap.pengaturan.kktp}`
    ws.getCell(3, 1).value = ""

    const judul = ["No", "Nama Siswa", "NIS", "NISN", ...rekap.mapels.map((m) => `${m.nama} (${m.kode})`), "Rata-rata", "Predikat"]
    const header = ws.addRow(judul)
    header.font = { bold: true }
    header.alignment = { vertical: "middle", horizontal: "center", wrapText: true }

    for (const r of baris) {
      const row = ws.addRow([r.no, r.nama, r.nis, r.nisn, ...r.nilai, r.rata, r.predikat])
      r.nilai.forEach((n, i) => (row.getCell(5 + i).numFmt = "0.##"))
      row.getCell(5 + r.nilai.length).numFmt = "0.##"
      row.getCell(5 + r.nilai.length).font = { bold: true }
    }

    ws.columns.forEach((c, i) => {
      if (i === 1) c.width = 28
      else if (i === 2 || i === 3) c.width = 16
      else c.width = 14
    })
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 3 }]

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-nilai-${namaFile(kelas.nama)}-${namaFile(`${semester.nama}-${semester.tahunAjaran.nama}`)}.xlsx"`,
      },
    })
  } catch (e) {
    console.error("Export rekap nilai error:", e)
    return NextResponse.json({ error: "Gagal export rekap nilai" }, { status: 500 })
  }
}
