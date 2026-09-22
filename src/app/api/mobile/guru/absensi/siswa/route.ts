import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// GET: ambil absensi murid per kelas+mapel+tanggal
export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const kelasId = searchParams.get("kelasId")
    const mataPelajaranId = searchParams.get("mataPelajaranId")
    const tanggal = searchParams.get("tanggal")

    if (!kelasId || !mataPelajaranId || !tanggal) {
      return NextResponse.json({ error: "kelasId, mataPelajaranId, tanggal wajib" }, { status: 400, headers: corsHeaders })
    }

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const isPengampu = await prisma.pengajaran.findFirst({
      where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
    })
    const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
    if (!isPengampu && !isWali) return NextResponse.json({ error: "Tidak mengampu" }, { status: 403, headers: corsHeaders })

    const absensi = await prisma.absensi.findFirst({
      where: { kelasId, mataPelajaranId, tanggal: new Date(tanggal) },
      include: { siswa: { include: { siswa: { select: { id: true, nama: true, nis: true } } } } },
    })

    // Jika belum ada absensi, kembalikan daftar siswa dengan status default HADIR
    if (!absensi) {
      const siswas = await prisma.siswa.findMany({
        where: { kelasId, deletedAt: null },
        select: { id: true, nama: true, nis: true },
        orderBy: { nama: "asc" },
      })
      return NextResponse.json({ absensi: null, siswas: siswas.map((s) => ({ siswaId: s.id, nama: s.nama, nis: s.nis, status: "HADIR" })) }, { headers: corsHeaders })
    }

    return NextResponse.json(
      {
        absensi: { id: absensi.id, tanggal: absensi.tanggal },
        siswas: absensi.siswa.map((s) => ({ siswaId: s.siswaId, nama: s.siswa.nama, nis: s.siswa.nis, status: s.status })),
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}

// POST: simpan absensi murid per mapel (1x per hari per mapel)
export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const body = await req.json()
    const kelasId = String(body.kelasId ?? "")
    const mataPelajaranId = String(body.mataPelajaranId ?? "")
    const tanggal = String(body.tanggal ?? "")
    const siswaStatus = body.siswaStatus as { siswaId: string; status: string }[]

    if (!kelasId || !mataPelajaranId || !tanggal || !Array.isArray(siswaStatus)) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders })
    }

    const isPengampu = await prisma.pengajaran.findFirst({
      where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
    })
    const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
    if (!isPengampu && !isWali) return NextResponse.json({ error: "Tidak mengampu" }, { status: 403, headers: corsHeaders })

    let absensi = await prisma.absensi.findFirst({ where: { kelasId, mataPelajaranId, tanggal: new Date(tanggal) } })
    if (absensi) {
      await prisma.absensiSiswa.deleteMany({ where: { absensiId: absensi.id } })
    } else {
      absensi = await prisma.absensi.create({ data: { kelasId, mataPelajaranId, tanggal: new Date(tanggal) } })
    }

    if (siswaStatus.length > 0) {
      await prisma.absensiSiswa.createMany({
        data: siswaStatus.map((s) => ({ absensiId: absensi!.id, siswaId: s.siswaId, status: s.status as never })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true, message: "Tersimpan — 1x per mapel per hari" }, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500, headers: corsHeaders })
  }
}
