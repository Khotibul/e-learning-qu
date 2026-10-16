import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fotoUrl } from "@/lib/biodata"

// ── Portal Wali — daftar anak yang terhubung + hak akses eksplisit ──
// GET /api/wali/anak — wali login (session web). Data anak hanya yang
// relasinya memberi hak (aksesProfil/aksesAbsensi/dst). Kontak keluarga
// tanpa hak tidak melihat apa pun.

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const wali = await prisma.waliSantri.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, nama: true, hubungan: true, fotoUploadId: true },
    })
    if (!wali) return NextResponse.json({ error: "Akun ini bukan wali santri terdaftar" }, { status: 403 })

    const relasi = await prisma.santriWali.findMany({
      where: { waliId: wali.id, santri: { deletedAt: null } },
      select: {
        id: true, isPrimary: true,
        aksesProfil: true, aksesAbsensi: true, aksesTagihan: true, aksesTopup: true,
        bolehNotifikasi: true, bolehSetujuiIzin: true, bolehUploadFoto: true, kontakDarurat: true,
        santri: {
          select: {
            id: true, nisNo: true, nama: true, status: true, keberadaan: true,
            siswa: {
              select: {
                id: true, nis: true, kelas: { select: { nama: true } },
                user: {
                  select: {
                    image: true,
                    biodata: { select: { fotoThumbId: true, jenisKelamin: true, tempatLahir: true, tanggalLahir: true } },
                  },
                },
              },
            },
            asrama: { select: { nama: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const rows = relasi.map((r) => {
      const s = r.santri
      return {
        santriWaliId: r.id,
        hak: {
          aksesProfil: r.aksesProfil, aksesAbsensi: r.aksesAbsensi, aksesTagihan: r.aksesTagihan,
          aksesTopup: r.aksesTopup, bolehNotifikasi: r.bolehNotifikasi, bolehSetujuiIzin: r.bolehSetujuiIzin,
          bolehUploadFoto: r.bolehUploadFoto, kontakDarurat: r.kontakDarurat,
        },
        isPrimary: r.isPrimary,
        anak: {
          santriId: s.id,
          nisNo: s.nisNo,
          nama: s.nama,
          // biodata dasar hanya bila berhak melihat profil
          ...(r.aksesProfil
            ? {
                nis: s.siswa?.nis ?? null,
                kelas: s.siswa?.kelas?.nama ?? null,
                asrama: s.asrama?.nama ?? null,
                fotoUrl: s.siswa?.user?.image ?? fotoUrl(s.siswa?.user?.biodata?.fotoThumbId),
                jenisKelamin: s.siswa?.user?.biodata?.jenisKelamin ?? null,
                tempatLahir: s.siswa?.user?.biodata?.tempatLahir ?? null,
                tanggalLahir: s.siswa?.user?.biodata?.tanggalLahir ?? null,
              }
            : {}),
        },
      }
    })

    return NextResponse.json({
      wali: { id: wali.id, nama: wali.nama, hubungan: wali.hubungan, fotoUrl: fotoUrl(wali.fotoUploadId) },
      rows,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500 })
  }
}
