import { prisma } from "@/lib/prisma"
import { perbaruiIzinTerlambat } from "@/lib/izin-santri"
import { requirePondok, ok, fail, options } from "../../_lib"

export { options }

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const endOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)

export async function GET(req: Request) {
  const auth = await requirePondok(req, "pondok.dashboard.view")
  if (auth.error) return auth.error

  try {
    const hariIni = startOfDay()
    const bulanIni = startOfMonth()

    const kini = new Date()

    await perbaruiIzinTerlambat()

    const [
      totalSantri,
      diPondok,
      izinPulang,
      terlambat,
      tidakDiketahui,
      totalAsrama,
      totalKamar,
      kegiatanHariIni,
      absensiKegiatanHadir,
      absensiKegiatanTotal,
      setoranBulanIni,
      halaqahAktif,
      kelasDiniyahAktif,
      absensiDiniyahHadir,
      absensiDiniyahTotal,
      izinMenungguPengurus,
      izinMenungguMusyrif,
      izinMenungguKepala,
      izinMenungguAdmin,
      pengumumanMenunggu,
      pembinaanMenunggu,
      pelanggaranBulanIni,
      prestasiBulanIni,
      kegiatanMendatang,
    ] = await Promise.all([
      prisma.santri.count({ where: { status: "AKTIF", deletedAt: null } }),
      prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "DI_PONDOK" } }),
      prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR"] } } }),
      prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "TERLAMBAT_KEMBALI" } }),
      prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["TIDAK_DIKETAHUI", "BELUM_KEMBALI"] } } }),
      prisma.asrama.count({ where: { aktif: true } }),
      prisma.kamar.count(),
      prisma.kegiatanPondok.count({ where: { tanggal: hariIni } }),
      prisma.absensiKegiatanPondok.count({ where: { tanggal: hariIni, status: "HADIR" } }),
      prisma.absensiKegiatanPondok.count({ where: { tanggal: hariIni } }),
      prisma.setoranTahfidz.count({ where: { tanggal: { gte: bulanIni } } }),
      prisma.halaqah.count({ where: { aktif: true } }),
      prisma.kelasDiniyah.count({ where: { aktif: true } }),
      prisma.absensiDiniyah.count({ where: { tanggal: { gte: bulanIni }, status: "HADIR" } }),
      prisma.absensiDiniyah.count({ where: { tanggal: { gte: bulanIni } } }),
      prisma.izinSantri.count({ where: { status: "MENUNGGU_PENGURUS" } }),
      prisma.izinSantri.count({ where: { status: "MENUNGGU_MUSYRIF" } }),
      prisma.izinSantri.count({ where: { status: "MENUNGGU_KEPALA" } }),
      prisma.izinSantri.count({ where: { status: "MENUNGGU_ADMIN" } }),
      prisma.pengumuman.count({ where: { status: "MENUNGGU" } }),
      prisma.pembinaanSantri.count({ where: { status: "MENUNGGU" } }),
      prisma.pembinaanSantri.count({ where: { tipe: "PELANGGARAN", tanggal: { gte: bulanIni } } }),
      prisma.pembinaanSantri.count({ where: { tipe: { in: ["PRESTASI", "PENGHARGAAN"] }, tanggal: { gte: bulanIni } } }),
      prisma.kegiatanPondok.findMany({
        where: { tanggal: { gte: hariIni } },
        orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
        take: 10,
        select: {
          id: true,
          nama: true,
          tipe: true,
          tanggal: true,
          jamMulai: true,
          jamSelesai: true,
          lokasi: true,
          wajib: true,
          penanggungJawab: { select: { name: true } },
        },
      }),
    ])

    return ok({
      totalSantri,
      diPondok,
      izinPulang,
      terlambat,
      tidakDiketahui,
      totalAsrama,
      totalKamar,
      kegiatanHariIni,
      kehadiranKegiatanPersen:
        absensiKegiatanTotal > 0 ? Math.round((absensiKegiatanHadir / absensiKegiatanTotal) * 1000) / 10 : null,
      capaianTahfidz: { setoranBulanIni, halaqahAktif },
      diniyah: {
        kelasAktif: kelasDiniyahAktif,
        hadirPersenBulan:
          absensiDiniyahTotal > 0 ? Math.round((absensiDiniyahHadir / absensiDiniyahTotal) * 1000) / 10 : null,
      },
      izinMenunggu: izinMenungguPengurus + izinMenungguMusyrif + izinMenungguKepala + izinMenungguAdmin,
      izinMenungguPengurus,
      izinMenungguMusyrif,
      izinMenungguKepala,
      izinMenungguAdmin,
      pengumumanMenunggu,
      pembinaanMenunggu,
      pelanggaranBulanIni,
      prestasiBulanIni,
      kegiatanMendatang: kegiatanMendatang.map((k) => ({
        id: k.id,
        nama: k.nama,
        tipe: k.tipe,
        tanggal: k.tanggal,
        jamMulai: k.jamMulai,
        jamSelesai: k.jamSelesai,
        lokasi: k.lokasi,
        wajib: k.wajib,
        penanggungJawab: k.penanggungJawab?.name ?? null,
      })),
      periode: { bulanIni: kini.toISOString(), hariIni: hariIni.toISOString() },
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
