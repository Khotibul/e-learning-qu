import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { fotoUrl } from "@/lib/biodata"

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: corsHeaders }) }

type Ctx = { params: Promise<{ id: string }> }

// Detail biodata murid untuk Guru yang mengajar kelas siswa tersebut
// (wali kelas/guru pengampu). NIK/KK TIDAK ditampilkan — akses terbatas
// pemilik identitas + Admin. Foto profil dari master biodata.
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const { id } = await ctx.params
    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const siswa = await prisma.siswa.findUnique({
      where: { id },
      select: {
        id: true, nis: true, nisn: true, nama: true, alamat: true, noTelp: true, deletedAt: true,
        kelas: { select: { id: true, nama: true, guruId: true, guru: { select: { userId: true, nama: true } } } },
        jurusan: { select: { nama: true } },
        user: {
          select: {
            id: true, image: true, isActive: true,
            biodata: {
              select: {
                panggilan: true, jenisKelamin: true, tempatLahir: true, tanggalLahir: true,
                agama: true, alamat: true, provinsi: true, kabupaten: true, kecamatan: true, desa: true,
                noHp: true, kontakDaruratNama: true, kontakDaruratHubungan: true, kontakDaruratTelp: true,
                fotoThumbId: true,
              },
            },
          },
        },
        santri: { select: { nisNo: true, status: true, keberadaan: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } },
      },
    })
    if (!siswa || siswa.deletedAt) return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404, headers: corsHeaders })

    // RBAC: hanya guru kelas ini (wali kelas) atau guru yang mengajar di kelasnya
    const kelasId = siswa.kelas?.id
    const isWaliKelas = siswa.kelas?.guruId === guru.id
    const mengajar = kelasId
      ? await prisma.pengajaran.findFirst({ where: { guruId: guru.id, kelasId, deletedAt: null }, select: { id: true } })
      : null
    if (!isWaliKelas && !mengajar) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders })
    }

    const b = siswa.user?.biodata
    return NextResponse.json(
      {
        id: siswa.id,
        nis: siswa.nis,
        nisn: siswa.nisn,
        nama: siswa.nama,
        alamat: siswa.alamat,
        noTelp: siswa.noTelp,
        kelas: siswa.kelas?.nama ?? null,
        waliKelas: siswa.kelas?.guru?.nama ?? null,
        jurusan: siswa.jurusan?.nama ?? null,
        fotoUrl: siswa.user?.image ?? fotoUrl(b?.fotoThumbId),
        biodata: b
          ? {
              panggilan: b.panggilan, jenisKelamin: b.jenisKelamin, tempatLahir: b.tempatLahir, tanggalLahir: b.tanggalLahir,
              agama: b.agama, alamat: b.alamat, provinsi: b.provinsi, kabupaten: b.kabupaten, kecamatan: b.kecamatan, desa: b.desa,
              noHp: b.noHp, kontakDaruratNama: b.kontakDaruratNama, kontakDaruratHubungan: b.kontakDaruratHubungan, kontakDaruratTelp: b.kontakDaruratTelp,
            }
          : null,
        santri: siswa.santri ?? null,
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}
