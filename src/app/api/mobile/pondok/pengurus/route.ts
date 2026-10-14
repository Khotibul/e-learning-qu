import { prisma } from "@/lib/prisma"
import {
  JENIS_IZIN_LABEL,
  STATUS_IZIN_LABEL,
  KEBERADAAN_LABEL,
  getIzinMenunggu,
  setujuiIzin,
  tolakIzin,
  perbaruiIzinTerlambat,
} from "@/lib/izin-santri"
import { getPondokAccess } from "@/lib/pondok-rbac"
import { requirePondok, scopeFilter, ok, fail, options } from "../_lib"

export { options }

type TabPengurus = "dashboard" | "santri" | "izin" | "kegiatan" | "asrama" | "pembinaan" | "pengumuman" | "laporan"

const TAB_PERM: Record<TabPengurus, Parameters<typeof requirePondok>[1]> = {
  dashboard: "pondok.dashboard.view",
  santri: "pondok.santri.view",
  izin: "pondok.izin.view",
  kegiatan: "pondok.kegiatan.manage",
  asrama: "pondok.santri.view",
  pembinaan: "pondok.pembinaan.manage",
  pengumuman: "pondok.pengumuman.publish",
  laporan: "pondok.laporan.view",
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tab = (url.searchParams.get("tab") || "dashboard") as TabPengurus
  const perm = TAB_PERM[tab]
  if (!perm) return fail("tab tidak dikenal", 400)

  const auth = await requirePondok(req, perm)
  if (auth.error) return auth.error
  const userId = auth.user.id

  try {
    await perbaruiIzinTerlambat()
    const scope = await scopeFilter(userId)
    const santriWhere = scope.santriIdIn ? { id: { in: scope.santriIdIn } } : {}

    switch (tab) {
      case "dashboard": {
        const hariIni = new Date()
        hariIni.setHours(0, 0, 0, 0)
        const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)
        const base = { ...santriWhere, status: "AKTIF" as const, deletedAt: null }
        const [tanggungJawab, diPondok, sedangPulang, terlambat, izinMenunggu, izinAktif, kegiatanHariIni, absensiTerisiHariIni] =
          await Promise.all([
            prisma.santri.count({ where: base }),
            prisma.santri.count({ where: { ...base, keberadaan: "DI_PONDOK" } }),
            prisma.santri.count({ where: { ...base, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR", "DI_RUMAH", "DALAM_PERJALANAN"] } } }),
            prisma.santri.count({ where: { ...base, keberadaan: "TERLAMBAT_KEMBALI" } }),
            prisma.izinSantri.count({ where: { status: "MENUNGGU_PENGURUS", ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}) } }),
            prisma.izinSantri.count({ where: { status: "DISETUJUI", checkoutAt: null, ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}) } }),
            prisma.kegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
            prisma.absensiKegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
          ])
        return ok({
          tab,
          tanggungJawab,
          diPondok,
          sedangPulang,
          terlambat,
          izinMenunggu,
          izinAktif,
          kegiatanHariIni,
          absensiBelumLengkap: Math.max(kegiatanHariIni - absensiTerisiHariIni, 0),
          scopeSemua: scope.scopeSemua,
          keberadaanLabel: KEBERADAAN_LABEL,
        })
      }

      case "santri": {
        const q = url.searchParams.get("q")?.trim()
        const rows = await prisma.santri.findMany({
          where: {
            deletedAt: null,
            status: "AKTIF",
            ...santriWhere,
            ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
          },
          select: {
            id: true,
            nama: true,
            nisNo: true,
            keberadaan: true,
            status: true,
            asrama: { select: { nama: true } },
            kamar: { select: { nama: true } },
            halaqah: { select: { nama: true } },
            kelasDiniyah: { select: { nama: true } },
          },
          orderBy: { nama: "asc" },
          take: 200,
        })
        return ok({ tab, rows, keberadaanLabel: KEBERADAAN_LABEL, scopeSemua: scope.scopeSemua })
      }

      case "izin": {
        const mode = url.searchParams.get("mode") || "antrean"
        if (mode === "pulang") {
          const rows = await prisma.izinSantri.findMany({
            where: { status: "DISETUJUI", checkoutAt: { not: null }, checkinAt: null, ...santriWhere },
            orderBy: { rencanaKembali: "asc" },
            take: 100,
            select: {
              id: true,
              suratNomor: true,
              jenis: true,
              rencanaKembali: true,
              checkoutAt: true,
              namaPenjemput: true,
              hubunganPenjemput: true,
              santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } } } },
            },
          })
          return ok({ tab, mode, rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL })
        }
        const semua = await getIzinMenunggu("PENGURUS")
        const rows = scope.santriIdIn ? semua.filter((i) => scope.santriIdIn!.includes(i.santriId)) : semua
        return ok({ tab, mode, rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL })
      }

      case "kegiatan": {
        const tanggal = url.searchParams.get("tanggal")
        const rows = await prisma.kegiatanPondok.findMany({
          where: tanggal ? { tanggal: new Date(tanggal) } : {},
          orderBy: [{ tanggal: "desc" }],
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
        const kegiatanId = url.searchParams.get("kegiatanId")
        const list = rows.map((k) => ({
          id: k.id,
          nama: k.nama,
          tipe: k.tipe,
          tanggal: k.tanggal.toISOString(),
          jamMulai: k.jamMulai,
          jamSelesai: k.jamSelesai,
          lokasi: k.lokasi,
          deskripsi: k.deskripsi,
          wajib: k.wajib,
          penanggungJawab: k.penanggungJawab?.name ?? null,
          jumlahAbsensi: k._count.absensi,
        }))
        if (!kegiatanId) return ok({ tab, rows: list })

        const tgl = new Date(url.searchParams.get("tanggal") || new Date().toISOString().slice(0, 10))
        tgl.setHours(0, 0, 0, 0)
        const kegiatan = await prisma.kegiatanPondok.findUnique({ where: { id: kegiatanId }, select: { id: true, nama: true } })
        if (!kegiatan) return fail("Kegiatan tidak ditemukan", 404)
        const [santri, absensi] = await Promise.all([
          prisma.santri.findMany({
            where: { deletedAt: null, status: "AKTIF", ...santriWhere },
            select: { id: true, nama: true, nisNo: true, keberadaan: true },
            orderBy: { nama: "asc" },
          }),
          prisma.absensiKegiatanPondok.findMany({ where: { kegiatanId, tanggal: tgl } }),
        ])
        const map = new Map(absensi.map((a) => [a.santriId, a]))
        return ok({
          tab,
          rows: list,
          kegiatan,
          tanggal: tgl.toISOString(),
          absensiRows: santri.map((s) => ({
            santriId: s.id,
            nama: s.nama,
            nisNo: s.nisNo,
            keberadaan: s.keberadaan,
            status: map.get(s.id)?.status ?? null,
            keterangan: map.get(s.id)?.keterangan ?? null,
            id: map.get(s.id)?.id ?? null,
          })),
        })
      }

      case "asrama": {
        const akses = await getPondokAccess(userId)
        const asramaIds = scope.scopeSemua ? undefined : [...new Set(akses.scopes.map((s) => s.asramaId).filter((x): x is string => Boolean(x)))]
        const rows = await prisma.asrama.findMany({
          where: { aktif: true, ...(asramaIds ? { id: { in: asramaIds } } : {}) },
          orderBy: { nama: "asc" },
          select: {
            id: true,
            nama: true,
            musyrif: { select: { id: true, nama: true } },
            _count: { select: { santris: true } },
            kamars: { orderBy: { nama: "asc" }, select: { id: true, nama: true, kapasitas: true, _count: { select: { santris: true } } } },
          },
        })
        return ok({
          tab,
          rows: rows.map((a) => ({
            id: a.id,
            nama: a.nama,
            musyrif: a.musyrif?.nama ?? null,
            totalPenghuni: a._count.santris,
            kamars: a.kamars.map((k) => ({ id: k.id, nama: k.nama, kapasitas: k.kapasitas, terisi: k._count.santris })),
          })),
        })
      }

      case "pembinaan": {
        const santriId = url.searchParams.get("santriId")
        if (santriId) {
          const rows = await prisma.pembinaanSantri.findMany({
            where: { santriId },
            orderBy: { tanggal: "desc" },
            select: {
              id: true,
              tipe: true,
              judul: true,
              deskripsi: true,
              poin: true,
              tindakLanjut: true,
              status: true,
              tanggal: true,
              petugas: { select: { name: true } },
            },
          })
          return ok({ tab, rows })
        }
        const rows = await prisma.pembinaanSantri.findMany({
          where: { ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}) },
          orderBy: { tanggal: "desc" },
          take: 100,
          select: {
            id: true,
            tipe: true,
            judul: true,
            deskripsi: true,
            poin: true,
            status: true,
            tanggal: true,
            santri: { select: { id: true, nama: true, nisNo: true } },
            petugas: { select: { name: true } },
          },
        })
        return ok({ tab, rows, scopeSemua: scope.scopeSemua })
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
            userId: true,
            createdAt: true,
            approvedAt: true,
            user: { select: { name: true } },
          },
        })
        return ok({
          tab,
          rows: rows.map((r) => ({
            id: r.id,
            judul: r.judul,
            isi: r.isi,
            tipe: r.tipe,
            status: r.status,
            pembuat: r.user.name,
            milikSaya: r.userId === userId,
            createdAt: r.createdAt.toISOString(),
            approvedAt: r.approvedAt?.toISOString() ?? null,
          })),
        })
      }

      case "laporan": {
        const mulaiBulan = new Date()
        mulaiBulan.setDate(1)
        mulaiBulan.setHours(0, 0, 0, 0)
        const [kehadiran, izin, pembinaan] = await Promise.all([
          prisma.absensiKegiatanPondok.groupBy({ by: ["status"], where: { tanggal: { gte: mulaiBulan } }, _count: true }),
          prisma.izinSantri.groupBy({ by: ["status"], where: { createdAt: { gte: mulaiBulan }, ...santriWhere }, _count: true }),
          prisma.pembinaanSantri.groupBy({ by: ["tipe"], where: { tanggal: { gte: mulaiBulan }, ...(scope.santriIdIn ? { santriId: { in: scope.santriIdIn } } : {}) }, _count: true }),
        ])
        return ok({
          tab,
          kehadiran: kehadiran.map((k) => ({ status: k.status, jumlah: k._count })),
          izin: izin.map((i) => ({ status: i.status, jumlah: i._count })),
          pembinaan: pembinaan.map((p) => ({ tipe: p.tipe, jumlah: p._count })),
          periodeDari: mulaiBulan.toISOString(),
          scopeSemua: scope.scopeSemua,
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

  try {
    switch (op) {
      case "setujuiIzin": {
        const auth = await requirePondok(req, "pondok.izin.recommend")
        if (auth.error) return auth.error
        if (!body.izinId) return fail("izinId wajib", 400)
        const hasil = await setujuiIzin(body.izinId, "PENGURUS", auth.user.id, body.catatan)
        return ok({ success: true, hasil })
      }

      case "tolakIzin": {
        const auth = await requirePondok(req, "pondok.izin.reject")
        if (auth.error) return auth.error
        if (!body.izinId) return fail("izinId wajib", 400)
        if (String(body.alasan || "").trim().length < 3) return fail("Alasan penolakan minimal 3 karakter", 400)
        const hasil = await tolakIzin(body.izinId, "PENGURUS", auth.user.id, String(body.alasan).trim())
        return ok({ success: true, hasil })
      }

      case "createKegiatan": {
        const auth = await requirePondok(req, "pondok.kegiatan.manage")
        if (auth.error) return auth.error
        if (String(body.nama || "").trim().length < 3) return fail("Nama kegiatan minimal 3 karakter", 400)
        const tanggal = new Date(body.tanggal)
        if (isNaN(tanggal.getTime())) return fail("Tanggal kegiatan tidak valid", 400)
        tanggal.setHours(0, 0, 0, 0)
        const row = await prisma.kegiatanPondok.create({
          data: {
            nama: String(body.nama).trim(),
            tipe: body.tipe ?? "HARIAN",
            tanggal,
            jamMulai: body.jamMulai || null,
            jamSelesai: body.jamSelesai || null,
            lokasi: body.lokasi || null,
            deskripsi: body.deskripsi || null,
            wajib: Boolean(body.wajib),
            penanggungJawabId: auth.user.id,
          },
        })
        return ok(row)
      }

      case "deleteKegiatan": {
        const auth = await requirePondok(req, "pondok.kegiatan.manage")
        if (auth.error) return auth.error
        if (!body.id) return fail("id wajib", 400)
        const row = await prisma.kegiatanPondok.findUnique({ where: { id: body.id }, select: { id: true } })
        if (!row) return fail("Kegiatan tidak ditemukan", 404)
        await prisma.kegiatanPondok.delete({ where: { id: body.id } })
        return ok({ success: true })
      }

      case "simpanAbsensiKegiatan": {
        const auth = await requirePondok(req, "pondok.absensi.create")
        if (auth.error) return auth.error
        const { kegiatanId, tanggal, rows } = body
        if (!Array.isArray(rows) || rows.length === 0) return fail("Data absensi kosong", 400)
        const scope = await scopeFilter(auth.user.id)
        const tgl = new Date(tanggal)
        tgl.setHours(0, 0, 0, 0)
        await prisma.$transaction(async (tx) => {
          for (const r of rows) {
            if (scope.santriIdIn && !scope.santriIdIn.includes(r.santriId)) throw new Error("Santri di luar cakupan penugasan")
            await tx.absensiKegiatanPondok.upsert({
              where: { kegiatanId_tanggal_santriId: { kegiatanId, tanggal: tgl, santriId: r.santriId } },
              create: { kegiatanId, tanggal: tgl, santriId: r.santriId, status: r.status, keterangan: r.keterangan || null, pencatatId: auth.user.id },
              update: { status: r.status, keterangan: r.keterangan || null },
            })
          }
        })
        return ok({ success: true, jumlah: rows.length })
      }

      case "mutasiKamar": {
        const auth = await requirePondok(req, "pondok.santri.update")
        if (auth.error) return auth.error
        const { santriId, kamarId } = body
        if (!santriId) return fail("santriId wajib", 400)
        let asramaId: string | null = null
        if (kamarId) {
          const kamar = await prisma.kamar.findUnique({
            where: { id: kamarId },
            select: { id: true, asramaId: true, kapasitas: true, _count: { select: { santris: true } } },
          })
          if (!kamar) return fail("Kamar tidak ditemukan", 404)
          if (kamar.kapasitas && kamar._count.santris >= kamar.kapasitas) return fail("Kamar sudah penuh", 400)
          asramaId = kamar.asramaId
        }
        await prisma.santri.update({ where: { id: santriId }, data: { kamarId, asramaId } })
        return ok({ success: true })
      }

      case "createPembinaan": {
        const auth = await requirePondok(req, "pondok.pembinaan.manage")
        if (auth.error) return auth.error
        const { santriId, tipe, judul, deskripsi, poin, tindakLanjut } = body
        if (!santriId) return fail("santriId wajib", 400)
        if (String(judul || "").trim().length < 3) return fail("Judul minimal 3 karakter", 400)
        const t = ["PRESTASI", "PELANGGARAN", "CATATAN", "TINDAK_LANJUT"].includes(String(tipe)) ? String(tipe) : "CATATAN"
        const row = await prisma.pembinaanSantri.create({
          data: {
            santriId,
            tipe: t,
            judul: String(judul).trim(),
            deskripsi: deskripsi || null,
            poin: poin ?? null,
            tindakLanjut: tindakLanjut || null,
            petugasId: auth.user.id,
            status: t === "PELANGGARAN" || t === "TINDAK_LANJUT" ? "MENUNGGU" : "SELESAI",
          },
        })
        return ok(row)
      }

      case "createDraftPengumuman": {
        const auth = await requirePondok(req, "pondok.pengumuman.publish")
        if (auth.error) return auth.error
        if (String(body.judul || "").trim().length < 3) return fail("Judul minimal 3 karakter", 400)
        if (String(body.isi || "").trim().length < 5) return fail("Isi pengumuman minimal 5 karakter", 400)
        const row = await prisma.pengumuman.create({
          data: { judul: String(body.judul).trim(), isi: String(body.isi).trim(), tipe: body.tipe ?? "UMUM", userId: auth.user.id, status: "DRAFT" },
        })
        return ok(row)
      }

      case "kirimPengumuman": {
        const auth = await requirePondok(req, "pondok.pengumuman.publish")
        if (auth.error) return auth.error
        const upd = await prisma.pengumuman.updateMany({
          where: { id: body.id, userId: auth.user.id, status: "DRAFT", deletedAt: null },
          data: { status: "MENUNGGU" },
        })
        if (upd.count === 0) return fail("Hanya draft milik sendiri yang dapat dikirim untuk disetujui", 403)
        return ok({ success: true })
      }

      default:
        return fail("op tidak dikenal", 400)
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal", 400)
  }
}
