import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import {
  absenMasukSesi,
  absenSelesaiSesi,
  getJadwalGuruDenganStatus,
  getKebijakanAbsensi,
  getRekapBulananGuru,
  getRiwayatSesiGuru,
  setStatusSesiGuru,
} from "@/lib/absensi-guru"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

async function getGuruFromToken(req: Request) {
  const user = await getMobileUser(req)
  if (!user) return null
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true, nama: true } })
  return guru
}

// GET: daftar sesi hari ini + status absensi  |  ?view=rekap&bulan=YYYY-MM untuk riwayat+rekap
export async function GET(req: Request) {
  try {
    const guru = await getGuruFromToken(req)
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const view = searchParams.get("view")

    if (view === "rekap") {
      const bulan = searchParams.get("bulan") || new Date().toISOString().slice(0, 7)
      const [y, m] = bulan.split("-").map((v) => parseInt(v, 10))
      const start = `${y}-${String(m).padStart(2, "0")}-01`
      const lastDay = new Date(y, m || 1, 0).getDate()
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      const [riwayat, rekap] = await Promise.all([
        getRiwayatSesiGuru(guru.id, start, end),
        getRekapBulananGuru(guru.id, bulan),
      ])
      return NextResponse.json({ riwayat, rekap }, { headers: corsHeaders })
    }

    const tanggal = searchParams.get("tanggal") || new Date().toISOString().slice(0, 10)
    const [sesi, kebijakan] = await Promise.all([getJadwalGuruDenganStatus(guru.id, tanggal), getKebijakanAbsensi()])
    return NextResponse.json({ tanggal, sesi, kebijakan }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile absensi sesi GET error:", e)
    return NextResponse.json({ error: "Gagal memuat absensi sesi" }, { status: 500, headers: corsHeaders })
  }
}

// POST: { action: "masuk" | "selesai" | "izin" | "sakit", jadwalPelajaranId, tanggal, keterangan? }
export async function POST(req: Request) {
  try {
    const guru = await getGuruFromToken(req)
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const body = await req.json()
    const action = String(body.action ?? "")
    const jadwalPelajaranId = String(body.jadwalPelajaranId ?? "")
    const tanggal = String(body.tanggal ?? new Date().toISOString().slice(0, 10))

    if (!jadwalPelajaranId) {
      return NextResponse.json({ error: "jadwalPelajaranId wajib" }, { status: 400, headers: corsHeaders })
    }

    let hasil
    if (action === "masuk") {
      hasil = await absenMasukSesi({ guruId: guru.id, jadwalPelajaranId, tanggal, keterangan: body.keterangan ?? null })
    } else if (action === "selesai") {
      hasil = await absenSelesaiSesi({ guruId: guru.id, jadwalPelajaranId, tanggal })
    } else if (action === "izin" || action === "sakit") {
      hasil = await setStatusSesiGuru({
        guruId: guru.id,
        jadwalPelajaranId,
        tanggal,
        status: action.toUpperCase() as "IZIN" | "SAKIT",
        keterangan: body.keterangan ?? undefined,
      })
    } else {
      return NextResponse.json({ error: "action tidak valid" }, { status: 400, headers: corsHeaders })
    }

    return NextResponse.json({ success: true, sesi: hasil }, { headers: corsHeaders })
  } catch (e: any) {
    const msg = e?.message || "Gagal menyimpan absensi"
    const bad = /tidak mengampu|belum aktif|sudah berakhir|sudah absen|belum absen|tidak ditemukan|sudah ditutup/.test(msg)
    console.error("Mobile absensi sesi POST error:", e)
    return NextResponse.json({ error: msg }, { status: bad ? 400 : 500, headers: corsHeaders })
  }
}
