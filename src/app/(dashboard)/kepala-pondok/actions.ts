"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePondok } from "@/lib/pondok-rbac"
import {
  getIzinMenunggu, setujuiIzin, tolakIzin, getRiwayatIzin,
  perbaruiIzinTerlambat, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL, KEBERADAAN_LABEL,
} from "@/lib/izin-santri"
import { createAuditLog } from "@/lib/audit"
import type { StatusAbsensi } from "@prisma/client"

// ─── KEPALA PONDOK — server actions (guard: permission pondok) ─────────

export async function getDashboardKepala() {
  await requirePondok("pondok.dashboard.view")
  await perbaruiIzinTerlambat()
  const mulaiBulan = new Date(); mulaiBulan.setDate(1); mulaiBulan.setHours(0, 0, 0, 0)
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  const besok = new Date(hariIni.getTime() + 24 * 3600 * 1000)

  const [
    totalSantri, diPondok, izinPulang, terlambat, tidakDiketahui,
    totalAsrama, totalKamar, kegiatanHariIni,
    absensiHariIniHadir, absensiHariIniTotal,
    pelanggaranBulanIni, prestasiBulanIni,
    setoranBulanIni, halaqahAktif, kelasDiniyahAktif,
    absensiDiniyahHadirBulan, absensiDiniyahTotalBulan,
    izinMenungguKepala, izinMenungguAdmin, pengumumanMenunggu, pembinaanMenunggu,
    kegiatanMendatang,
  ] = await Promise.all([
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "DI_PONDOK" } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["IZIN_PULANG", "DI_RUMAH", "DALAM_PERJALANAN"] } } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: "TERLAMBAT_KEMBALI" } }),
    prisma.santri.count({ where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["TIDAK_DIKETAHUI", "BELUM_KEMBALI"] } } }),
    prisma.asrama.count({ where: { aktif: true } }),
    prisma.kamar.count({}),
    prisma.kegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
    prisma.absensiKegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok }, status: { in: ["HADIR", "TERLAMBAT"] as StatusAbsensi[] } } }),
    prisma.absensiKegiatanPondok.count({ where: { tanggal: { gte: hariIni, lt: besok } } }),
    prisma.pembinaanSantri.count({ where: { tipe: "PELANGGARAN", tanggal: { gte: mulaiBulan } } }),
    prisma.pembinaanSantri.count({ where: { tipe: "PRESTASI", tanggal: { gte: mulaiBulan } } }),
    prisma.setoranTahfidz.count({ where: { tanggal: { gte: mulaiBulan } } }),
    prisma.halaqah.count({ where: { aktif: true } }),
    prisma.kelasDiniyah.count({ where: { aktif: true } }),
    prisma.absensiDiniyah.count({ where: { tanggal: { gte: mulaiBulan }, status: { in: ["HADIR", "TERLAMBAT"] as StatusAbsensi[] } } }),
    prisma.absensiDiniyah.count({ where: { tanggal: { gte: mulaiBulan } } }),
    prisma.izinSantri.count({ where: { status: "MENUNGGU_KEPALA" } }),
    prisma.izinSantri.count({ where: { status: "MENUNGGU_ADMIN" } }),
    prisma.pengumuman.count({ where: { status: "MENUNGGU", deletedAt: null } }),
    prisma.pembinaanSantri.count({ where: { status: "MENUNGGU" } }),
    prisma.kegiatanPondok.findMany({ where: { tanggal: { gte: hariIni } }, orderBy: { tanggal: "asc" }, take: 10, include: { penanggungJawab: { select: { name: true } } } }),
  ])

  return {
    totalSantri, diPondok, izinPulang, terlambat, tidakDiketahui,
    totalAsrama, totalKamar, kegiatanHariIni,
    kehadiranKegiatanPersen: absensiHariIniTotal > 0 ? Math.round((absensiHariIniHadir / absensiHariIniTotal) * 100) : null,
    pelanggaranBulanIni, prestasiBulanIni,
    capaianTahfidz: { setoranBulanIni, halaqahAktif },
    diniyah: { kelasAktif: kelasDiniyahAktif, hadirPersenBulan: absensiDiniyahTotalBulan > 0 ? Math.round((absensiDiniyahHadirBulan / absensiDiniyahTotalBulan) * 100) : null },
    izinMenunggu: izinMenungguKepala + izinMenungguAdmin, izinMenungguKepala, izinMenungguAdmin,
    pengumumanMenunggu, pembinaanMenunggu,
    kegiatanMendatang: kegiatanMendatang.map((k) => ({ ...k, tanggal: k.tanggal.toISOString() })),
  }
}

export async function getMonitoringKeberadaan() {
  await requirePondok("pondok.santri.view")
  const rows = await prisma.santri.findMany({
    where: { status: "AKTIF", deletedAt: null, keberadaan: { not: "DI_PONDOK" } },
    select: {
      id: true, nama: true, nisNo: true, keberadaan: true,
      asrama: { select: { nama: true } }, kamar: { select: { nama: true } },
      izins: { where: { status: "DISETUJUI", checkinAt: null }, select: { id: true, suratNomor: true, rencanaKembali: true, jenis: true }, take: 1 },
    },
    orderBy: { nama: "asc" },
    take: 200,
  })
  const ringkas = rows.map((r) => ({
    id: r.id, nama: r.nama, nisNo: r.nisNo, keberadaan: r.keberadaan,
    asrama: r.asrama?.nama ?? null, kamar: r.kamar?.nama ?? null,
    izinAktif: r.izins[0] ? { suratNomor: r.izins[0].suratNomor, rencanaKembali: r.izins[0].rencanaKembali.toISOString(), jenis: JENIS_IZIN_LABEL[r.izins[0].jenis] } : null,
  }))
  return { rows: ringkas, keberadaanLabel: KEBERADAAN_LABEL }
}

export async function getAntreanIzinKepala() {
  await requirePondok("pondok.izin.view")
  const rows = await getIzinMenunggu("KEPALA")
  return { rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

export async function setujuiIzinKepalaAction(izinId: string, catatan?: string) {
  const userId = await requirePondok("pondok.izin.approve")
  const hasil = await setujuiIzin(izinId, "KEPALA", userId, catatan)
  revalidatePath("/kepala-pondok")
  return hasil
}

export async function tolakIzinKepalaAction(izinId: string, alasan: string) {
  const userId = await requirePondok("pondok.izin.reject")
  const hasil = await tolakIzin(izinId, "KEPALA", userId, alasan)
  revalidatePath("/kepala-pondok")
  return hasil
}

export async function getRiwayatIzinPondok(filters?: { page?: number }) {
  await requirePondok("pondok.laporan.view")
  const base = await getRiwayatIzin({ page: filters?.page ?? 1, limit: 20 })
  return { ...base, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }
}

// ─── PENGUMUMAN: approve resmi ─────────────────────────────────────────

export async function getPengumumanPondok() {
  await requirePondok("pondok.dashboard.view")
  const rows = await prisma.pengumuman.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, role: true } } },
  })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), approvedAt: r.approvedAt?.toISOString() ?? null }))
}

export async function setujuiPengumumanAction(id: string) {
  const userId = await requirePondok("pondok.pengumuman.publish")
  const upd = await prisma.pengumuman.updateMany({ where: { id, status: { in: ["MENUNGGU", "DRAFT"] }, deletedAt: null }, data: { status: "TERBIT", approvedBy: userId, approvedAt: new Date() } })
  if (upd.count === 0) throw new Error("Pengumuman tidak dalam status menunggu persetujuan")
  await createAuditLog({ userId, action: "PENGUMUMAN_DISETUJUI", entity: "Pengumuman", entityId: id, detail: {} })
  revalidatePath("/kepala-pondok")
  return { success: true }
}

// ─── PEMBINAAN: evaluasi & persetujuan tindak lanjut ───────────────────

export async function getPembinaanPondok(filters?: { status?: string }) {
  await requirePondok("pondok.pembinaan.manage")
  const rows = await prisma.pembinaanSantri.findMany({
    where: { ...(filters?.status ? { status: filters.status as never } : {}) },
    orderBy: { tanggal: "desc" },
    take: 100,
    include: { santri: { select: { nama: true, nisNo: true, asrama: { select: { nama: true } } } }, petugas: { select: { name: true } } },
  })
  return rows.map((r) => ({ ...r, tanggal: r.tanggal.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null }))
}

export async function setujuiPembinaanAction(id: string) {
  const userId = await requirePondok("pondok.pembinaan.manage")
  const upd = await prisma.pembinaanSantri.updateMany({ where: { id, status: "MENUNGGU" }, data: { status: "DISETUJUI", resolvedAt: new Date(), resolvedBy: userId } })
  if (upd.count === 0) throw new Error("Pembinaan tidak dalam status menunggu")
  await createAuditLog({ userId, action: "PEMBINAAN_DISETUJUI", entity: "PembinaanSantri", entityId: id, detail: {} })
  revalidatePath("/kepala-pondok")
  return { success: true }
}

// ─── LAPORAN PONDOK (rekap untuk export) ───────────────────────────────

export async function getLaporanPondok() {
  await requirePondok("pondok.laporan.view")
  const mulaiBulan = new Date(); mulaiBulan.setDate(1); mulaiBulan.setHours(0, 0, 0, 0)
  const [santri, asrama, kamar, kegiatan, absensi, izin, setoran, diniyah, pembinaan] = await Promise.all([
    prisma.santri.groupBy({ by: ["keberadaan"], where: { status: "AKTIF", deletedAt: null }, _count: true }),
    prisma.asrama.findMany({ where: { aktif: true }, select: { id: true, nama: true, _count: { select: { santris: true, kamars: true } } }, orderBy: { nama: "asc" } }),
    prisma.kamar.count({}),
    prisma.kegiatanPondok.findMany({ where: { tanggal: { gte: mulaiBulan } }, orderBy: { tanggal: "desc" }, take: 50, include: { penanggungJawab: { select: { name: true } } } }),
    prisma.absensiKegiatanPondok.groupBy({ by: ["status"], where: { tanggal: { gte: mulaiBulan } }, _count: true }),
    prisma.izinSantri.groupBy({ by: ["status"], where: { createdAt: { gte: mulaiBulan } }, _count: true }),
    prisma.setoranTahfidz.findMany({ where: { tanggal: { gte: mulaiBulan } }, orderBy: { tanggal: "desc" }, take: 50, include: { santri: { select: { nama: true } }, halaqah: { select: { nama: true } } } }),
    prisma.absensiDiniyah.groupBy({ by: ["status"], where: { tanggal: { gte: mulaiBulan } }, _count: true }),
    prisma.pembinaanSantri.groupBy({ by: ["tipe"], where: { tanggal: { gte: mulaiBulan } }, _count: true }),
  ])
  return {
    santri: santri.map((s) => ({ keberadaan: s.keberadaan, jumlah: s._count })),
    asrama: asrama.map((a) => ({ id: a.id, nama: a.nama, penghuni: a._count.santris, kamar: a._count.kamars })),
    totalKamar: kamar,
    kegiatan: kegiatan.map((k) => ({ id: k.id, nama: k.nama, tanggal: k.tanggal.toISOString(), penanggungJawab: k.penanggungJawab?.name ?? null })),
    absensiKegiatan: absensi.map((a) => ({ status: a.status, jumlah: a._count })),
    izin: izin.map((i) => ({ status: i.status, jumlah: i._count })),
    setoran: setoran.map((s) => ({ id: s.id, tanggal: s.tanggal.toISOString(), nama: s.santri.nama, halaqah: s.halaqah.nama, surah: s.surah, ayat: `${s.ayatMulai}-${s.ayatAkhir}`, status: s.status })),
    absensiDiniyah: diniyah.map((d) => ({ status: d.status, jumlah: d._count })),
    pembinaan: pembinaan.map((p) => ({ tipe: p.tipe, jumlah: p._count })),
    periodeDari: mulaiBulan.toISOString(),
  }
}

// ─── KEGIATAN: monitoring (manage di pengurus; kepala monitor + evaluasi) ──

export async function getKegiatanPondok(filters?: { dari?: string; sampai?: string }) {
  await requirePondok("pondok.dashboard.view")
  const dari = filters?.dari ? new Date(filters.dari) : undefined
  const sampai = filters?.sampai ? new Date(filters.sampai) : undefined
  const rows = await prisma.kegiatanPondok.findMany({
    where: { ...(dari || sampai ? { tanggal: { ...(dari ? { gte: dari } : {}), ...(sampai ? { lte: sampai } : {}) } } : {}) },
    orderBy: { tanggal: "desc" },
    take: 100,
    include: { penanggungJawab: { select: { name: true } }, _count: { select: { absensi: true } } },
  })
  return rows.map((k) => ({ id: k.id, nama: k.nama, tipe: k.tipe, tanggal: k.tanggal.toISOString(), jamMulai: k.jamMulai, jamSelesai: k.jamSelesai, lokasi: k.lokasi, wajib: k.wajib, penanggungJawab: k.penanggungJawab?.name ?? null, jumlahAbsensi: k._count.absensi }))
}
