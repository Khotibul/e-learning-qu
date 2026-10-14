import { prisma } from "@/lib/prisma"
import {
  getIzinMenunggu,
  getRiwayatIzin,
  getStatistikIzin,
  perbaruiIzinTerlambat,
  JENIS_IZIN_LABEL,
  STATUS_IZIN_LABEL,
  KEBERADAAN_LABEL,
} from "@/lib/izin-santri"
import { requirePondok, scopeFilter, ok, fail, options } from "../../_lib"

export { options }

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)

type TabReq =
  | "keberadaan"
  | "kegiatan"
  | "izin-menunggu"
  | "izin-riwayat"
  | "pengumuman"
  | "pembinaan"
  | "laporan"

const TAB_PERM: Record<TabReq, Parameters<typeof requirePondok>[1]> = {
  keberadaan: "pondok.santri.view",
  kegiatan: "pondok.dashboard.view",
  "izin-menunggu": "pondok.izin.view",
  "izin-riwayat": "pondok.laporan.view",
  pengumuman: "pondok.dashboard.view",
  pembinaan: "pondok.pembinaan.manage",
  laporan: "pondok.laporan.view",
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tab = (url.searchParams.get("tab") || "keberadaan") as TabReq
  const perm = TAB_PERM[tab]
  if (!perm) return fail("tab tidak dikenal", 400)

  const auth = await requirePondok(req, perm)
  if (auth.error) return auth.error

  try {
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
    const scope = await scopeFilter(auth.user.id)
    const santriFilter = scope.santriIdIn ? { in: scope.santriIdIn } : undefined

    switch (tab) {
      case "keberadaan": {
        const rows = await prisma.santri.findMany({
          where: {
            status: "AKTIF",
            deletedAt: null,
            keberadaan: { not: "DI_PONDOK" },
            ...(santriFilter ? { id: santriFilter } : {}),
          },
          orderBy: { nama: "asc" },
          take: 200,
          select: {
            id: true,
            nama: true,
            nisNo: true,
            keberadaan: true,
            asrama: { select: { nama: true } },
            kamar: { select: { nama: true } },
            izins: {
              where: { status: "DISETUJUI" },
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { id: true, suratNomor: true, rencanaKembali: true, jenis: true, checkoutAt: true },
            },
          },
        })
        return ok({
          tab,
          scopeSemua: scope.scopeSemua,
          rows: rows.map((r) => ({
            id: r.id,
            nama: r.nama,
            nisNo: r.nisNo,
            keberadaan: r.keberadaan,
            keberadaanLabel: KEBERADAAN_LABEL[r.keberadaan as keyof typeof KEBERADAAN_LABEL] ?? r.keberadaan,
            asrama: r.asrama?.nama ?? null,
            kamar: r.kamar?.nama ?? null,
            izinAktif: r.izins[0]
              ? {
                  id: r.izins[0].id,
                  suratNomor: r.izins[0].suratNomor,
                  rencanaKembali: r.izins[0].rencanaKembali,
                  jenis: r.izins[0].jenis,
                  jenisLabel: JENIS_IZIN_LABEL[r.izins[0].jenis],
                  checkoutAt: r.izins[0].checkoutAt,
                }
              : null,
          })),
          keberadaanLabel: KEBERADAAN_LABEL,
        })
      }

      case "kegiatan": {
        await perbaruiIzinTerlambat()
        const dari = url.searchParams.get("dari")
        const sampai = url.searchParams.get("sampai")
        const rows = await prisma.kegiatanPondok.findMany({
          where: {
            ...(dari || sampai
              ? {
                  tanggal: {
                    ...(dari ? { gte: new Date(dari) } : {}),
                    ...(sampai ? { lte: new Date(sampai) } : {}),
                  },
                }
              : {}),
          },
          orderBy: [{ tanggal: "desc" }, { jamMulai: "asc" }],
          take: 100,
          select: {
            id: true,
            nama: true,
            tipe: true,
            tanggal: true,
            jamMulai: true,
            jamSelesai: true,
            lokasi: true,
            deskripsi: true,
            wajib: true,
            penanggungJawab: { select: { name: true } },
            _count: { select: { absensi: true } },
          },
        })
        return ok({
          tab,
          rows: rows.map((r) => ({
            id: r.id,
            nama: r.nama,
            tipe: r.tipe,
            tanggal: r.tanggal,
            jamMulai: r.jamMulai,
            jamSelesai: r.jamSelesai,
            lokasi: r.lokasi,
            deskripsi: r.deskripsi,
            wajib: r.wajib,
            penanggungJawab: r.penanggungJawab?.name ?? null,
            jumlahAbsensi: r._count.absensi,
          })),
        })
      }

      case "izin-menunggu": {
        const rows = await getIzinMenunggu("KEPALA")
        return ok({
          tab,
          rows,
          statusLabel: STATUS_IZIN_LABEL,
          jenisLabel: JENIS_IZIN_LABEL,
        })
      }

      case "izin-riwayat": {
        const result = await getRiwayatIzin({ page, limit: 20 })
        return ok({
          tab,
          scopeSemua: scope.scopeSemua,
          data: result.data ?? result,
          total: result.total ?? 0,
          page: result.page ?? page,
          limit: result.limit ?? 20,
          totalPages: result.totalPages ?? 1,
          statusLabel: STATUS_IZIN_LABEL,
          jenisLabel: JENIS_IZIN_LABEL,
        })
      }

      case "pengumuman": {
        const rows = await prisma.pengumuman.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            judul: true,
            isi: true,
            tipe: true,
            status: true,
            createdAt: true,
            approvedAt: true,
            user: { select: { name: true } },
          },
        })
        return ok({ tab, rows })
      }

      case "pembinaan": {
        const status = url.searchParams.get("status") as never
        const rows = await prisma.pembinaanSantri.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(santriFilter ? { santriId: santriFilter } : {}),
          },
          orderBy: { tanggal: "desc" },
          take: 100,
          select: {
            id: true,
            tipe: true,
            judul: true,
            deskripsi: true,
            poin: true,
            tindakLanjut: true,
            status: true,
            tanggal: true,
            santri: { select: { id: true, nama: true, nisNo: true } },
            petugas: { select: { name: true } },
          },
        })
        return ok({ tab, scopeSemua: scope.scopeSemua, rows })
      }

      case "laporan": {
        const bulanIni = startOfMonth()
        const [statistik, santri, asrama, totalKamar, kegiatan, absensiKegiatan, setoran, absensiDiniyah, pembinaan] =
          await Promise.all([
            getStatistikIzin(),
            prisma.santri.groupBy({ by: ["keberadaan"], where: { status: "AKTIF", deletedAt: null, ...(santriFilter ? { id: santriFilter } : {}) }, _count: true }),
            prisma.asrama.findMany({ where: { aktif: true }, select: { id: true, nama: true, _count: { select: { santris: true } } } }),
            prisma.kamar.count(),
            prisma.kegiatanPondok.count({ where: { tanggal: { gte: bulanIni } } }),
            prisma.absensiKegiatanPondok.groupBy({ by: ["status"], where: { tanggal: { gte: bulanIni }, ...(santriFilter ? { santriId: santriFilter } : {}) }, _count: true }),
            prisma.setoranTahfidz.count({ where: { tanggal: { gte: bulanIni } } }),
            prisma.absensiDiniyah.groupBy({ by: ["status"], where: { tanggal: { gte: bulanIni } }, _count: true }),
            prisma.pembinaanSantri.groupBy({ by: ["tipe"], where: { tanggal: { gte: bulanIni }, ...(santriFilter ? { santriId: santriFilter } : {}) }, _count: true }),
          ])
        const santriBars = santri.map((s) => ({ label: KEBERADAAN_LABEL[s.keberadaan as keyof typeof KEBERADAAN_LABEL] ?? s.keberadaan, nilai: s._count }))
        const kegBars = absensiKegiatan.map((a) => ({ label: `Kegiatan ${a.status}`, nilai: a._count }))
        const dinBars = absensiDiniyah.map((a) => ({ label: `Diniyah ${a.status}`, nilai: a._count }))
        const setBar = [{ label: "Setoran tahfidz (bln)", nilai: setoran }]
        const pembBars = pembinaan.map((p) => ({ label: `Pembinaan ${p.tipe}`, nilai: p._count }))
        return ok({
          tab,
          scopeSemua: scope.scopeSemua,
          rows: [...santriBars, ...kegBars, ...dinBars, ...setBar, ...pembBars],
          statistik,
          santri: santriBars,
          asrama: asrama.map((a) => ({ id: a.id, nama: a.nama, penghuni: a._count.santris })),
          totalKamar,
          kegiatan,
          absensiKegiatan: absensiKegiatan.map((a) => ({ status: a.status, nilai: a._count })),
          setoran,
          absensiDiniyah: absensiDiniyah.map((a) => ({ status: a.status, nilai: a._count })),
          pembinaan: pembinaan.map((p) => ({ label: p.tipe, nilai: p._count })),
          periodeDari: bulanIni.toISOString(),
        })
      }

      default:
        return fail("tab tidak dikenal", 400)
    }
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
