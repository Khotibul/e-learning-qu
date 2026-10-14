import { prisma } from "@/lib/prisma"
import {
  JENIS_IZIN_LABEL,
  STATUS_IZIN_LABEL,
  KEBERADAAN_LABEL,
  rekomendasikanIzin,
} from "@/lib/izin-santri"
import { requirePondok, scopeFilter, ok, fail, options } from "../_lib"

export { options }

type TabUstadz = "dashboard" | "jadwal" | "diniyah" | "halaqah" | "izin" | "laporan"

const TAB_PERM: Record<TabUstadz, Parameters<typeof requirePondok>[1]> = {
  dashboard: "pondok.dashboard.view",
  jadwal: "pondok.dashboard.view",
  diniyah: "pondok.diniyah.manage",
  halaqah: "pondok.tahfidz.manage",
  izin: "pondok.izin.view",
  laporan: "pondok.laporan.view",
}

/** Kelas diniyah yang dipegang user (pengampu atau assignment aktif). */
async function kelasSaya(userId: string) {
  return prisma.kelasDiniyah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    orderBy: [{ hari: "asc" }, { jam: "asc" }],
    select: { id: true, nama: true, tingkat: true, hari: true, jam: true },
  })
}

async function halaqahSaya(userId: string) {
  return prisma.halaqah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, tingkat: true, targetSurah: true },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tab = (url.searchParams.get("tab") || "dashboard") as TabUstadz
  const perm = TAB_PERM[tab]
  if (!perm) return fail("tab tidak dikenal", 400)

  const auth = await requirePondok(req, perm)
  if (auth.error) return auth.error
  const userId = auth.user.id

  try {
    switch (tab) {
      case "dashboard": {
        const [kelas, halaqah] = await Promise.all([kelasSaya(userId), halaqahSaya(userId)])
        const kelasIds = kelas.map((k) => k.id)
        const halaqahIds = halaqah.map((h) => h.id)
        const scope = await scopeFilter(userId)

        const hariIni = new Date()
        hariIni.setHours(0, 0, 0, 0)
        const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)

        const [santriBinaan, kegiatanDitugaskan, absensiDiniyahHariIni, absensiKegiatanHariIni, setoranTerbaru, targetHalaqah, izinBinaan] =
          await Promise.all([
            prisma.santri.count({ where: { deletedAt: null, status: "AKTIF", ...(scope.santriIdIn ? { id: { in: scope.santriIdIn } } : {}) } }),
            prisma.kegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok }, penanggungJawabId: userId } }),
            prisma.absensiDiniyah.count({ where: { kelasDiniyahId: { in: kelasIds }, tanggal: hariIni } }),
            prisma.absensiKegiatanPondok.count({ where: { tanggal: hariIni, kegiatan: { penanggungJawabId: userId } } }),
            prisma.setoranTahfidz.findMany({
              where: { halaqahId: { in: halaqahIds } },
              orderBy: { tanggal: "desc" },
              take: 10,
              select: {
                id: true,
                surah: true,
                ayatMulai: true,
                ayatAkhir: true,
                status: true,
                tanggal: true,
                santri: { select: { nama: true, nisNo: true } },
                halaqah: { select: { nama: true } },
              },
            }),
            prisma.halaqah.findMany({
              where: { id: { in: halaqahIds }, aktif: true },
              select: { id: true, nama: true, targetSurah: true, _count: { select: { santris: true } } },
            }),
            prisma.izinSantri.findMany({
              where: {
                ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}),
                status: { in: ["MENUNGGU_MUSYRIF", "DISETUJUI"] },
              },
              take: 20,
              select: { id: true, jenis: true, status: true, santri: { select: { nama: true } } },
            }),
          ])

        return ok({
          tab,
          kelasSaya: kelas,
          halaqahSaya: halaqah,
          santriBinaan,
          absensiBelumDiniyah: Math.max(kelasIds.length - absensiDiniyahHariIni, 0),
          absensiKegiatanTerisi: absensiKegiatanHariIni,
          kegiatanDitugaskan,
          setoranTerbaru: setoranTerbaru.map((s) => ({
            id: s.id,
            nama: s.santri.nama,
            halaqah: s.halaqah.nama,
            surah: s.surah,
            ayat: `${s.ayatMulai}-${s.ayatAkhir}`,
            status: s.status,
            tanggal: s.tanggal.toISOString(),
          })),
          targetHalaqah: targetHalaqah.map((h) => ({ id: h.id, nama: h.nama, targetSurah: h.targetSurah, jumlahSantri: h._count.santris })),
          izinTerkait: izinBinaan.map((i) => ({
            id: i.id,
            nama: i.santri.nama,
            jenis: JENIS_IZIN_LABEL[i.jenis],
            status: STATUS_IZIN_LABEL[i.status],
          })),
        })
      }

      case "jadwal": {
        const [kelas, halaqah] = await Promise.all([kelasSaya(userId), halaqahSaya(userId)])
        const hariIni = new Date()
        hariIni.setHours(0, 0, 0, 0)
        const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)
        const kegiatanHariIni = await prisma.kegiatanPondok.findMany({
          where: { tanggal: { gte: hariIni, lt: besok }, penanggungJawabId: userId },
          orderBy: { jamMulai: "asc" },
          select: { id: true, nama: true, jamMulai: true, jamSelesai: true, lokasi: true },
        })
        const halaqahCount = await prisma.halaqah.findMany({
          where: { id: { in: halaqah.map((h) => h.id) }, aktif: true },
          select: { id: true, _count: { select: { santris: true, setoran: true } } },
        })
        const countMap = new Map(halaqahCount.map((h) => [h.id, h._count]))
        return ok({
          tab,
          kelas: kelas.map((k) => ({ id: k.id, nama: k.nama, tingkat: k.tingkat, hari: k.hari, jam: k.jam })),
          halaqah: halaqah.map((h) => ({
            id: h.id,
            nama: h.nama,
            tingkat: h.tingkat,
            targetSurah: h.targetSurah,
            jumlahSantri: countMap.get(h.id)?.santris ?? 0,
            jumlahSetoran: countMap.get(h.id)?.setoran ?? 0,
          })),
          kegiatanHariIni,
        })
      }

      case "diniyah": {
        const kelasId = url.searchParams.get("kelasId")
        const tanggal = url.searchParams.get("tanggal") || new Date().toISOString().slice(0, 10)
        const rows = await kelasSaya(userId)
        if (!kelasId) return ok({ tab, kelas: rows })

        const akses = rows.find((k) => k.id === kelasId)
        if (!akses) return fail("Anda tidak mengampu kelas ini", 403)

        const tgl = new Date(tanggal)
        tgl.setHours(0, 0, 0, 0)
        const [santri, absensi] = await Promise.all([
          prisma.santri.findMany({
            where: { kelasDiniyahId: kelasId, deletedAt: null, status: "AKTIF" },
            select: { id: true, nama: true, nisNo: true, keberadaan: true },
            orderBy: { nama: "asc" },
          }),
          prisma.absensiDiniyah.findMany({ where: { kelasDiniyahId: kelasId, tanggal: tgl } }),
        ])
        const map = new Map(absensi.map((a) => [a.santriId, a]))
        return ok({
          tab,
          kelas: { id: akses.id, nama: akses.nama },
          tanggal: tgl.toISOString(),
          keberadaanLabel: KEBERADAAN_LABEL,
          rows: santri.map((s) => ({
            santriId: s.id,
            nama: s.nama,
            nisNo: s.nisNo,
            keberadaan: s.keberadaan,
            status: map.get(s.id)?.status ?? null,
            id: map.get(s.id)?.id ?? null,
          })),
        })
      }

      case "halaqah": {
        const halaqahId = url.searchParams.get("halaqahId")
        const mode = url.searchParams.get("mode")
        const opts = await halaqahSaya(userId)
        if (!halaqahId) return ok({ tab, halaqah: opts })

        if (!opts.find((h) => h.id === halaqahId)) return fail("Anda tidak membina halaqah ini", 403)

        if (mode === "capaian") {
          const [santri, setoran] = await Promise.all([
            prisma.santri.findMany({
              where: { halaqahId, deletedAt: null, status: "AKTIF" },
              select: { id: true, nama: true, nisNo: true },
            }),
            prisma.setoranTahfidz.findMany({ where: { halaqahId }, orderBy: { tanggal: "desc" } }),
          ])
          return ok({
            tab,
            rows: santri.map((s) => {
              const punya = setoran.filter((x) => x.santriId === s.id)
              const terakhir = punya[0]
              const dinilai = punya.filter((p) => p.tajwid != null)
              return {
                santriId: s.id,
                nama: s.nama,
                nisNo: s.nisNo,
                jumlahSetoran: punya.length,
                terakhir: terakhir
                  ? {
                      surah: terakhir.surah,
                      ayat: `${terakhir.ayatMulai}-${terakhir.ayatAkhir}`,
                      juz: terakhir.juz,
                      status: terakhir.status,
                      tanggal: terakhir.tanggal.toISOString(),
                      tajwid: terakhir.tajwid,
                      kelancaran: terakhir.kelancaran,
                    }
                  : null,
                rataTajwid: dinilai.length ? Math.round(dinilai.reduce((a, b) => a + (b.tajwid ?? 0), 0) / dinilai.length) : null,
                rataKelancaran: dinilai.length
                  ? Math.round(dinilai.reduce((a, b) => a + (b.kelancaran ?? 0), 0) / dinilai.length)
                  : null,
              }
            }),
          })
        }

        const pageNum = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
        const [data, total] = await Promise.all([
          prisma.setoranTahfidz.findMany({
            where: { halaqahId },
            orderBy: { tanggal: "desc" },
            skip: (pageNum - 1) * 20,
            take: 20,
            select: {
              id: true,
              surah: true,
              ayatMulai: true,
              ayatAkhir: true,
              juz: true,
              tipe: true,
              status: true,
              tajwid: true,
              kelancaran: true,
              catatan: true,
              tanggal: true,
              santri: { select: { nama: true, nisNo: true } },
            },
          }),
          prisma.setoranTahfidz.count({ where: { halaqahId } }),
        ])
        return ok({ tab, data, total, page: pageNum, totalPages: Math.max(1, Math.ceil(total / 20)) })
      }

      case "izin": {
        const scope = await scopeFilter(userId)
        const rows = await prisma.izinSantri.findMany({
          where: { ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}) },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            suratNomor: true,
            jenis: true,
            status: true,
            alasan: true,
            rencanaKeluar: true,
            rencanaKembali: true,
            createdAt: true,
            alasanKeputusan: true,
            santri: { select: { id: true, nama: true, nisNo: true, halaqah: { select: { nama: true } }, kelasDiniyah: { select: { nama: true } } } },
          },
        })
        return ok({
          tab,
          scopeSemua: scope.scopeSemua,
          rows,
          statusLabel: STATUS_IZIN_LABEL,
          jenisLabel: JENIS_IZIN_LABEL,
          keberadaanLabel: KEBERADAAN_LABEL,
        })
      }

      case "laporan": {
        const [kelas, halaqah] = await Promise.all([kelasSaya(userId), halaqahSaya(userId)])
        const mulaiBulan = new Date()
        mulaiBulan.setDate(1)
        mulaiBulan.setHours(0, 0, 0, 0)
        const kelasIds = kelas.map((k) => k.id)
        const halaqahIds = halaqah.map((h) => h.id)
        const [kehadiranDiniyah, setoran, penilaian] = await Promise.all([
          prisma.absensiDiniyah.groupBy({ by: ["status"], where: { kelasDiniyahId: { in: kelasIds }, tanggal: { gte: mulaiBulan } }, _count: true }),
          prisma.setoranTahfidz.groupBy({ by: ["status"], where: { halaqahId: { in: halaqahIds }, tanggal: { gte: mulaiBulan } }, _count: true }),
          prisma.setoranTahfidz.aggregate({
            where: { halaqahId: { in: halaqahIds }, tanggal: { gte: mulaiBulan }, tajwid: { not: null } },
            _avg: { tajwid: true, kelancaran: true },
            _count: true,
          }),
        ])
        return ok({
          tab,
          kehadiranDiniyah: kehadiranDiniyah.map((k) => ({ status: k.status, jumlah: k._count })),
          setoran: setoran.map((s) => ({ status: s.status, jumlah: s._count })),
          rataTajwid: penilaian._avg.tajwid ? Math.round(penilaian._avg.tajwid) : null,
          rataKelancaran: penilaian._avg.kelancaran ? Math.round(penilaian._avg.kelancaran) : null,
          jumlahDinilai: penilaian._count,
          periodeDari: mulaiBulan.toISOString(),
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { op } = body

  if (op === "rekomendasiIzin") {
    const auth = await requirePondok(req, "pondok.izin.recommend")
    if (auth.error) return auth.error
    const { izinId, rekomendasi, catatan } = body
    if (!izinId || !["SETUJUI", "TIDAK_SETUJUI"].includes(rekomendasi)) return fail("izinId/rekomendasi tidak valid", 400)
    try {
      const scope = await scopeFilter(auth.user.id)
      const izin = await prisma.izinSantri.findUnique({ where: { id: izinId }, select: { santriId: true } })
      if (!izin) return fail("Izin tidak ditemukan", 404)
      if (scope.santriIdIn && !scope.santriIdIn.includes(izin.santriId)) return fail("Santri di luar cakupan binaan Anda", 403)
      const hasil = await rekomendasikanIzin(izinId, auth.user.id, rekomendasi, String(catatan || "").trim())
      return ok({ success: true, hasil })
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Gagal", 400)
    }
  }

  if (op === "catatSetoran") {
    const auth = await requirePondok(req, "pondok.tahfidz.assess")
    if (auth.error) return auth.error
    const userId = auth.user.id
    const { halaqahId, santriId, surah, ayatMulai, ayatAkhir, juz, tipe, status, tajwid, kelancaran, catatan } = body
    try {
      const akses = await prisma.halaqah.findFirst({
        where: { id: halaqahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
        select: { id: true },
      })
      if (!akses) return fail("Anda tidak membina halaqah ini", 403)
      const santri = await prisma.santri.findFirst({ where: { id: santriId, halaqahId, deletedAt: null }, select: { id: true } })
      if (!santri) return fail("Santri tidak termasuk halaqah ini", 400)
      if (!String(surah || "").trim()) return fail("Surah wajib diisi", 400)
      if (!ayatMulai || !ayatAkhir || ayatAkhir < ayatMulai) return fail("Range ayat tidak valid", 400)
      const st = ["DITERIMA", "ULANG", "BERKELANJUTAN"].includes(String(status)) ? String(status) : "DITERIMA"
      const row = await prisma.setoranTahfidz.create({
        data: {
          halaqahId,
          santriId,
          surah: String(surah).trim(),
          ayatMulai,
          ayatAkhir,
          juz: juz ?? null,
          tipe: tipe === "MURAJAAH" ? "MURAJAAH" : "SETORAN",
          status: st as never,
          tajwid: tajwid ?? null,
          kelancaran: kelancaran ?? null,
          catatan: catatan || null,
          ustadzId: userId,
        },
      })
      return ok(row)
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Gagal", 400)
    }
  }

  return fail("op tidak dikenal", 400)
}
