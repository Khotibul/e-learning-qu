import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { getPondokAccess } from "@/lib/pondok-rbac"

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guru = await prisma.guru.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, nama: true, jabatan: true, asramaDibina: { select: { id: true } } },
    })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const [kelasCount, mapelCount, siswaCount, ujianAktif, latihanAktif, soalCount, nilaiAgg, masteryAgg] = await Promise.all([
      prisma.kelas.count({ where: { guruId: guru.id, deletedAt: null } }),
      prisma.pengajaran.count({ where: { guruId: guru.id, deletedAt: null } }),
      prisma.siswa.count({ where: { kelas: { guruId: guru.id, deletedAt: null }, deletedAt: null } }),
      prisma.ujian.count({ where: { guruId: guru.id, status: "AKTIF", deletedAt: null, isLatihan: false } }),
      prisma.ujian.count({ where: { guruId: guru.id, status: "AKTIF", deletedAt: null, isLatihan: true } }),
      prisma.soal.count({ where: { guruId: guru.id, deletedAt: null } }),
      prisma.nilai.aggregate({ where: { deletedAt: null, ujian: { guruId: guru.id } }, _avg: { nilai: true } }),
      prisma.penguasaanKompetensi.aggregate({ where: { siswa: { kelas: { guruId: guru.id } } }, _avg: { skor: true } }),
    ])
    const rataNilai = nilaiAgg._avg.nilai != null ? Math.round(nilaiAgg._avg.nilai) : 0
    const rataMastery = masteryAgg._avg.skor != null ? Math.round(masteryAgg._avg.skor) : 0

    let bisaUstadz = false
    let bisaPengurus = false
    let bisaGerbang = ["GERBANG", "MUSYRIF", "PENGASUH"].includes(guru.jabatan ?? "")
    try {
      const akses = await getPondokAccess(user.id)
      const p = akses.permissions
      bisaUstadz = ["pondok.diniyah.manage", "pondok.tahfidz.manage", "pondok.izin.view", "pondok.laporan.view"].some((v) => p.includes(v as never))
      bisaPengurus = ["pondok.kegiatan.manage", "pondok.santri.view", "pondok.pembinaan.manage", "pondok.pengumuman.publish"].some((v) => p.includes(v as never))
      bisaGerbang = bisaGerbang || p.includes("pondok.izin.checkout" as never)
    } catch { /* bukan staf pondok */ }

    return NextResponse.json({
      nama: guru.nama,
      jabatan: guru.jabatan,
      // Sama seperti filter sidebar website: menu izin musyrif hanya untuk MUSYRIF/PENGASUH/GERBANG atau pembina asrama.
      bisaMusyrif: ["MUSYRIF", "PENGASUH", "GERBANG"].includes(guru.jabatan ?? "") || guru.asramaDibina.length > 0,
      bisaPelanggaran: guru.jabatan === "BK",
      bisaUstadz,
      bisaPengurus,
      bisaGerbang,
      kelasCount,
      mapelCount,
      siswaCount,
      ujianAktif,
      latihanAktif,
      totalSoal: soalCount,
      rataNilai,
      rataMastery,
    }, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}
