import { prisma } from "@/lib/prisma"
import { ymd } from "@/lib/utils"
import { options, requireAdmin, ok, fail } from "../_lib"
import { buatApiKey, hashApiKey, hariTanggal, audit, putuskanAbsensiManual } from "@/lib/absensi-harian"

export { options }

/**
 * Mobile API Admin Fingerprint & Absensi Harian — mirror dari
 * src/app/(dashboard)/admin/fingerprint/actions.ts untuk konsumen desktop.
 * GET  ?view=perangkat|pemetaan|cari-siswa|monitoring|events|permintaan
 * POST {op:"buatPerangkat"|"ubahPerangkat"|"hapusPerangkat"|"rotasiApiKey"|
 *        "tambahPemetaan"|"hapusPemetaan"|"putuskanPermintaan"}
 */
function hariIniDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const q = new URL(req.url).searchParams
    const view = q.get("view") || "perangkat"

    if (view === "perangkat") {
      const rows = await prisma.perangkatFingerprint.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { pemetaan: true, events: true } } },
      })
      const scanHariIni = await prisma.fingerprintEvent.groupBy({
        by: ["perangkatId"],
        where: { serverAt: { gte: hariIniDate() } },
        _count: { _all: true },
      })
      const map = new Map(scanHariIni.map((s) => [s.perangkatId, s._count._all]))
      return ok(
        rows.map((r) => ({
          id: r.id,
          kode: r.kode,
          nama: r.nama,
          lokasi: r.lokasi,
          status: r.status,
          lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
          lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
          jumlahSiswa: r._count.pemetaan,
          totalEvent: r._count.events,
          scanHariIni: map.get(r.id) ?? 0,
          createdAt: r.createdAt.toISOString(),
        }))
      )
    }

    if (view === "pemetaan") {
      const perangkatId = q.get("perangkatId")
      if (!perangkatId) return fail("perangkatId wajib", 400)
      const rows = await prisma.pemetaanFingerprint.findMany({
        where: { perangkatId },
        include: {
          siswa: { select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } } },
          user: { select: { id: true, name: true, image: true, guru: { select: { nama: true, nip: true } }, biodata: { select: { fotoThumbId: true } } } },
        },
        orderBy: { createdAt: "desc" },
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          perangkatUserId: r.perangkatUserId,
          siswaId: r.siswaId,
          userId: r.userId,
          tipeIdentitas: r.siswaId ? "SISWA" : r.userId ? "GURU_PEGAWAI" : "TIDAK_DIKENAL",
          nama: r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? "(tanpa identitas)",
          nis: r.siswa?.nis ?? r.user?.guru?.nip ?? null,
          kelas: r.siswa?.kelas?.nama ?? "-",
          fotoThumbUrl: r.user?.biodata?.fotoThumbId ? `/api/upload/${r.user.biodata.fotoThumbId}` : null,
          createdAt: r.createdAt.toISOString(),
        }))
      )
    }

    if (view === "cari-siswa") {
      const kata = (q.get("q") || "").trim()
      if (kata.length < 2) return ok([])
      const rows = await prisma.siswa.findMany({
        where: {
          deletedAt: null,
          OR: [{ nama: { contains: kata, mode: "insensitive" } }, { nis: { contains: kata } }],
        },
        select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
        take: 10,
        orderBy: { nama: "asc" },
      })
      return ok(rows.map((r) => ({ id: r.id, nama: r.nama, nis: r.nis, kelas: r.kelas?.nama ?? "-" })))
    }

    if (view === "monitoring") {
      const tanggalParam = q.get("tanggal") || ymd()
      const kelasId = q.get("kelasId")
      const statusFilter = q.get("status")
      const kata = (q.get("q") || "").trim().toLowerCase()
      const tanggal = hariTanggal(new Date(tanggalParam))
      const where: Record<string, unknown> = { tanggal }
      if (kelasId) where.siswa = { kelasId }

      const rows = await prisma.absensiHarianSiswa.findMany({
        where: where as never,
        include: {
          siswa: {
            select: {
              id: true, nama: true, nis: true, kelasId: true, kelas: { select: { nama: true } },
              user: { select: { image: true, biodata: { select: { fotoThumbId: true } } } },
            },
          },
          eventMasuk: { select: { eventKey: true, perangkat: { select: { nama: true } } } },
          eventPulang: { select: { eventKey: true, perangkat: { select: { nama: true } } } },
        },
        orderBy: [{ jamMasuk: "asc" }, { siswa: { nama: "asc" } }],
        take: 1000,
      })

      type Baris = {
        id: string | null
        siswaId: string
        nama: string
        nis: string | null
        kelasId: string | null
        kelas: string
        fotoUrl: string | null
        fotoThumbUrl: string | null
        jamMasuk: string | null
        jamPulang: string | null
        statusMasuk: string | null
        statusPulang: string | null
        terlambatMenit: number | null
        sumberMasuk: string | null
        sumberPulang: string | null
        perangkatMasuk: string | null
        perangkatPulang: string | null
        koreksiAlasan: string | null
      }

      let list: Baris[] = rows.map((r) => ({
        id: r.id,
        siswaId: r.siswa.id,
        nama: r.siswa.nama,
        nis: r.siswa.nis,
        kelasId: r.siswa.kelasId,
        kelas: r.siswa.kelas?.nama ?? "-",
        fotoUrl: r.siswa.user?.image ?? null,
        fotoThumbUrl: r.siswa.user?.biodata?.fotoThumbId ? `/api/upload/${r.siswa.user.biodata.fotoThumbId}` : (r.siswa.user?.image ?? null),
        jamMasuk: r.jamMasuk,
        jamPulang: r.jamPulang,
        statusMasuk: r.statusMasuk,
        statusPulang: r.statusPulang,
        terlambatMenit: r.terlambatMenit,
        sumberMasuk: r.sumberMasuk,
        sumberPulang: r.sumberPulang,
        perangkatMasuk: r.eventMasuk?.perangkat?.nama ?? null,
        perangkatPulang: r.eventPulang?.perangkat?.nama ?? null,
        koreksiAlasan: r.koreksiAlasan,
      }))
      if (kata) list = list.filter((r) => r.nama.toLowerCase().includes(kata) || (r.nis ?? "").includes(kata))
      if (statusFilter === "BELUM") list = list.filter((r) => !r.jamMasuk)
      if (statusFilter === "MASUK") list = list.filter((r) => !!r.jamMasuk && !r.jamPulang)
      if (statusFilter === "PULANG") list = list.filter((r) => !!r.jamPulang)
      if (statusFilter === "TERLAMBAT") list = list.filter((r) => r.statusMasuk === "TERLAMBAT")

      const sudah = new Set(list.map((r) => r.siswaId))
      const semuaSiswa = await prisma.siswa.findMany({
        where: { deletedAt: null, ...(kelasId ? { kelasId } : {}) },
        select: { id: true, nama: true, nis: true, kelasId: true, kelas: { select: { nama: true } }, user: { select: { image: true, biodata: { select: { fotoThumbId: true } } } } },
        orderBy: { nama: "asc" },
        take: 2000,
      })
      const belum: Baris[] = semuaSiswa
        .filter((s) => !sudah.has(s.id) && !rows.some((r) => r.siswaId === s.id))
        .map((s) => ({
          id: null,
          siswaId: s.id,
          nama: s.nama,
          nis: s.nis,
          kelasId: s.kelasId,
          kelas: s.kelas?.nama ?? "-",
          fotoUrl: s.user?.image ?? null,
          fotoThumbUrl: s.user?.biodata?.fotoThumbId ? `/api/upload/${s.user.biodata.fotoThumbId}` : (s.user?.image ?? null),
          jamMasuk: null,
          jamPulang: null,
          statusMasuk: null,
          statusPulang: null,
          terlambatMenit: null,
          sumberMasuk: null,
          sumberPulang: null,
          perangkatMasuk: null,
          perangkatPulang: null,
          koreksiAlasan: null,
        }))
        .filter((s) => (kata ? s.nama.toLowerCase().includes(kata) || (s.nis ?? "").includes(kata) : true))

      const gabung = [...list, ...belum]
      const summary = {
        totalSiswa: semuaSiswa.length,
        masuk: gabung.filter((r) => r.jamMasuk).length,
        belumMasuk: gabung.filter((r) => !r.jamMasuk).length,
        terlambat: gabung.filter((r) => r.statusMasuk === "TERLAMBAT").length,
        pulang: gabung.filter((r) => r.jamPulang).length,
        pulangAwal: gabung.filter((r) => r.statusPulang === "AWAL").length,
      }
      return ok({ tanggal: ymd(tanggal), rows: gabung, summary })
    }

    if (view === "events") {
      const tanggal = hariTanggal(new Date(q.get("tanggal") || ymd()))
      const take = Math.min(Number(q.get("take")) || 200, 500)
      const rows = await prisma.fingerprintEvent.findMany({
        where: { serverAt: { gte: tanggal, lt: new Date(tanggal.getTime() + 86400000) } },
        include: {
          siswa: { select: { nama: true, nis: true } },
          user: { select: { name: true, image: true, guru: { select: { nama: true, nip: true } }, biodata: { select: { fotoThumbId: true } } } },
          perangkat: { select: { nama: true, kode: true } },
        },
        orderBy: { serverAt: "desc" },
        take,
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          eventKey: r.eventKey,
          perangkat: r.perangkat?.nama ?? "-",
          kode: r.perangkat?.kode ?? "-",
          nama: r.siswa?.nama ?? r.user?.guru?.nama ?? r.user?.name ?? null,
          nis: r.siswa?.nis ?? r.user?.guru?.nip ?? null,
          // TIDAK_DIKENAL = belum teridentifikasi — jangan ditautkan sembarangan
          teridentifikasi: !!(r.siswaId || r.userId),
          fotoThumbUrl: r.user?.biodata?.fotoThumbId ? `/api/upload/${r.user.biodata.fotoThumbId}` : (r.user?.image ?? null),
          tipe: r.tipe,
          status: r.status,
          pesan: r.pesan,
          deviceAt: r.deviceAt?.toISOString() ?? null,
          serverAt: r.serverAt.toISOString(),
        }))
      )
    }

    if (view === "permintaan") {
      const status = q.get("status")
      const rows = await prisma.permintaanAbsensiManual.findMany({
        where: status ? { status } : {},
        include: { siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          nama: r.siswa.nama,
          nis: r.siswa.nis,
          kelas: r.siswa.kelas?.nama ?? "-",
          tanggal: ymd(r.tanggal),
          tipe: r.tipe,
          alasan: r.alasan,
          status: r.status,
          catatanAdmin: r.catatanAdmin,
          createdAt: r.createdAt.toISOString(),
        }))
      )
    }

    return fail("view tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/fingerprint GET error:", e)
    return fail("Gagal memuat data fingerprint", 500)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const op = String(body.op || "")

    if (op === "buatPerangkat") {
      const nama = String(body.nama ?? "").trim()
      if (nama.length < 3) return fail("Nama perangkat wajib (min. 3 karakter)", 400)
      const kode = "FP-" + Math.random().toString(36).slice(2, 8).toUpperCase()
      const apiKey = buatApiKey()
      const row = await prisma.perangkatFingerprint.create({
        data: { kode, nama, lokasi: String(body.lokasi ?? "").trim() || null, apiKeyHash: hashApiKey(apiKey) },
      })
      await audit(auth.user.id, "BUAT_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", row.id, { kode, nama })
      return ok({ id: row.id, kode, apiKey })
    }

    if (op === "ubahPerangkat") {
      const id = String(body.id || "")
      const lama = await prisma.perangkatFingerprint.findUnique({ where: { id } })
      if (!lama) return fail("Perangkat tidak ditemukan", 404)
      const status = body.status != null ? String(body.status) : undefined
      if (status && !["AKTIF", "NONAKTIF"].includes(status)) return fail("Status tidak valid", 400)
      const data: Record<string, unknown> = {}
      if (body.nama !== undefined) data.nama = String(body.nama).trim()
      if (body.lokasi !== undefined) data.lokasi = String(body.lokasi).trim() || null
      if (status !== undefined) data.status = status
      await prisma.perangkatFingerprint.update({ where: { id }, data })
      await audit(auth.user.id, "UBAH_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", id, { lama: { nama: lama.nama, status: lama.status }, baru: data })
      return ok({ success: true })
    }

    if (op === "hapusPerangkat") {
      const id = String(body.id || "")
      const lama = await prisma.perangkatFingerprint.findUnique({ where: { id }, select: { kode: true, nama: true } })
      if (!lama) return fail("Perangkat tidak ditemukan", 404)
      await prisma.perangkatFingerprint.delete({ where: { id } })
      await audit(auth.user.id, "HAPUS_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", id, { kode: lama.kode, nama: lama.nama })
      return ok({ success: true })
    }

    if (op === "rotasiApiKey") {
      const id = String(body.id || "")
      const apiKey = buatApiKey()
      await prisma.perangkatFingerprint.update({ where: { id }, data: { apiKeyHash: hashApiKey(apiKey) } })
      await audit(auth.user.id, "ROTASI_APIKEY_FINGERPRINT", "PerangkatFingerprint", id, {})
      return ok({ apiKey })
    }

    if (op === "tambahPemetaan") {
      const perangkatId = String(body.perangkatId || "")
      const siswaId = String(body.siswaId || "")
      const uid = String(body.perangkatUserId ?? "").trim()
      if (!uid) return fail("UID sidik jari di mesin wajib diisi", 400)
      if (uid.length > 32) return fail("UID maksimal 32 karakter", 400)
      const perangkat = await prisma.perangkatFingerprint.findUnique({ where: { id: perangkatId } })
      if (!perangkat) return fail("Perangkat tidak ditemukan", 404)
      const siswa = await prisma.siswa.findFirst({ where: { id: siswaId, deletedAt: null }, select: { id: true, nama: true } })
      if (!siswa) return fail("Siswa tidak ditemukan", 404)
      const dup = await prisma.pemetaanFingerprint.findFirst({
        where: { OR: [{ perangkatId, perangkatUserId: uid }, { perangkatId, siswaId }] },
        select: { perangkatUserId: true, siswaId: true },
      })
      if (dup) return fail(dup.perangkatUserId === uid ? "UID sudah terdaftar di perangkat ini" : "Siswa sudah terpetakan di perangkat ini", 409)
      await prisma.pemetaanFingerprint.create({ data: { perangkatId, siswaId, perangkatUserId: uid } })
      await audit(auth.user.id, "TAMBAH_PEMETAAN_FINGERPRINT", "PemetaanFingerprint", perangkatId, { siswaId, uid })
      return ok({ success: true })
    }

    // Pemetaan UID mesin ↔ identitas non-siswa (guru/pegawai/pembina).
    // Identitas orang = User (satu sumber); scan tercatat sebagai event
    // teridentifikasi tanpa menautkan ke siswa lain secara sembarangan.
    if (op === "tambahPemetaanUser") {
      const perangkatId = String(body.perangkatId || "")
      const userId = String(body.userId || "")
      const uid = String(body.perangkatUserId ?? "").trim()
      if (!uid) return fail("UID sidik jari di mesin wajib diisi", 400)
      if (uid.length > 32) return fail("UID maksimal 32 karakter", 400)
      const perangkat = await prisma.perangkatFingerprint.findUnique({ where: { id: perangkatId } })
      if (!perangkat) return fail("Perangkat tidak ditemukan", 404)
      const user = await prisma.user.findFirst({
        where: { id: userId, isActive: true },
        select: { id: true, name: true, guru: { select: { nama: true } } },
      })
      if (!user) return fail("User tidak ditemukan", 404)
      const dup = await prisma.pemetaanFingerprint.findFirst({
        where: { OR: [{ perangkatId, perangkatUserId: uid }, { perangkatId, userId }] },
        select: { perangkatUserId: true, userId: true },
      })
      if (dup) return fail(dup.perangkatUserId === uid ? "UID sudah terdaftar di perangkat ini" : "User sudah terpetakan di perangkat ini", 409)
      await prisma.pemetaanFingerprint.create({ data: { perangkatId, userId, siswaId: null, perangkatUserId: uid } })
      await audit(auth.user.id, "TAMBAH_PEMETAAN_FINGERPRINT_USER", "PemetaanFingerprint", perangkatId, { userId, uid })
      return ok({ success: true })
    }

    if (op === "hapusPemetaan") {
      const id = String(body.id || "")
      const row = await prisma.pemetaanFingerprint.findUnique({ where: { id }, select: { siswaId: true, perangkatUserId: true } })
      if (!row) return fail("Pemetaan tidak ditemukan", 404)
      await prisma.pemetaanFingerprint.delete({ where: { id } })
      await audit(auth.user.id, "HAPUS_PEMETAAN_FINGERPRINT", "PemetaanFingerprint", id, { siswaId: row.siswaId, uid: row.perangkatUserId })
      return ok({ success: true })
    }

    if (op === "putuskanPermintaan") {
      const permintaanId = String(body.permintaanId || "")
      const putusan = String(body.putusan || "")
      if (!["DISETUJUI", "DITOLAK"].includes(putusan)) return fail("Putusan tidak valid", 400)
      const hasil = await putuskanAbsensiManual({
        permintaanId,
        putusan: putusan as "DISETUJUI" | "DITOLAK",
        catatan: body.catatan != null ? String(body.catatan) : undefined,
        actorUserId: auth.user.id,
      })
      return ok({ success: true, ...hasil })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/fingerprint POST error:", e)
    return fail(e instanceof Error ? e.message : "Gagal memproses", 500)
  }
}
