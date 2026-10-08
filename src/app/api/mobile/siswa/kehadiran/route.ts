import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { getKebijakanHarian, hariTanggal, ajukanAbsensiManual } from "@/lib/absensi-harian"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

async function getSiswa(req: Request) {
  const user = await getMobileUser(req)
  if (!user) return null
  return prisma.siswa.findUnique({ where: { userId: user.id }, select: { id: true, nama: true, kelasId: true } })
}

// GET: kehadiran hari ini + riwayat bulan berjalan (absensi harian fingerprint)
export async function GET(req: Request) {
  try {
    const siswa = await getSiswa(req)
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const bulan = searchParams.get("bulan") || new Date().toISOString().slice(0, 7)
    const [y, m] = bulan.split("-").map((v) => parseInt(v, 10))
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59, 999)
    const tgl = hariTanggal(new Date())

    const [kebijakan, hariIni, rows, hariLibur, permintaan] = await Promise.all([
      getKebijakanHarian(),
      prisma.absensiHarianSiswa.findUnique({ where: { siswaId_tanggal: { siswaId: siswa.id, tanggal: tgl } } }),
      prisma.absensiHarianSiswa.findMany({
        where: { siswaId: siswa.id, tanggal: { gte: start, lte: end } },
        orderBy: { tanggal: "desc" },
        take: 62,
      }),
      prisma.tanggalLibur.count({ where: { tanggal: { gte: start, lte: end } } }),
      prisma.permintaanAbsensiManual.findMany({
        where: { siswaId: siswa.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, tanggal: true, tipe: true, alasan: true, status: true, catatanAdmin: true, createdAt: true },
      }),
    ])

    const hariSekolah = Math.max(1, new Date(y, m, 0).getDate() - hariLibur)
    const hadir = rows.filter((r) => r.statusMasuk === "HADIR").length

    return NextResponse.json({
      kebijakan,
      hariIni,
      bulan,
      hariSekolah,
      rekap: {
        hariTercatat: rows.length,
        hadir,
        terlambat: rows.filter((r) => r.statusMasuk === "TERLAMBAT").length,
        pulangAwal: rows.filter((r) => r.statusPulang === "AWAL").length,
        persenKehadiran: Math.round((hadir / hariSekolah) * 100),
      },
      rows,
      permintaan: permintaan.map((p) => ({ ...p, tanggal: p.tanggal.toISOString().slice(0, 10), createdAt: p.createdAt.toISOString() })),
    }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile kehadiran GET error:", e)
    return NextResponse.json({ error: "Gagal memuat kehadiran" }, { status: 500, headers: corsHeaders })
  }
}

// POST: ajukan verifikasi manual { tanggal, tipe: MASUK|PULANG, alasan }
export async function POST(req: Request) {
  try {
    const siswa = await getSiswa(req)
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const body = await req.json()
    await ajukanAbsensiManual({
      siswaId: siswa.id,
      tanggal: String(body.tanggal ?? new Date().toISOString().slice(0, 10)),
      tipe: String(body.tipe ?? "MASUK") as "MASUK" | "PULANG",
      alasan: String(body.alasan ?? ""),
    })
    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal mengajukan" }, { status: 400, headers: corsHeaders })
  }
}
