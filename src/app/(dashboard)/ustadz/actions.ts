"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePondok, requirePondokSantri, santriIdsDalamScope } from "@/lib/pondok-rbac"
import { rekomendasikanIzin, getIzinMenunggu, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL, KEBERADAAN_LABEL } from "@/lib/izin-santri"
import { createAuditLog } from "@/lib/audit"
import type { StatusAbsensi } from "@prisma/client"

// ─── USTADZ / USTADZAH — server actions (scope: halaqah/kelas/asrama) ──

type ScopeCtx = { userId: string; semua: boolean; ids: string[] }

async function ctxView() {
  const userId = await requirePondok("pondok.santri.view")
  const s = await santriIdsDalamScope(userId)
  return s === "SEMUA" ? { userId, semua: true, ids: [] as string[] } : { userId, semua: false, ids: s }
}

function scopeSantriWhere(ctx: ScopeCtx) {
  return ctx.semua ? {} : { id: { in: ctx.ids } }
}

export async function getDashboardUstadz() {
  const userId = await requirePondok("pondok.dashboard.view")
  const ctx = await ctxView()
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)

  const kelasSaya = await prisma.kelasDiniyah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    select: { id: true, nama: true, hari: true, jam: true, tingkat: true },
  })
  const halaqahSaya = await prisma.halaqah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    select: { id: true, nama: true, tingkat: true, targetSurah: true },
  })
  const kelasIds = kelasSaya.map((k) => k.id)
  const halaqahIds = halaqahSaya.map((h) => h.id)

  const [santriBinaan, kegiatanDitugaskan, absensiDiniyahHariIni, absensiHalaqahHariIni, setoranTerbaru, targetHalaqah, izinSantriBinaan] = await Promise.all([
    prisma.santri.count({ where: { deletedAt: null, status: "AKTIF", ...scopeSantriWhere(ctx) } }),
    prisma.kegiatanPondok.count({
      where: {
        tanggal: { gte: hariIni, lt: besok },
        OR: [{ penanggungJawabId: userId }],
      },
    }),
    prisma.absensiDiniyah.count({ where: { kelasDiniyahId: { in: kelasIds }, tanggal: hariIni } }),
    prisma.absensiKegiatanPondok.count({ where: { tanggal: hariIni, kegiatan: { penanggungJawabId: userId } } }),
    prisma.setoranTahfidz.findMany({
      where: { halaqahId: { in: halaqahIds } },
      orderBy: { tanggal: "desc" },
      take: 10,
      include: { santri: { select: { nama: true, nisNo: true } }, halaqah: { select: { nama: true } } },
    }),
    prisma.halaqah.findMany({ where: { id: { in: halaqahIds }, aktif: true }, select: { id: true, nama: true, targetSurah: true, _count: { select: { santris: true } } } }),
    ctx.semua
      ? prisma.izinSantri.findMany({ where: { status: { in: ["MENUNGGU_MUSYRIF", "DISETUJUI"] }, checkoutAt: null }, take: 20, include: { santri: { select: { nama: true } } } })
      : prisma.izinSantri.findMany({ where: { santriId: { in: ctx.ids }, status: { in: ["MENUNGGU_MUSYRIF", "DISETUJUI"] } }, take: 20, include: { santri: { select: { nama: true } } } }),
  ])

  return {
    kelasSaya, halaqahSaya,
    santriBinaan,
    absensiBelumDiniyah: kelasIds.length - absensiDiniyahHariIni > 0 ? Math.min(kelasIds.length - absensiDiniyahHariIni, kelasIds.length) : 0,
    absensiKegiatanTerisi: absensiHalaqahHariIni,
    kegiatanDitugaskan,
    setoranTerbaru: setoranTerbaru.map((s) => ({ id: s.id, nama: s.santri.nama, halaqah: s.halaqah.nama, surah: s.surah, ayat: `${s.ayatMulai}-${s.ayatAkhir}`, status: s.status, tanggal: s.tanggal.toISOString() })),
    targetHalaqah: targetHalaqah.map((h) => ({ id: h.id, nama: h.nama, targetSurah: h.targetSurah, jumlahSantri: h._count.santris })),
    izinTerkait: izinSantriBinaan.map((i) => ({ id: i.id, nama: i.santri.nama, jenis: JENIS_IZIN_LABEL[i.jenis], status: STATUS_IZIN_LABEL[i.status] })),
  }
}

// ─── JADWAL MENGAJAR ───────────────────────────────────────────────────

export async function getJadwalUstadz() {
  const userId = await requirePondok("pondok.dashboard.view")
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)
  const kelasSaya = await prisma.kelasDiniyah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    orderBy: [{ hari: "asc" }, { jam: "asc" }],
  })
  const halaqahSaya = await prisma.halaqah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    include: { _count: { select: { santris: true, setoran: true } } },
  })
  const kegiatanHariIni = await prisma.kegiatanPondok.findMany({
    where: { tanggal: { gte: hariIni, lt: besok }, penanggungJawabId: userId },
    orderBy: { jamMulai: "asc" },
  })
  return {
    kelas: kelasSaya.map((k) => ({ id: k.id, nama: k.nama, tingkat: k.tingkat, hari: k.hari, jam: k.jam })),
    halaqah: halaqahSaya.map((h) => ({ id: h.id, nama: h.nama, tingkat: h.tingkat, targetSurah: h.targetSurah, jumlahSantri: h._count.santris, jumlahSetoran: h._count.setoran })),
    kegiatanHariIni: kegiatanHariIni.map((k) => ({ id: k.id, nama: k.nama, jamMulai: k.jamMulai, jamSelesai: k.jamSelesai, lokasi: k.lokasi })),
  }
}

export async function getKelasDiniyahOpts() {
  const userId = await requirePondok("pondok.diniyah.manage")
  const rows = await prisma.kelasDiniyah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    orderBy: { nama: "asc" },
  })
  return rows.map((k) => ({ id: k.id, nama: k.nama, hari: k.hari, jam: k.jam }))
}

export async function createKelasDiniyahAction(data: { nama: string; tingkat?: string; hari?: string; jam?: string }) {
  const userId = await requirePondok("pondok.diniyah.manage")
  if (String(data.nama || "").trim().length < 3) throw new Error("Nama kelas minimal 3 karakter")
  const row = await prisma.kelasDiniyah.create({ data: { nama: String(data.nama).trim(), tingkat: data.tingkat || null, hari: data.hari || null, jam: data.jam || null, pengampuId: userId } })
  await prisma.pondokStaffAssignment.create({ data: { userId, tipe: "USTADZ_DINIYAH", kelasDiniyahId: row.id, createdBy: userId } })
  await createAuditLog({ userId, action: "KELAS_DINIYAH_DIBUAT", entity: "KelasDiniyah", entityId: row.id, detail: { nama: row.nama } })
  revalidatePath("/ustadz")
  return row
}

// ─── ABSENSI DINIYAH ───────────────────────────────────────────────────

export async function getSantriKelasDiniyah(kelasDiniyahId: string, tanggal: string) {
  const userId = await requirePondok("pondok.absensi.create")
  const akses = await prisma.kelasDiniyah.findFirst({ where: { id: kelasDiniyahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true, nama: true } })
  if (!akses) throw new Error("Anda tidak mengampu kelas ini")
  const tgl = new Date(tanggal); tgl.setHours(0, 0, 0, 0)
  const santri = await prisma.santri.findMany({ where: { kelasDiniyahId, deletedAt: null, status: "AKTIF" }, select: { id: true, nama: true, nisNo: true, keberadaan: true }, orderBy: { nama: "asc" } })
  const absensi = await prisma.absensiDiniyah.findMany({ where: { kelasDiniyahId, tanggal: tgl } })
  const map = new Map(absensi.map((a) => [a.santriId, a]))
  return {
    kelas: akses, tanggal: tgl.toISOString(),
    rows: santri.map((s) => ({ santriId: s.id, nama: s.nama, nisNo: s.nisNo, keberadaan: s.keberadaan, status: map.get(s.id)?.status ?? null, id: map.get(s.id)?.id ?? null })),
  }
}

export async function simpanAbsensiDiniyahAction(kelasDiniyahId: string, tanggal: string, rows: { santriId: string; status: StatusAbsensi; keterangan?: string }[]) {
  const userId = await requirePondok("pondok.absensi.create")
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Data absensi kosong")
  const akses = await prisma.kelasDiniyah.findFirst({ where: { id: kelasDiniyahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })
  if (!akses) throw new Error("Anda tidak mengampu kelas ini")
  const tgl = new Date(tanggal); tgl.setHours(0, 0, 0, 0)
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const punya = await tx.santri.findFirst({ where: { id: r.santriId, kelasDiniyahId }, select: { id: true } })
      if (!punya) throw new Error("Santri tidak termasuk kelas ini")
      await tx.absensiDiniyah.upsert({
        where: { kelasDiniyahId_tanggal_santriId: { kelasDiniyahId, tanggal: tgl, santriId: r.santriId } },
        create: { kelasDiniyahId, tanggal: tgl, santriId: r.santriId, status: r.status, keterangan: r.keterangan || null, pencatatId: userId },
        update: { status: r.status, keterangan: r.keterangan || null },
      })
    }
  })
  await createAuditLog({ userId, action: "ABSENSI_DINIYAH_DISIMPAN", entity: "AbsensiDiniyah", entityId: kelasDiniyahId, detail: { jumlah: rows.length } })
  revalidatePath("/ustadz")
  return { success: true, jumlah: rows.length }
}

export async function koreksiAbsensiDiniyahAction(absensiId: string, status: StatusAbsensi, alasan: string) {
  const userId = await requirePondok("pondok.absensi.correct")
  if (String(alasan || "").trim().length < 5) throw new Error("Alasan koreksi minimal 5 karakter")
  const row = await prisma.absensiDiniyah.findUnique({ where: { id: absensiId }, select: { kelasDiniyahId: true } })
  if (!row) throw new Error("Absensi tidak ditemukan")
  const akses = await prisma.kelasDiniyah.findFirst({ where: { id: row.kelasDiniyahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })
  if (!akses) throw new Error("Anda tidak mengampu kelas ini")
  const upd = await prisma.absensiDiniyah.update({ where: { id: absensiId }, data: { status, koreksiAlasan: String(alasan).trim(), koreksiBy: userId } })
  await createAuditLog({ userId, action: "ABSENSI_DINIYAH_DIKOREKSI", entity: "AbsensiDiniyah", entityId: absensiId, detail: { status, alasan } })
  revalidatePath("/ustadz")
  return upd
}

// ─── TAHFIDZ: setoran & penilaian ──────────────────────────────────────

export async function getHalaqahOpts() {
  const userId = await requirePondok("pondok.tahfidz.manage")
  const rows = await prisma.halaqah.findMany({
    where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] },
    orderBy: { nama: "asc" },
  })
  return rows.map((h) => ({ id: h.id, nama: h.nama, targetSurah: h.targetSurah }))
}

export async function createHalaqahAction(data: { nama: string; tingkat?: string; targetSurah?: string }) {
  const userId = await requirePondok("pondok.tahfidz.manage")
  if (String(data.nama || "").trim().length < 2) throw new Error("Nama halaqah minimal 2 karakter")
  const row = await prisma.halaqah.create({ data: { nama: String(data.nama).trim(), tingkat: data.tingkat || null, targetSurah: data.targetSurah || null, pengampuId: userId } })
  await prisma.pondokStaffAssignment.create({ data: { userId, tipe: "USTADZ_TAHFIDZ", halaqahId: row.id, createdBy: userId } })
  await createAuditLog({ userId, action: "HALAQAH_DIBUAT", entity: "Halaqah", entityId: row.id, detail: { nama: row.nama } })
  revalidatePath("/ustadz")
  return row
}

export async function getSetoranHalaqah(halaqahId: string, page?: number) {
  await requirePondok("pondok.tahfidz.manage")
  const userId = (await requirePondok("pondok.dashboard.view"))
  const akses = await prisma.halaqah.findFirst({ where: { id: halaqahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })
  if (!akses) throw new Error("Anda tidak membina halaqah ini")
  const pageNum = page ?? 1
  const [data, total] = await Promise.all([
    prisma.setoranTahfidz.findMany({ where: { halaqahId }, orderBy: { tanggal: "desc" }, skip: (pageNum - 1) * 20, take: 20, include: { santri: { select: { nama: true, nisNo: true } } } }),
    prisma.setoranTahfidz.count({ where: { halaqahId } }),
  ])
  return { data, total, page: pageNum, totalPages: Math.ceil(total / 20) }
}

export async function catatSetoranAction(data: { halaqahId: string; santriId: string; surah: string; ayatMulai: number; ayatAkhir: number; juz?: number; tipe?: string; status?: string; tajwid?: number; kelancaran?: number; catatan?: string }) {
  const userId = await requirePondok("pondok.tahfidz.assess")
  const akses = await prisma.halaqah.findFirst({ where: { id: data.halaqahId, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })
  if (!akses) throw new Error("Anda tidak membina halaqah ini")
  const santri = await prisma.santri.findFirst({ where: { id: data.santriId, halaqahId: data.halaqahId, deletedAt: null }, select: { id: true } })
  if (!santri) throw new Error("Santri tidak termasuk halaqah ini")
  if (!String(data.surah || "").trim()) throw new Error("Surah wajib diisi")
  if (!data.ayatMulai || !data.ayatAkhir || data.ayatAkhir < data.ayatMulai) throw new Error("Range ayat tidak valid")
  const status = ["DITERIMA", "ULANG", "BERKELANJUTAN"].includes(String(data.status)) ? (String(data.status) as never) : "DITERIMA"
  const row = await prisma.setoranTahfidz.create({
    data: {
      halaqahId: data.halaqahId, santriId: data.santriId, surah: String(data.surah).trim(),
      ayatMulai: data.ayatMulai, ayatAkhir: data.ayatAkhir, juz: data.juz ?? null,
      tipe: data.tipe === "MURAJAAH" ? "MURAJAAH" : "SETORAN", status,
      tajwid: data.tajwid ?? null, kelancaran: data.kelancaran ?? null, catatan: data.catatan || null,
      ustadzId: userId,
    },
  })
  await createAuditLog({ userId, action: "SETORAN_TAHFIDZ_DICATAT", entity: "SetoranTahfidz", entityId: row.id, detail: { surah: row.surah, status } })
  revalidatePath("/ustadz")
  return row
}

export async function getCapaianHalaqah(halaqahId: string) {
  await requirePondok("pondok.tahfidz.manage")
  const santri = await prisma.santri.findMany({ where: { halaqahId, deletedAt: null, status: "AKTIF" }, select: { id: true, nama: true, nisNo: true } })
  const setoran = await prisma.setoranTahfidz.findMany({ where: { halaqahId }, orderBy: { tanggal: "desc" } })
  return santri.map((s) => {
    const punya = setoran.filter((x) => x.santriId === s.id)
    const terakhir = punya[0]
    return {
      santriId: s.id, nama: s.nama, nisNo: s.nisNo,
      jumlahSetoran: punya.length,
      terakhir: terakhir ? { surah: terakhir.surah, ayat: `${terakhir.ayatMulai}-${terakhir.ayatAkhir}`, juz: terakhir.juz, status: terakhir.status, tanggal: terakhir.tanggal.toISOString(), tajwid: terakhir.tajwid, kelancaran: terakhir.kelancaran } : null,
      rataTajwid: punya.filter((p) => p.tajwid != null).length ? Math.round(punya.filter((p) => p.tajwid != null).reduce((a, b) => a + (b.tajwid ?? 0), 0) / punya.filter((p) => p.tajwid != null).length) : null,
      rataKelancaran: punya.filter((p) => p.kelancaran != null).length ? Math.round(punya.filter((p) => p.kelancaran != null).reduce((a, b) => a + (b.kelancaran ?? 0), 0) / punya.filter((p) => p.kelancaran != null).length) : null,
    }
  })
}

// ─── PEMBINAAN (catatan ustadz) ────────────────────────────────────────

export async function createPembinaanUstadzAction(data: { santriId: string; tipe: string; judul: string; deskripsi?: string }) {
  const userId = await requirePondokSantri("pondok.pembinaan.manage", data.santriId)
  if (String(data.judul || "").trim().length < 3) throw new Error("Judul minimal 3 karakter")
  const tipe = ["PRESTASI", "PELANGGARAN", "CATATAN"].includes(data.tipe) ? data.tipe : "CATATAN"
  const row = await prisma.pembinaanSantri.create({
    data: { santriId: data.santriId, tipe, judul: String(data.judul).trim(), deskripsi: data.deskripsi || null, petugasId: userId, status: "SELESAI" },
  })
  await createAuditLog({ userId, action: "PEMBINAAN_USTADZ_DICATAT", entity: "PembinaanSantri", entityId: row.id, detail: { tipe } })
  revalidatePath("/ustadz")
  return row
}

// ─── PERIZINAN (lihat + rekomendasi, BUKAN persetujuan final) ──────────

export async function getIzinSantriBinaan() {
  await requirePondok("pondok.izin.view")
  const ctx = await ctxView()
  const rows = await prisma.izinSantri.findMany({
    where: { ...(ctx.semua ? {} : { santriId: { in: ctx.ids } }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { santri: { select: { nama: true, nisNo: true, halaqah: { select: { nama: true } }, kelasDiniyah: { select: { nama: true } } } } },
  })
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL, keberadaanLabel: KEBERADAAN_LABEL }
}

export async function rekomendasiIzinAction(izinId: string, rekomendasi: "SETUJUI" | "TIDAK_SETUJUI", catatan: string) {
  const userId = await requirePondok("pondok.izin.recommend")
  const izin = await prisma.izinSantri.findUnique({ where: { id: izinId }, select: { santriId: true } })
  if (!izin) throw new Error("Izin tidak ditemukan")
  const ctx = await ctxView()
  if (!ctx.semua && !ctx.ids.includes(izin.santriId)) throw new Error("Santri di luar cakupan binaan Anda")
  const hasil = await rekomendasikanIzin(izinId, userId, rekomendasi, catatan)
  revalidatePath("/ustadz")
  return hasil
}

// ─── LAPORAN USTADZ ────────────────────────────────────────────────────

export async function getLaporanUstadz() {
  await requirePondok("pondok.laporan.view")
  const userId = await requirePondok("pondok.dashboard.view")
  const mulaiBulan = new Date(); mulaiBulan.setDate(1); mulaiBulan.setHours(0, 0, 0, 0)
  const kelasIds = (await prisma.kelasDiniyah.findMany({ where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })).map((k) => k.id)
  const halaqahIds = (await prisma.halaqah.findMany({ where: { aktif: true, OR: [{ pengampuId: userId }, { assignments: { some: { userId, aktif: true } } }] }, select: { id: true } })).map((h) => h.id)
  const [kehadiranDiniyah, setoran, penilaian] = await Promise.all([
    prisma.absensiDiniyah.groupBy({ by: ["status"], where: { kelasDiniyahId: { in: kelasIds }, tanggal: { gte: mulaiBulan } }, _count: true }),
    prisma.setoranTahfidz.groupBy({ by: ["status"], where: { halaqahId: { in: halaqahIds }, tanggal: { gte: mulaiBulan } }, _count: true }),
    prisma.setoranTahfidz.aggregate({ where: { halaqahId: { in: halaqahIds }, tanggal: { gte: mulaiBulan }, tajwid: { not: null } }, _avg: { tajwid: true, kelancaran: true }, _count: true }),
  ])
  return {
    kehadiranDiniyah: kehadiranDiniyah.map((k) => ({ status: k.status, jumlah: k._count })),
    setoran: setoran.map((s) => ({ status: s.status, jumlah: s._count })),
    rataTajwid: penilaian._avg.tajwid ? Math.round(penilaian._avg.tajwid) : null,
    rataKelancaran: penilaian._avg.kelancaran ? Math.round(penilaian._avg.kelancaran) : null,
    jumlahDinilai: penilaian._count,
    periodeDari: mulaiBulan.toISOString(),
  }
}
