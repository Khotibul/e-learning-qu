import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized — token tidak valid" }, { status: 401, headers: corsHeaders })

    const siswa = await prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true, kelasId: true } })
    if (!siswa?.kelasId) return NextResponse.json([], { headers: corsHeaders })

    const ujians = await prisma.ujian.findMany({
      where: { kelasId: siswa.kelasId, deletedAt: null, isLatihan: false },
      select: {
        id: true, nama: true, tanggal: true, durasi: true, status: true, jumlahSoal: true, nilaiMinimum: true, bisaRetake: true,
        mataPelajaran: { select: { nama: true } },
        kelas: { select: { nama: true } },
        _count: { select: { jawabanUjian: { where: { siswaId: siswa.id } } } },
      },
      orderBy: { tanggal: "desc" },
      take: 50,
    })

    const result = ujians.map((u) => ({
      id: u.id, nama: u.nama, mapel: u.mataPelajaran.nama, kelas: u.kelas.nama,
      tanggal: u.tanggal.toISOString(), durasi: u.durasi, status: u.status,
      sudahDikerjakan: u._count.jawabanUjian > 0, jumlahSoal: u.jumlahSoal, nilaiMinimum: u.nilaiMinimum, bisaRetake: u.bisaRetake,
    }))

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile ujian error:", e)
    return NextResponse.json({ error: "Gagal memuat ujian" }, { status: 500, headers: corsHeaders })
  }
}
