"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buatApiKey, hashApiKey, putuskanAbsensiManual, koreksiAbsensiHarian, getKebijakanHarian, hariTanggal, audit } from "@/lib/absensi-harian"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Akses ditolak")
  return session.user
}

// ─── PERANGKAT ─────────────────────────────────────────────────────

export async function daftarPerangkat() {
  await requireAdmin()
  const rows = await prisma.perangkatFingerprint.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pemetaan: true, events: true } } },
  })
  const hariIni = hariIniDate()
  const scanHariIni = await prisma.fingerprintEvent.groupBy({
    by: ["perangkatId"],
    where: { serverAt: { gte: hariIni } },
    _count: { _all: true },
  })
  const map = new Map(scanHariIni.map((s) => [s.perangkatId, s._count._all]))
  return rows.map((r) => ({
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
}

function hariIniDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Mendaftarkan perangkat baru — API key ditampilkan SEKALI saja (hanya hash disimpan). */
export async function buatPerangkat(input: { nama: string; lokasi?: string }) {
  const admin = await requireAdmin()
  const nama = String(input.nama ?? "").trim()
  if (nama.length < 3) throw new Error("Nama perangkat wajib (min. 3 karakter)")

  const kode = "FP-" + Math.random().toString(36).slice(2, 8).toUpperCase()
  const apiKey = buatApiKey()
  const row = await prisma.perangkatFingerprint.create({
    data: { kode, nama, lokasi: input.lokasi?.trim() || null, apiKeyHash: hashApiKey(apiKey) },
  })
  await audit(admin.id, "BUAT_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", row.id, { kode, nama })
  revalidatePath("/admin/fingerprint")
  return { id: row.id, kode, apiKey } // apiKey hanya dikembalikan sekali
}

export async function ubahPerangkat(id: string, input: { nama?: string; lokasi?: string; status?: string }) {
  const admin = await requireAdmin()
  const lama = await prisma.perangkatFingerprint.findUnique({ where: { id } })
  if (!lama) throw new Error("Perangkat tidak ditemukan")
  if (input.status && !["AKTIF", "NONAKTIF"].includes(input.status)) throw new Error("Status tidak valid")

  const data: Record<string, unknown> = {}
  if (input.nama !== undefined) data.nama = input.nama.trim()
  if (input.lokasi !== undefined) data.lokasi = input.lokasi.trim() || null
  if (input.status !== undefined) data.status = input.status
  const baru = await prisma.perangkatFingerprint.update({ where: { id }, data })
  await audit(admin.id, "UBAH_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", id, { lama: { nama: lama.nama, status: lama.status }, baru: { nama: baru.nama, status: baru.status } })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function hapusPerangkat(id: string) {
  const admin = await requireAdmin()
  const lama = await prisma.perangkatFingerprint.findUnique({ where: { id }, select: { kode: true, nama: true } })
  if (!lama) throw new Error("Perangkat tidak ditemukan")
  await prisma.perangkatFingerprint.delete({ where: { id } })
  await audit(admin.id, "HAPUS_PERANGKAT_FINGERPRINT", "PerangkatFingerprint", id, { kode: lama.kode, nama: lama.nama })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function rotasiApiKey(id: string) {
  const admin = await requireAdmin()
  const apiKey = buatApiKey()
  await prisma.perangkatFingerprint.update({ where: { id }, data: { apiKeyHash: hashApiKey(apiKey) } })
  await audit(admin.id, "ROTASI_APIKEY_FINGERPRINT", "PerangkatFingerprint", id, {})
  return { apiKey }
}

// ─── PEMETAAN UID ↔ SISWA ─────────────────────────────────────────

export async function daftarPemetaan(perangkatId: string) {
  await requireAdmin()
  return prisma.pemetaanFingerprint.findMany({
    where: { perangkatId },
    include: { siswa: { select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } } } },
    orderBy: { createdAt: "desc" },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      perangkatUserId: r.perangkatUserId,
      siswaId: r.siswaId,
      nama: r.siswa.nama,
      nis: r.siswa.nis,
      kelas: r.siswa.kelas?.nama ?? "-",
      createdAt: r.createdAt.toISOString(),
    }))
  )
}

export async function cariSiswaUntukPemetaan(q: string) {
  await requireAdmin()
  const kata = q.trim()
  if (kata.length < 2) return []
  const rows = await prisma.siswa.findMany({
    where: {
      deletedAt: null,
      OR: [{ nama: { contains: kata, mode: "insensitive" } }, { nis: { contains: kata } }],
    },
    select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
    take: 10,
    orderBy: { nama: "asc" },
  })
  return rows.map((r) => ({ id: r.id, nama: r.nama, nis: r.nis, kelas: r.kelas?.nama ?? "-" }))
}

export async function tambahPemetaan(input: { perangkatId: string; siswaId: string; perangkatUserId: string }) {
  const admin = await requireAdmin()
  const uid = String(input.perangkatUserId ?? "").trim()
  if (!uid) throw new Error("UID sidik jari di mesin wajib diisi")
  if (uid.length > 32) throw new Error("UID maksimal 32 karakter")

  const perangkat = await prisma.perangkatFingerprint.findUnique({ where: { id: input.perangkatId } })
  if (!perangkat) throw new Error("Perangkat tidak ditemukan")
  const siswa = await prisma.siswa.findFirst({ where: { id: input.siswaId, deletedAt: null }, select: { id: true, nama: true } })
  if (!siswa) throw new Error("Siswa tidak ditemukan")

  const dup = await prisma.pemetaanFingerprint.findFirst({
    where: { OR: [{ perangkatId: input.perangkatId, perangkatUserId: uid }, { perangkatId: input.perangkatId, siswaId: input.siswaId }] },
    select: { id: true, perangkatUserId: true, siswaId: true },
  })
  if (dup) throw new Error(dup.perangkatUserId === uid ? "UID sudah terdaftar di perangkat ini" : "Siswa sudah terpetakan di perangkat ini")

  await prisma.pemetaanFingerprint.create({
    data: { perangkatId: input.perangkatId, siswaId: input.siswaId, perangkatUserId: uid },
  })
  await audit(admin.id, "TAMBAH_PEMETAAN_FINGERPRINT", "PemetaanFingerprint", input.perangkatId, { siswaId: input.siswaId, uid })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function hapusPemetaan(id: string) {
  const admin = await requireAdmin()
  const row = await prisma.pemetaanFingerprint.findUnique({ where: { id }, select: { siswaId: true, perangkatUserId: true } })
  if (!row) throw new Error("Pemetaan tidak ditemukan")
  await prisma.pemetaanFingerprint.delete({ where: { id } })
  await audit(admin.id, "HAPUS_PEMETAAN_FINGERPRINT", "PemetaanFingerprint", id, { siswaId: row.siswaId, uid: row.perangkatUserId })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

// ─── MONITORING ────────────────────────────────────────────────────

export async function monitoringHarian(opts?: { tanggal?: string; kelasId?: string; status?: string; q?: string }) {
  await requireAdmin()
  const tanggal = hariTanggal(new Date(opts?.tanggal || new Date().toISOString().slice(0, 10)))
  const where: Record<string, unknown> = { tanggal }
  if (opts?.kelasId) where.siswa = { kelasId: opts.kelasId }

  const rows = await prisma.absensiHarianSiswa.findMany({
    where: where as never,
    include: {
      siswa: { select: { id: true, nama: true, nis: true, kelasId: true, kelas: { select: { nama: true } } } },
      eventMasuk: { select: { eventKey: true, perangkat: { select: { nama: true } } } },
      eventPulang: { select: { eventKey: true, perangkat: { select: { nama: true } } } },
    },
    orderBy: [{ jamMasuk: "asc" }, { siswa: { nama: "asc" } }],
    take: 1000,
  })

  let list = rows.map((r) => ({
    id: r.id,
    siswaId: r.siswa.id,
    nama: r.siswa.nama,
    nis: r.siswa.nis,
    kelasId: r.siswa.kelasId,
    kelas: r.siswa.kelas?.nama ?? "-",
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
  const kata = (opts?.q ?? "").trim().toLowerCase()
  if (kata) list = list.filter((r) => r.nama.toLowerCase().includes(kata) || (r.nis ?? "").includes(kata))
  if (opts?.status === "BELUM") list = list.filter((r) => !r.jamMasuk)
  if (opts?.status === "MASUK") list = list.filter((r) => !!r.jamMasuk && !r.jamPulang)
  if (opts?.status === "PULANG") list = list.filter((r) => !!r.jamPulang)
  if (opts?.status === "TERLAMBAT") list = list.filter((r) => r.statusMasuk === "TERLAMBAT")

  // Siswa yang belum tercatat sama sekali hari ini
  const sudah = new Set(list.map((r) => r.siswaId))
  const semuaSiswa = await prisma.siswa.findMany({
    where: { deletedAt: null, ...(opts?.kelasId ? { kelasId: opts.kelasId } : {}) },
    select: { id: true, nama: true, nis: true, kelasId: true, kelas: { select: { nama: true } } },
    orderBy: { nama: "asc" },
    take: 2000,
  })
  const belum = semuaSiswa
    .filter((s) => !sudah.has(s.id) && !rows.some((r) => r.siswaId === s.id))
    .map((s) => ({
      id: null as string | null,
      siswaId: s.id,
      nama: s.nama,
      nis: s.nis,
      kelasId: s.kelasId,
      kelas: s.kelas?.nama ?? "-",
      jamMasuk: null as string | null,
      jamPulang: null as string | null,
      statusMasuk: null as string | null,
      statusPulang: null as string | null,
      terlambatMenit: null as number | null,
      sumberMasuk: null as string | null,
      sumberPulang: null as string | null,
      perangkatMasuk: null as string | null,
      perangkatPulang: null as string | null,
      koreksiAlasan: null as string | null,
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
  return { tanggal: tanggal.toISOString().slice(0, 10), rows: gabung, summary }
}

export async function daftarEvent(opts?: { tanggal?: string; take?: number }) {
  await requireAdmin()
  const tanggal = hariTanggal(new Date(opts?.tanggal || new Date().toISOString().slice(0, 10)))
  const rows = await prisma.fingerprintEvent.findMany({
    where: { serverAt: { gte: tanggal, lt: new Date(tanggal.getTime() + 86400000) } },
    include: {
      siswa: { select: { nama: true, nis: true } },
      perangkat: { select: { nama: true, kode: true } },
    },
    orderBy: { serverAt: "desc" },
    take: opts?.take ?? 200,
  })
  return rows.map((r) => ({
    id: r.id,
    eventKey: r.eventKey,
    perangkat: r.perangkat?.nama ?? "-",
    kode: r.perangkat?.kode ?? "-",
    nama: r.siswa?.nama ?? "(tidak dikenal)",
    nis: r.siswa?.nis ?? null,
    tipe: r.tipe,
    status: r.status,
    pesan: r.pesan,
    deviceAt: r.deviceAt?.toISOString() ?? null,
    serverAt: r.serverAt.toISOString(),
  }))
}

// ─── MONITORING NOTIFIKASI (log notifikasi absensi terkirim) ───────

export async function daftarNotifikasiAdmin(opts?: { take?: number; unread?: boolean }) {
  await requireAdmin()
  const rows = await prisma.notification.findMany({
    where: opts?.unread ? { isRead: false } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.take ?? 100, 300),
    include: { user: { select: { name: true, email: true, role: true } } },
  })
  const [total, unread, gagal] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.count({ where: { status: "GAGAL" } }),
  ])
  return {
    summary: { total, unread, gagal },
    rows: rows.map((r) => ({
      id: r.id,
      judul: r.judul,
      pesan: r.pesan,
      tipe: r.tipe,
      status: r.status,
      isRead: r.isRead,
      eventKey: r.eventKey,
      link: r.link,
      penerima: r.user?.name || r.user?.email || "-",
      rolePenerima: String(r.user?.role ?? "-"),
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

// ─── KEBIJAKAN (jam masuk/pulang, toleransi, hari libur) ───────────

export async function getKebijakanHarianAdmin() {
  await requireAdmin()
  const [cfg, kebijakan] = await Promise.all([prisma.siteConfig.findFirst({}), getKebijakanHarian()])
  return {
    ...kebijakan,
    siteName: cfg?.siteName ?? null,
  }
}

export async function simpanKebijakanHarian(input: {
  siswaJamMasuk: string
  siswaJamPulang: string
  siswaToleransiMenit: number
  siswaPulangToleransiMenit: number
}) {
  const admin = await requireAdmin()
  const jamRe = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!jamRe.test(input.siswaJamMasuk)) throw new Error("Jam masuk tidak valid (HH:MM)")
  if (!jamRe.test(input.siswaJamPulang)) throw new Error("Jam pulang tidak valid (HH:MM)")
  const tm = Math.floor(Number(input.siswaToleransiMenit))
  const tp = Math.floor(Number(input.siswaPulangToleransiMenit))
  if (!Number.isFinite(tm) || tm < 0 || tm > 240) throw new Error("Toleransi masuk 0–240 menit")
  if (!Number.isFinite(tp) || tp < 0 || tp > 240) throw new Error("Toleransi pulang 0–240 menit")

  const data = { siswaJamMasuk: input.siswaJamMasuk, siswaJamPulang: input.siswaJamPulang, siswaToleransiMenit: tm, siswaPulangToleransiMenit: tp }
  const existing = await prisma.siteConfig.findFirst({ select: { id: true } })
  if (existing) await prisma.siteConfig.update({ where: { id: existing.id }, data })
  else await prisma.siteConfig.create({ data })
  await audit(admin.id, "SIMPAN_KEBIJAKAN_ABSENSI_HARIAN", "SiteConfig", existing?.id, data)
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function daftarLibur() {
  await requireAdmin()
  const rows = await prisma.tanggalLibur.findMany({ orderBy: { tanggal: "desc" }, take: 120 })
  return rows.map((r) => ({ id: r.id, tanggal: r.tanggal.toISOString().slice(0, 10), keterangan: r.keterangan }))
}

export async function tambahLibur(tanggal: string, keterangan?: string) {
  const admin = await requireAdmin()
  const tgl = hariTanggal(new Date(tanggal))
  if (Number.isNaN(tgl.getTime())) throw new Error("Tanggal tidak valid")
  await prisma.tanggalLibur.upsert({
    where: { tanggal: tgl },
    create: { tanggal: tgl, keterangan: keterangan?.trim() || null },
    update: { keterangan: keterangan?.trim() || null },
  })
  await audit(admin.id, "TAMBAH_HARI_LIBUR", "TanggalLibur", tgl.toISOString(), { keterangan })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function hapusLibur(id: string) {
  const admin = await requireAdmin()
  await prisma.tanggalLibur.delete({ where: { id } })
  await audit(admin.id, "HAPUS_HARI_LIBUR", "TanggalLibur", id, {})
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

// ─── PERMINTAAN MANUAL + KOREKSI ───────────────────────────────────

export async function daftarPermintaanManual(status?: string) {
  await requireAdmin()
  const rows = await prisma.permintaanAbsensiManual.findMany({
    where: status ? { status } : {},
    include: { siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map((r) => ({
    id: r.id,
    nama: r.siswa.nama,
    nis: r.siswa.nis,
    kelas: r.siswa.kelas?.nama ?? "-",
    tanggal: r.tanggal.toISOString().slice(0, 10),
    tipe: r.tipe,
    alasan: r.alasan,
    status: r.status,
    catatanAdmin: r.catatanAdmin,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function putuskanPermintaan(permintaanId: string, putusan: "DISETUJUI" | "DITOLAK", catatan?: string) {
  const admin = await requireAdmin()
  const hasil = await putuskanAbsensiManual({ permintaanId, putusan, catatan, actorUserId: admin.id })
  revalidatePath("/admin/fingerprint")
  return hasil
}

export async function koreksiHarian(input: {
  absensiId: string
  jamMasuk?: string | null
  jamPulang?: string | null
  statusMasuk?: string | null
  statusPulang?: string | null
  alasan: string
}) {
  const admin = await requireAdmin()
  await koreksiAbsensiHarian({ ...input, actorUserId: admin.id })
  revalidatePath("/admin/fingerprint")
  return { success: true }
}

export async function daftarKoreksiHarian() {
  await requireAdmin()
  const rows = await prisma.auditLog.findMany({
    where: { entity: "AbsensiHarianSiswa" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, entityId: true, detail: true, createdAt: true, user: { select: { name: true } } },
  })
  return rows.map((r) => ({ id: r.id, action: r.action, entityId: r.entityId, detail: r.detail, oleh: r.user?.name ?? "-", createdAt: r.createdAt.toISOString() }))
}
