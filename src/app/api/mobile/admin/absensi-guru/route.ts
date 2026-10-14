import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { options, requireAdmin, ok, fail } from "../_lib"
import {
  dayStart,
  dayEnd,
  finalisasiSesiTanggal,
  getKebijakanAbsensi,
  hitungRekap,
  jamKeMenit,
  jalanRetensiFoto,
  nowMenit,
  resolveHari,
} from "@/lib/absensi-guru"
import type { StatusAbsensiGuruSesi } from "@prisma/client"

export { options }

/**
 * Mobile API Admin Absensi Guru — mirror dari server actions
 * src/app/(dashboard)/admin/absensi-guru/actions.ts untuk konsumen desktop.
 * GET ?view=monitoring|rekap|pengganti|pendukung
 * POST {op:"koreksi"|"buatPengganti"|"setPenggantiStatus"|"hapusPengganti"|"simpanKebijakan"}
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const q = new URL(req.url).searchParams
    const view = q.get("view") || "monitoring"

    if (view === "monitoring") {
      const tanggal = q.get("tanggal") || new Date().toISOString().slice(0, 10)
      const hari = resolveHari(tanggal)
      const date = dayStart(new Date(tanggal))

      await finalisasiSesiTanggal(null, tanggal)
      const nm = nowMenit()

      const [jadwal, pengajaran, pengganti, sesiRows] = await Promise.all([
        prisma.jadwalPelajaran.findMany({
          where: { hari, deletedAt: null },
          include: {
            kelas: { select: { id: true, nama: true } },
            mataPelajaran: { select: { id: true, nama: true } },
          },
        }),
        prisma.pengajaran.findMany({
          where: { deletedAt: null },
          select: { kelasId: true, mataPelajaranId: true, guruId: true, guru: { select: { id: true, nama: true } } },
        }),
        prisma.penggantiGuru.findMany({
          where: { tanggal: date, status: "DISETUJUI" },
          include: {
            asliGuru: { select: { nama: true } },
            pengganti: { select: { id: true, nama: true } },
            jadwal: { select: { kelasId: true, mataPelajaranId: true } },
          },
        }),
        prisma.absensiGuruSesi.findMany({
          where: { tanggal: date },
          include: { guru: { select: { nama: true } } },
        }),
      ])

      const sesiMap = new Map(sesiRows.map((s) => [`${s.guruId}|${s.jadwalPelajaranId}`, s]))
      const jadwalById = new Map(jadwal.map((j) => [j.id, j]))
      type Baris = {
        sesiId: string | null
        guruId: string
        guruNama: string
        jadwalId: string
        kelasId: string
        kelasNama: string
        mataPelajaranId: string
        mataPelajaranNama: string
        jamMulai: string
        jamSelesai: string
        status: string
        fase: "SEBELUM" | "AKTIF" | "SELESAI"
        jamMasuk: string | null
        jamKeluar: string | null
        durasiMenit: number | null
        terlambatMenit: number | null
        keterangan: string | null
        koreksiAlasan: string | null
        penggantiNama: string | null
        metode: string | null
        fotoUrl: string | null
        sidikJariVerified: boolean
      }
      const baris: Baris[] = []
      const sudah = new Set<string>()

      const push = (guruId: string, guruNama: string, j: (typeof jadwal)[number], penggantiNama: string | null) => {
        const key = `${guruId}|${j.id}`
        if (sudah.has(key)) return
        sudah.add(key)
        const rec = sesiMap.get(key)
        const mulai = jamKeMenit(j.jamMulai)
        const selesai = jamKeMenit(j.jamSelesai)
        const fase: Baris["fase"] = nm < mulai ? "SEBELUM" : nm <= selesai ? "AKTIF" : "SELESAI"
        baris.push({
          sesiId: rec?.id ?? null,
          guruId,
          guruNama,
          jadwalId: j.id,
          kelasId: j.kelas.id,
          kelasNama: j.kelas.nama,
          mataPelajaranId: j.mataPelajaran.id,
          mataPelajaranNama: j.mataPelajaran.nama,
          jamMulai: j.jamMulai,
          jamSelesai: j.jamSelesai,
          status: (rec?.status ?? "BELUM_ABSEN") as string,
          fase,
          jamMasuk: rec?.jamMasuk ?? null,
          jamKeluar: rec?.jamSelesai ?? null,
          durasiMenit: rec?.durasiMenit ?? null,
          terlambatMenit: rec?.terlambatMenit ?? null,
          keterangan: rec?.keterangan ?? null,
          koreksiAlasan: rec?.koreksiAlasan ?? null,
          penggantiNama,
          metode: rec?.metodeDigunakan ?? null,
          fotoUrl: rec?.fotoUrl ?? null,
          sidikJariVerified: rec?.sidikJariVerified ?? false,
        })
      }

      for (const j of jadwal) {
        for (const p of pengajaran) {
          if (p.kelasId === j.kelasId && p.mataPelajaranId === j.mataPelajaranId) {
            push(p.guruId, p.guru.nama, j, null)
          }
        }
      }
      for (const pg of pengganti) {
        const j = jadwalById.get(pg.jadwalPelajaranId)
        if (!j) continue
        push(pg.pengganti.id, pg.pengganti.nama, j, `menggantikan ${pg.asliGuru.nama}`)
      }

      let hasil = baris
      const guruId = q.get("guruId")
      const kelasId = q.get("kelasId")
      const mapelId = q.get("mataPelajaranId")
      const status = q.get("status")
      const search = q.get("search")
      if (guruId) hasil = hasil.filter((b) => b.guruId === guruId)
      if (kelasId) hasil = hasil.filter((b) => b.kelasId === kelasId)
      if (mapelId) hasil = hasil.filter((b) => b.mataPelajaranId === mapelId)
      if (status) hasil = hasil.filter((b) => b.status === status)
      if (search) {
        const s = search.toLowerCase()
        hasil = hasil.filter(
          (b) => b.guruNama.toLowerCase().includes(s) || b.kelasNama.toLowerCase().includes(s) || b.mataPelajaranNama.toLowerCase().includes(s)
        )
      }
      hasil.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai) || a.kelasNama.localeCompare(b.kelasNama))

      const summary = {
        total: hasil.length,
        hadir: hasil.filter((b) => b.status === "HADIR").length,
        terlambat: hasil.filter((b) => b.status === "TERLAMBAT").length,
        izin: hasil.filter((b) => b.status === "IZIN").length,
        sakit: hasil.filter((b) => b.status === "SAKIT").length,
        tidakHadir: hasil.filter((b) => b.status === "TIDAK_HADIR").length,
        belumAbsen: hasil.filter((b) => b.status === "BELUM_ABSEN").length,
        aktif: hasil.filter((b) => b.fase === "AKTIF").length,
      }

      const kebijakan = await getKebijakanAbsensi()
      await jalanRetensiFoto()
      return ok({ tanggal, hari, rows: hasil, summary, kebijakan })
    }

    if (view === "rekap") {
      const start = q.get("start") || new Date().toISOString().slice(0, 10)
      const end = q.get("end") || start
      const where: Record<string, unknown> = {
        tanggal: { gte: dayStart(new Date(start)), lte: dayEnd(new Date(end)) },
      }
      const guruId = q.get("guruId")
      if (guruId) where.guruId = guruId
      const jadwalWhere: Record<string, unknown> = {}
      const mapelWhere: Record<string, unknown> = {}
      const kelasId = q.get("kelasId")
      const mapelId = q.get("mataPelajaranId")
      const semesterId = q.get("semesterId")
      if (kelasId) jadwalWhere.kelasId = kelasId
      if (mapelId) mapelWhere.id = mapelId
      if (semesterId) mapelWhere.semesterId = semesterId
      if (Object.keys(mapelWhere).length > 0) jadwalWhere.mataPelajaran = mapelWhere
      if (Object.keys(jadwalWhere).length > 0) where.jadwal = jadwalWhere

      const rows = await prisma.absensiGuruSesi.findMany({
        where: where as never,
        include: {
          guru: { select: { id: true, nama: true, nip: true } },
          jadwal: {
            select: {
              jamMulai: true,
              jamSelesai: true,
              kelas: { select: { id: true, nama: true } },
              mataPelajaran: { select: { id: true, nama: true } },
            },
          },
        },
        orderBy: [{ tanggal: "desc" }, { jadwal: { jamMulai: "asc" } }],
        take: 2000,
      })

      const perGuru = new Map<string, { guruId: string; guruNama: string; rows: { status: StatusAbsensiGuruSesi; terlambatMenit: number | null }[] }>()
      for (const r of rows) {
        if (!perGuru.has(r.guruId)) perGuru.set(r.guruId, { guruId: r.guruId, guruNama: r.guru.nama, rows: [] })
        perGuru.get(r.guruId)!.rows.push({ status: r.status, terlambatMenit: r.terlambatMenit })
      }
      const rekapPerGuru = Array.from(perGuru.values()).map((x) => ({ guruId: x.guruId, guruNama: x.guruNama, ...hitungRekap(x.rows) }))
      rekapPerGuru.sort((a, b) => b.rataKehadiranPersen - a.rataKehadiranPersen)
      return ok({
        rows: rows.map((r) => ({
          id: r.id,
          tanggal: r.tanggal.toISOString().slice(0, 10),
          guruId: r.guruId,
          guruNama: r.guru.nama,
          status: r.status,
          jamMasuk: r.jamMasuk,
          jamSelesai: r.jamSelesai,
          terlambatMenit: r.terlambatMenit,
          kelasNama: r.jadwal?.kelas?.nama ?? "-",
          mataPelajaranNama: r.jadwal?.mataPelajaran?.nama ?? "-",
          jamMulai: r.jadwal?.jamMulai ?? "",
        })),
        rekapPerGuru,
        total: hitungRekap(rows),
      })
    }

    if (view === "pengganti") {
      const tanggal = q.get("tanggal")
      const date = tanggal ? dayStart(new Date(tanggal)) : undefined
      const rows = await prisma.penggantiGuru.findMany({
        where: date ? { tanggal: date } : {},
        include: {
          asliGuru: { select: { id: true, nama: true } },
          pengganti: { select: { id: true, nama: true } },
          jadwal: {
            select: {
              jamMulai: true,
              jamSelesai: true,
              hari: true,
              kelas: { select: { nama: true } },
              mataPelajaran: { select: { nama: true } },
            },
          },
        },
        orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
        take: 200,
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          tanggal: r.tanggal.toISOString().slice(0, 10),
          alasan: r.alasan,
          status: r.status,
          asliGuruId: r.asliGuru.id,
          asliGuruNama: r.asliGuru.nama,
          penggantiNama: r.pengganti.nama,
          hari: r.jadwal?.hari ?? "",
          jamMulai: r.jadwal?.jamMulai ?? "",
          jamSelesai: r.jadwal?.jamSelesai ?? "",
          kelasNama: r.jadwal?.kelas?.nama ?? "-",
          mataPelajaranNama: r.jadwal?.mataPelajaran?.nama ?? "-",
        }))
      )
    }

    if (view === "pendukung") {
      const [guru, kelas, mapel] = await Promise.all([
        prisma.guru.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, absensiMetode: true }, orderBy: { nama: "asc" } }),
        prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
        prisma.mataPelajaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
      ])
      return ok({ guru, kelas, mapel })
    }

    return fail("view tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/absensi-guru GET error:", e)
    return fail("Gagal memuat data absensi guru", 500)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const op = String(body.op || "")

    if (op === "koreksi") {
      const alasan = String(body.alasan || "").trim()
      const status = String(body.status || "")
      if (alasan.length < 3) return fail("Alasan koreksi wajib diisi (min. 3 huruf)", 400)
      if (!["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "TIDAK_HADIR"].includes(status)) return fail("Status tidak valid", 400)

      const sesiId = body.sesiId ? String(body.sesiId) : null
      const existing = sesiId ? await prisma.absensiGuruSesi.findUnique({ where: { id: sesiId } }) : null
      const guruId = body.guruId ? String(body.guruId) : null
      const jadwalPelajaranId = body.jadwalPelajaranId ? String(body.jadwalPelajaranId) : null
      const tanggal = body.tanggal ? String(body.tanggal) : null
      const jamMasuk = body.jamMasuk != null ? String(body.jamMasuk) : null
      const jamSelesai = body.jamSelesai != null ? String(body.jamSelesai) : null
      const keterangan = body.keterangan != null ? String(body.keterangan) : null

      const admin = await prisma.guru.findFirst({
        where: { user: { id: auth.user.id }, deletedAt: null },
        select: { id: true },
      })
      const koreksiBy = admin?.id ?? null

      if (!existing) {
        if (!guruId || !jadwalPelajaranId || !tanggal) return fail("Data absensi tidak ditemukan", 400)
        const created = await prisma.absensiGuruSesi.create({
          data: {
            guruId,
            jadwalPelajaranId,
            tanggal: dayStart(new Date(tanggal)),
            status: status as StatusAbsensiGuruSesi,
            jamMasuk,
            jamSelesai,
            keterangan,
            koreksiAlasan: alasan,
            koreksiBy,
          },
        })
        await prisma.absensiGuruLog.create({
          data: {
            absensiGuruSesiId: created.id,
            actorGuruId: koreksiBy ?? created.guruId,
            aksi: koreksiBy ? "KOREKSI_BARU" : `KOREKSI_ADMIN (${auth.user.email})`,
            alasan,
            dataBaru: { status, jamMasuk, jamSelesai } as never,
          },
        })
        return ok({ success: true, created: true })
      }

      await prisma.absensiGuruSesi.update({
        where: { id: existing.id },
        data: {
          status: status as StatusAbsensiGuruSesi,
          jamMasuk: jamMasuk ?? existing.jamMasuk,
          jamSelesai: jamSelesai ?? existing.jamSelesai,
          keterangan: keterangan ?? existing.keterangan,
          koreksiAlasan: alasan,
          koreksiBy,
        },
      })
      await prisma.absensiGuruLog.create({
        data: {
          absensiGuruSesiId: existing.id,
          actorGuruId: koreksiBy ?? existing.guruId,
          aksi: koreksiBy ? "KOREKSI" : `KOREKSI_ADMIN (${auth.user.email})`,
          alasan,
          dataLama: { status: existing.status, jamMasuk: existing.jamMasuk, jamSelesai: existing.jamSelesai, keterangan: existing.keterangan } as never,
          dataBaru: { status, jamMasuk: jamMasuk ?? existing.jamMasuk, jamSelesai: jamSelesai ?? existing.jamSelesai, keterangan: keterangan ?? existing.keterangan } as never,
        },
      })
      return ok({ success: true })
    }

    if (op === "buatPengganti") {
      const jadwalPelajaranId = String(body.jadwalPelajaranId || "")
      const tanggalRaw = String(body.tanggal || "")
      const asliGuruId = String(body.asliGuruId || "")
      const penggantiGuruId = String(body.penggantiGuruId || "")
      const alasan = String(body.alasan || "").trim()
      if (asliGuruId === penggantiGuruId) return fail("Guru pengganti harus berbeda dari guru asli", 400)
      if (!alasan) return fail("Alasan wajib diisi", 400)
      const jadwal = await prisma.jadwalPelajaran.findUnique({ where: { id: jadwalPelajaranId }, select: { id: true } })
      if (!jadwal) return fail("Jadwal tidak ditemukan", 404)
      const tanggal = dayStart(new Date(tanggalRaw))
      const dup = await prisma.penggantiGuru.findUnique({
        where: { jadwalPelajaranId_tanggal: { jadwalPelajaranId, tanggal } },
      })
      if (dup) return fail("Sudah ada pengganti untuk sesi ini", 409)
      await prisma.penggantiGuru.create({
        data: { jadwalPelajaranId, tanggal, asliGuruId, penggantiGuruId, alasan, status: "DISETUJUI" },
      })
      return ok({ success: true })
    }

    if (op === "setPenggantiStatus") {
      const id = String(body.id || "")
      const status = String(body.status || "")
      if (!["DISETUJUI", "DITOLAK"].includes(status)) return fail("Status tidak valid", 400)
      await prisma.penggantiGuru.update({ where: { id }, data: { status } })
      return ok({ success: true })
    }

    if (op === "hapusPengganti") {
      await prisma.penggantiGuru.delete({ where: { id: String(body.id || "") } })
      return ok({ success: true })
    }

    if (op === "simpanKebijakan") {
      const toleransi = Math.max(0, Math.min(120, Math.round(Number(body.toleransiTerlambatMenit) || 0)))
      const auto = Math.max(0, Math.min(480, Math.round(Number(body.autoTidakHadirSetelahMenit) || 0)))
      const payload = { toleransiTerlambatMenit: toleransi, autoTidakHadirSetelahMenit: auto }
      const existing = await prisma.siteConfig.findFirst({ select: { id: true } })
      if (existing) await prisma.siteConfig.update({ where: { id: existing.id }, data: payload })
      else await prisma.siteConfig.create({ data: payload })
      return ok(await getKebijakanAbsensi())
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/absensi-guru POST error:", e)
    return fail(e instanceof Error ? e.message : "Gagal memproses", 500)
  }
}
