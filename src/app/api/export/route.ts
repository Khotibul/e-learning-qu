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
  const format = searchParams.get("format") || "excel"

  try {
    switch (type) {
      case "guru":
        return exportGuru(format)
      case "murid":
        return exportMurid(format)
      case "nilai":
        return exportNilai(format, searchParams.get("ujianId"))
      case "soal":
        return exportSoal(format, searchParams.get("guruId"))
      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}

async function exportGuru(format: string) {
  const data = await prisma.guru.findMany({
    where: { deletedAt: null },
    select: { nip: true, nuptk: true, nama: true, noTelp: true, createdAt: true },
  })

  const csv = [
    "NIP,NUPTK,Nama,No Telp,Terdaftar",
    ...data.map((g) =>
      [g.nip || "", g.nuptk || "", g.nama, g.noTelp || "", g.createdAt.toISOString()].join(",")
    ),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=guru.csv",
    },
  })
}

async function exportMurid(format: string) {
  const data = await prisma.siswa.findMany({
    where: { deletedAt: null },
    include: { kelas: { select: { nama: true } } },
  })

  const csv = [
    "NIS,NISN,Nama,Kelas,No Telp",
    ...data.map((s) =>
      [s.nis || "", s.nisn || "", s.nama, s.kelas?.nama || "", s.noTelp || ""].join(",")
    ),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=murid.csv",
    },
  })
}

async function exportNilai(format: string, ujianId: string | null) {
  if (!ujianId) {
    return NextResponse.json({ error: "ujianId required" }, { status: 400 })
  }

  const data = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    include: {
      siswa: { select: { nama: true, nis: true } },
      soal: { select: { pertanyaan: true, poin: true } },
    },
  })

  const csv = [
    "NIS,Nama,Soal,Jawaban,Benar,Poin",
    ...data.map((j) =>
      [j.siswa.nis || "", j.siswa.nama, j.soal.pertanyaan, j.jawaban || "", j.isCorrect ? "Ya" : "Tidak", j.poin || 0].join(",")
    ),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=nilai.csv",
    },
  })
}

async function exportSoal(format: string, guruId: string | null) {
  const where: any = { deletedAt: null }
  if (guruId) where.guruId = guruId

  const data = await prisma.soal.findMany({
    where,
    include: { mataPelajaran: { select: { nama: true } } },
  })

  const csv = [
    "Pertanyaan,Jenis,Tingkat,Mapel,Jawaban,Poin,Bab",
    ...data.map((s) =>
      [
        `"${s.pertanyaan.replace(/"/g, '""')}"`,
        s.jenisSoal,
        s.tingkatKesulitan,
        s.mataPelajaran.nama,
        `"${s.jawaban.replace(/"/g, '""')}"`,
        s.poin,
        s.bab || "",
      ].join(",")
    ),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=soal.csv",
    },
  })
}
