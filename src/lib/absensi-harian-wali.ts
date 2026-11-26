import { prisma } from "@/lib/prisma"
import {
  getKebijakanHarian,
  hariTanggal,
  cekHariLibur,
  hitungStatusMasuk,
  hitungStatusPulang,
  audit,
} from "@/lib/absensi-harian"

// ─── ABSENSI HARIAN SISWA — WALI KELAS ──────────────────────────────
// Dipakai bersama oleh server action web dan API mobile wali kelas.
// Sumber kebenaran tunggal untuk monitoring, input susulan, dan riwayat.

export type StatusHarian = "HADIR" | "IZIN" | "SAKIT"

export type BarisAbsensiWali = {
  siswaId: string
  jamMasuk?: string | null
  jamPulang?: string | null
  statusHarian?: StatusHarian | null
}

const AKSI_SUSULAN = "INPUT_SUSULAN_ABSENSI_HARIAN"

async function pastikanKelas(guruId: string, kelasId: string) {
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId, deletedAt: null },
    select: { id: true, nama: true },
  })
  if (!kelas) throw new Error("Akses ditolak: Anda bukan wali kelas ini")
  return kelas
}

/** Monitoring kehadiran harian + riwayat input susulan per siswa. */
export async function getKehadiranHarianWaliData(guruId: string, kelasId: string, tanggal: string) {
  const kelas = await pastikanKelas(guruId, kelasId)

  const tgl = new Date(tanggal + "T00:00:00")
  if (Number.isNaN(tgl.getTime())) throw new Error("Tanggal tidak valid")
  tgl.setHours(0, 0, 0, 0)

  const [kebijakan, harian, siswaRows, absensiPelajaran] = await Promise.all([
    getKebijakanHarian(),
    prisma.absensiHarianSiswa.findMany({
      where: { tanggal: tgl, siswa: { kelasId } },
      include: { siswa: { select: { id: true, nama: true, nis: true, jabatan: true } } },
      orderBy: { jamMasuk: "asc" },
    }),
    prisma.siswa.findMany({
      where: { kelasId, deletedAt: null },
      select: { id: true, nama: true, nis: true, jabatan: true },
      orderBy: { nama: "asc" },
    }),
    prisma.absensi.findMany({
      where: { kelasId, tanggal: tgl },
      include: {
        mataPelajaran: { select: { nama: true } },
        siswa: { select: { siswaId: true, status: true, keterangan: true } },
      },
    }),
  ])

  const logRows = harian.length
    ? await prisma.auditLog.findMany({
        where: { action: AKSI_SUSULAN, entityId: { in: harian.map((h) => h.id) } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : []
  const riwayatBy = new Map<string, any[]>()
  for (const log of logRows) {
    if (!log.entityId) continue
    const d = (log.detail ?? {}) as any
    const list = riwayatBy.get(log.entityId) ?? []
    list.push({
      id: log.id,
      oleh: log.user?.name ?? "Sistem",
      waktu: log.createdAt.toISOString(),
      lama: d.lama ?? null,
      baru: d.baru ?? null,
    })
    riwayatBy.set(log.entityId, list)
  }

  const mapHarian = new Map(harian.map((h) => [h.siswaId, h]))
  const rows = siswaRows.map((s) => {
    const h = mapHarian.get(s.id)
    const statusHarian = (h?.statusHarian as StatusHarian | null | undefined) ?? null
    return {
      siswaId: s.id,
      nama: s.nama,
      nis: s.nis,
      jabatan: s.jabatan,
      jamMasuk: h?.jamMasuk ?? null,
      jamPulang: h?.jamPulang ?? null,
      statusMasuk: h?.statusMasuk ?? null,
      statusPulang: h?.statusPulang ?? null,
      statusHarian,
      terlambatMenit: h?.terlambatMenit ?? null,
      sumber: [h?.sumberMasuk, h?.sumberPulang].filter(Boolean).join("/") || null,
      adaRekap: !!h,
      riwayat: h ? (riwayatBy.get(h.id) ?? []) : [],
    }
  })

  // Siswa hadir di sekolah (punya absen masuk) tetapi Alpa pada salah satu pelajaran
  const hadirSet = new Set(harian.filter((h) => h.jamMasuk).map((h) => h.siswaId))
  const alpaPelajaran: { siswaId: string; nama: string; mapel: string; status: string }[] = []
  const namaById = new Map(siswaRows.map((s) => [s.id, s.nama]))
  for (const a of absensiPelajaran) {
    for (const s of a.siswa) {
      if (hadirSet.has(s.siswaId) && s.status === "ALPA") {
        alpaPelajaran.push({
          siswaId: s.siswaId,
          nama: namaById.get(s.siswaId) ?? "-",
          mapel: a.mataPelajaran.nama,
          status: s.status,
        })
      }
    }
  }

  const terpisah = (r: (typeof rows)[number]) => r.statusHarian === "IZIN" || r.statusHarian === "SAKIT"
  const summary = {
    total: siswaRows.length,
    masuk: rows.filter((r) => r.jamMasuk).length,
    belumMasuk: rows.filter((r) => !r.jamMasuk && !terpisah(r)).length,
    terlambat: rows.filter((r) => r.statusMasuk === "TERLAMBAT").length,
    pulang: rows.filter((r) => r.jamPulang).length,
    pulangAwal: rows.filter((r) => r.statusPulang === "AWAL").length,
    izin: rows.filter((r) => r.statusHarian === "IZIN").length,
    sakit: rows.filter((r) => r.statusHarian === "SAKIT").length,
    alpaPelajaran: alpaPelajaran.length,
  }

  const p = (n: number) => String(n).padStart(2, "0")
  return {
    kelas,
    tanggal: `${tgl.getFullYear()}-${p(tgl.getMonth() + 1)}-${p(tgl.getDate())}`,
    kebijakan,
    rows,
    summary,
    alpaPelajaran,
    absensiPelajaran: absensiPelajaran.map((a) => ({
      id: a.id,
      mataPelajaran: a.mataPelajaran.nama,
      total: a.siswa.length,
      hadir: a.siswa.filter((s) => s.status === "HADIR" || s.status === "TERLAMBAT").length,
      alpa: a.siswa.filter((s) => s.status === "ALPA").length,
      izin: a.siswa.filter((s) => s.status === "IZIN").length,
      sakit: a.siswa.filter((s) => s.status === "SAKIT").length,
    })),
  }
}

/** Input/koreksi absensi harian oleh wali kelas. Jam hanya untuk tanggal lampau. */
export async function simpanAbsensiHarianWaliData(params: {
  guruId: string
  kelasId: string
  tanggal: string
  rows: BarisAbsensiWali[]
  actorUserId?: string | null
}) {
  await pastikanKelas(params.guruId, params.kelasId)

  const tgl = hariTanggal(new Date(params.tanggal + "T00:00:00"))
  if (Number.isNaN(tgl.getTime())) throw new Error("Tanggal tidak valid")
  const hariIni = hariTanggal(new Date())
  if (tgl > hariIni) throw new Error("Tanggal masa depan tidak dapat diisi")
  const hariIniSaja = tgl.getTime() === hariIni.getTime()

  const libur = await cekHariLibur(tgl)
  if (libur) throw new Error(`Tanggal tersebut hari libur: ${libur}`)

  const jamValid = (v: string | null | undefined) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
  const statusValid = (v: string | null | undefined) => !v || v === "HADIR" || v === "IZIN" || v === "SAKIT"
  for (const r of params.rows) {
    if (!jamValid(r.jamMasuk) || !jamValid(r.jamPulang)) throw new Error("Format jam harus HH:MM")
    if (!statusValid(r.statusHarian)) throw new Error("Status kehadiran tidak dikenal")
    if (hariIniSaja && (r.jamMasuk || r.jamPulang)) {
      throw new Error("Jam hanya dapat diisi untuk tanggal sebelumnya. Hari ini cukup pilih Izin/Sakit.")
    }
  }

  const siswaKelas = await prisma.siswa.findMany({
    where: { kelasId: params.kelasId, deletedAt: null },
    select: { id: true },
  })
  const sah = new Set(siswaKelas.map((s) => s.id))
  const rows = params.rows.filter((r) => sah.has(r.siswaId))
  if (rows.length === 0) throw new Error("Tidak ada data absensi yang diubah")

  const cfg = await getKebijakanHarian()
  let diubah = 0

  for (const r of rows) {
    const lama = await prisma.absensiHarianSiswa.findUnique({
      where: { siswaId_tanggal: { siswaId: r.siswaId, tanggal: tgl } },
    })

    let jamMasuk = r.jamMasuk ? r.jamMasuk : null
    let jamPulang = r.jamPulang ? r.jamPulang : null
    let statusHarian: StatusHarian | null = r.statusHarian ?? null
    if (statusHarian === "IZIN" || statusHarian === "SAKIT") {
      jamMasuk = null
      jamPulang = null
    } else if (jamMasuk || jamPulang) {
      statusHarian = "HADIR"
    }

    const masukBerubah = (lama?.jamMasuk ?? null) !== jamMasuk
    const pulangBerubah = (lama?.jamPulang ?? null) !== jamPulang
    const statusBerubah = ((lama?.statusHarian as string | null) ?? null) !== statusHarian
    if (!masukBerubah && !pulangBerubah && !statusBerubah) continue
    if (!lama && !jamMasuk && !jamPulang && !statusHarian) continue

    const data: Record<string, unknown> = {
      statusHarian,
      koreksiAlasan: "Input susulan wali kelas",
    }
    if (masukBerubah) {
      data.jamMasuk = jamMasuk
      data.eventMasukId = null
      data.sumberMasuk = jamMasuk ? "MANUAL" : null
      data.statusMasuk = null
      data.terlambatMenit = null
      if (jamMasuk) {
        const h = hitungStatusMasuk(jamMasuk, cfg)
        data.statusMasuk = h.status
        data.terlambatMenit = h.terlambatMenit
      }
    }
    if (pulangBerubah) {
      data.jamPulang = jamPulang
      data.eventPulangId = null
      data.sumberPulang = jamPulang ? "MANUAL" : null
      data.statusPulang = jamPulang ? hitungStatusPulang(jamPulang, cfg).status : null
    }

    const hasil = lama
      ? await prisma.absensiHarianSiswa.update({ where: { id: lama.id }, data })
      : await prisma.absensiHarianSiswa.create({ data: { siswaId: r.siswaId, tanggal: tgl, ...(data as any) } })

    diubah++
    if (params.actorUserId) {
      await audit(params.actorUserId, AKSI_SUSULAN, "AbsensiHarianSiswa", hasil.id, {
        siswaId: r.siswaId,
        tanggal: params.tanggal,
        kelasId: params.kelasId,
        lama: lama
          ? { jamMasuk: lama.jamMasuk, jamPulang: lama.jamPulang, statusHarian: lama.statusHarian }
          : null,
        baru: { jamMasuk, jamPulang, statusHarian },
      })
    }
  }

  return { diubah }
}
