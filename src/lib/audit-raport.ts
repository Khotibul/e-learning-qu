/**
 * Inti audit raport — dipakai bersama oleh skrip CLI (`scripts/audit-raport.ts`),
 * endpoint cron harian (`/api/cron/audit-raport`), dan halaman admin
 * (`/admin/audit-raport`). Hanya membaca data, tidak pernah menulis.
 *
 * Nilai akhir dihitung ulang dengan aturan yang sama seperti `susunRekap` di
 * `src/app/(dashboard)/raport/actions.ts` (rumusnya dari `src/lib/raport.ts`).
 * Bila aturan rekap di aplikasi berubah, samakan juga fungsi `susunRekap` di
 * bawah ini.
 */

import type { PrismaClient } from "@prisma/client"
import { DEFAULT_PENGATURAN, hitungNilaiAkhir, predikatDari, rataRata } from "./raport"

export const TOLERANSI_AUDIT = 0.011

export type JenisTemuan =
  | "SELISIH"
  | "PREDIKAT"
  | "HILANG"
  | "TANPA_SUMBER"
  | "RATA"
  | "PERINGKAT"
  | "BUKAN_ANGGOTA"
  | "TANPA_RAPORT"
  | "UJIAN"

export type Temuan = {
  jenis: JenisTemuan
  semesterId: string
  semester: string
  kelasId: string
  kelas: string
  siswa?: string
  mapel?: string
  pesan: string
}

export type BarisKelasAudit = {
  semesterId: string
  semester: string
  semesterAktif: boolean
  kelasId: string
  kelas: string
  siswa: number
  mapel: number
  barisRaport: number
  nilaiTerisi: number
  nilaiKosong: number
  masalah: number
}

export type StatistikAudit = {
  selisihNilai: number
  salahPredikat: number
  barisHilang: number
  barisTanpaSumber: number
  salahRata: number
  peringkatSalah: number
  raportBukanAnggota: number
  siswaTanpaRaport: number
  nilaiUjianRusak: number
}

export type HasilAudit = {
  dijalankanPada: string
  durasiMs: number
  dataSumber: {
    kelas: number
    semester: number
    raport: number
    barisRaport: number
    nilai: number
    komponen: number
    nilaiKomponen: number
    nilaiKomponenTerisi: number
  }
  statistik: StatistikAudit
  totalMasalah: number
  perKelas: BarisKelasAudit[]
  temuan: Temuan[]
}

type Pengaturan = typeof DEFAULT_PENGATURAN

type Rekap = {
  siswas: { id: string; nama: string }[]
  mapels: { id: string; nama: string }[]
  nilai: Record<string, Record<string, number | null>>
}

/**
 * Salinan logika `susunRekap` tanpa guard sesi, supaya bisa berjalan di CLI
 * maupun route handler. Sumber kebenaran aturan tetap `src/lib/raport.ts`.
 */
async function susunRekap(
  db: PrismaClient,
  kelasId: string,
  semesterId: string,
  pengaturan: Pengaturan,
): Promise<Rekap> {
  const [siswas, pengajarans, komponens, nilaiUjian] = await Promise.all([
    db.siswa.findMany({
      where: { kelasId, deletedAt: null },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    }),
    db.pengajaran.findMany({
      where: { kelasId, deletedAt: null, mataPelajaran: { semesterId, deletedAt: null } },
      select: { mataPelajaran: { select: { id: true } } },
    }),
    db.komponenNilai.findMany({
      where: { kelasId, semesterId, deletedAt: null },
      select: {
        mapelId: true,
        jenis: true,
        bobot: true,
        nilais: { select: { siswaId: true, nilai: true } },
      },
    }),
    db.nilai.findMany({
      where: { semesterId, deletedAt: null, siswa: { kelasId, deletedAt: null } },
      select: {
        siswaId: true,
        mataPelajaranId: true,
        nilai: true,
        ujian: { select: { komponenRaport: true } },
      },
    }),
  ])

  const mapelIds = new Set<string>([
    ...pengajarans.map((p) => p.mataPelajaran.id),
    ...komponens.map((k) => k.mapelId),
    ...nilaiUjian.map((n) => n.mataPelajaranId),
  ])
  const mapels =
    mapelIds.size === 0
      ? []
      : await db.mataPelajaran.findMany({
          where: { id: { in: [...mapelIds] }, deletedAt: null },
          select: { id: true, nama: true },
          orderBy: { nama: "asc" },
        })

  const komponenByMapel = new Map<string, typeof komponens>()
  for (const k of komponens) {
    const arr = komponenByMapel.get(k.mapelId) ?? []
    arr.push(k)
    komponenByMapel.set(k.mapelId, arr)
  }

  const nilaiUjianBySiswaMapel = new Map<string, number[]>()
  const komponenUjianBySiswaMapel = new Map<string, { jenis: string; bobot: number; nilai: number }[]>()
  for (const n of nilaiUjian) {
    const key = `${n.siswaId}:${n.mataPelajaranId}`
    if (n.ujian?.komponenRaport) {
      const arr = komponenUjianBySiswaMapel.get(key) ?? []
      arr.push({ jenis: n.ujian.komponenRaport, bobot: 1, nilai: n.nilai })
      komponenUjianBySiswaMapel.set(key, arr)
    } else {
      const arr = nilaiUjianBySiswaMapel.get(key) ?? []
      arr.push(n.nilai)
      nilaiUjianBySiswaMapel.set(key, arr)
    }
  }

  const nilai: Record<string, Record<string, number | null>> = {}
  for (const siswa of siswas) {
    nilai[siswa.id] = {}
    for (const mapel of mapels) {
      const komponen = [
        ...(komponenByMapel.get(mapel.id) ?? []).map((k) => ({
          jenis: k.jenis,
          bobot: k.bobot,
          nilai: k.nilais.find((n) => n.siswaId === siswa.id)?.nilai ?? null,
        })),
        ...(komponenUjianBySiswaMapel.get(`${siswa.id}:${mapel.id}`) ?? []),
      ]
      const dariKomponen = hitungNilaiAkhir(komponen, pengaturan)
      const dariUjian = rataRata(nilaiUjianBySiswaMapel.get(`${siswa.id}:${mapel.id}`) ?? [])
      nilai[siswa.id][mapel.id] = dariKomponen ?? dariUjian
    }
  }

  return { siswas, mapels, nilai }
}

function beda(a: number, b: number) {
  return Math.abs(a - b) > TOLERANSI_AUDIT
}

function labelSemester(s: { nama: string; tahunAjaran: { nama: string } }) {
  return `${s.nama} ${s.tahunAjaran.nama}`
}

export async function auditRaport(db: PrismaClient): Promise<HasilAudit> {
  const mulai = Date.now()

  const [kelasAll, semesterAll, pengaturanAll, raports, nilaiAll, komponenAll, nilaiKomponenAll] =
    await Promise.all([
      db.kelas.findMany({
        where: { deletedAt: null },
        select: { id: true, nama: true, tingkat: true },
        orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
      }),
      db.semester.findMany({
        where: { deletedAt: null },
        select: { id: true, nama: true, isAktif: true, tahunAjaran: { select: { nama: true } } },
        orderBy: [{ tahunAjaran: { nama: "asc" } }, { nama: "asc" }],
      }),
      db.pengaturanRaport.findMany(),
      db.raport.findMany({
        select: {
          id: true,
          siswaId: true,
          kelasId: true,
          semesterId: true,
          status: true,
          rataRata: true,
          peringkat: true,
          siswa: { select: { nama: true } },
          nilais: { select: { mapelId: true, nilaiAkhir: true, predikat: true } },
        },
      }),
      db.nilai.findMany({
        where: { deletedAt: null },
        select: { id: true, siswaId: true, mataPelajaranId: true, semesterId: true, ujianId: true },
      }),
      db.komponenNilai.findMany({
        where: { deletedAt: null },
        select: { id: true, kelasId: true, semesterId: true },
      }),
      db.nilaiKomponen.findMany({ select: { komponenId: true, nilai: true } }),
    ])

  const temuan: Temuan[] = []
  const statistik: StatistikAudit = {
    selisihNilai: 0,
    salahPredikat: 0,
    barisHilang: 0,
    barisTanpaSumber: 0,
    salahRata: 0,
    peringkatSalah: 0,
    raportBukanAnggota: 0,
    siswaTanpaRaport: 0,
    nilaiUjianRusak: 0,
  }
  const perKelas: BarisKelasAudit[] = []

  // Nilai ujian yang mapelnya tidak sama dengan mapel ujiannya (data rusak).
  const ujianIds = [...new Set(nilaiAll.map((n) => n.ujianId).filter((x): x is string => !!x))]
  const ujians = ujianIds.length
    ? await db.ujian.findMany({
        where: { id: { in: ujianIds } },
        select: { id: true, mataPelajaranId: true },
      })
    : []
  const mapelUjian = new Map(ujians.map((u) => [u.id, u.mataPelajaranId]))
  for (const n of nilaiAll) {
    if (!n.ujianId) continue
    const mapel = mapelUjian.get(n.ujianId)
    if (mapel && mapel !== n.mataPelajaranId) {
      statistik.nilaiUjianRusak++
      temuan.push({
        jenis: "UJIAN",
        semesterId: n.semesterId,
        semester: "",
        kelasId: "",
        kelas: "",
        pesan: `[UJIAN] nilai ${n.id}: mapel nilai ${n.mataPelajaranId} berbeda dengan mapel ujian ${mapel}`,
      })
    }
  }

  const pengaturanBySemester = new Map(pengaturanAll.map((p) => [p.semesterId, p]))

  for (const semester of semesterAll) {
    const pengaturan: Pengaturan = { ...DEFAULT_PENGATURAN, ...(pengaturanBySemester.get(semester.id) ?? {}) }
    const namaSemester = labelSemester(semester)
    const raportSemester = raports.filter((r) => r.semesterId === semester.id)

    for (const kelas of kelasAll) {
      const rekap = await susunRekap(db, kelas.id, semester.id, pengaturan)
      const raportKelas = raportSemester.filter((r) => r.kelasId === kelas.id)
      const siswaIds = new Set(rekap.siswas.map((s) => s.id))

      const adaKomponen = komponenAll.some((k) => k.kelasId === kelas.id && k.semesterId === semester.id)
      const adaRaport = raportKelas.some((r) => r.nilais.length > 0)
      if (rekap.mapels.length === 0 && !adaKomponen && !adaRaport) continue

      const masalahAwal = temuan.length
      let terisi = 0
      let kosong = 0

      const tambah = (t: Omit<Temuan, "semesterId" | "semester" | "kelasId" | "kelas">) => {
        temuan.push({
          ...t,
          semesterId: semester.id,
          semester: namaSemester,
          kelasId: kelas.id,
          kelas: kelas.nama,
        })
      }

      for (const siswa of rekap.siswas) {
        const raport = raportKelas.find((r) => r.siswaId === siswa.id)

        for (const mapel of rekap.mapels) {
          const hitung = rekap.nilai[siswa.id]?.[mapel.id] ?? null
          const simpan = raport?.nilais.find((n) => n.mapelId === mapel.id) ?? null
          if (hitung == null) kosong++
          else terisi++

          if (hitung != null && simpan) {
            if (beda(hitung, simpan.nilaiAkhir)) {
              statistik.selisihNilai++
              tambah({
                jenis: "SELISIH",
                siswa: siswa.nama,
                mapel: mapel.nama,
                pesan: `[SELISIH] ${namaSemester} • ${kelas.nama} • ${siswa.nama} • ${mapel.nama}: raport ${simpan.nilaiAkhir} vs hitung ${hitung}`,
              })
            }
            const predikat = predikatDari(hitung, pengaturan)
            if (simpan.predikat !== predikat) {
              statistik.salahPredikat++
              tambah({
                jenis: "PREDIKAT",
                siswa: siswa.nama,
                mapel: mapel.nama,
                pesan: `[PREDIKAT] ${namaSemester} • ${kelas.nama} • ${siswa.nama} • ${mapel.nama}: raport ${simpan.predikat} vs hitung ${predikat}`,
              })
            }
          } else if (hitung != null && raport && !simpan) {
            statistik.barisHilang++
            tambah({
              jenis: "HILANG",
              siswa: siswa.nama,
              mapel: mapel.nama,
              pesan: `[HILANG] ${namaSemester} • ${kelas.nama} • ${siswa.nama} • ${mapel.nama}: ada nilai ${hitung} tetapi tidak ada baris raport`,
            })
          } else if (hitung == null && simpan) {
            statistik.barisTanpaSumber++
            tambah({
              jenis: "TANPA_SUMBER",
              siswa: siswa.nama,
              mapel: mapel.nama,
              pesan: `[TANPA SUMBER] ${namaSemester} • ${kelas.nama} • ${siswa.nama} • ${mapel.nama}: raport ${simpan.nilaiAkhir} tanpa nilai sumber`,
            })
          }
        }

        if (raport) {
          const hitungRata = rataRata(rekap.mapels.map((m) => rekap.nilai[siswa.id]?.[m.id] ?? null))
          if ((raport.rataRata ?? null) !== (hitungRata ?? null)) {
            statistik.salahRata++
            tambah({
              jenis: "RATA",
              siswa: siswa.nama,
              pesan: `[RATA] ${namaSemester} • ${kelas.nama} • ${siswa.nama}: raport ${raport.rataRata ?? "-"} vs hitung ${hitungRata ?? "-"}`,
            })
          }
        }
      }

      for (const r of raportSemester.filter((x) => x.kelasId === kelas.id && !siswaIds.has(x.siswaId))) {
        statistik.raportBukanAnggota++
        tambah({
          jenis: "BUKAN_ANGGOTA",
          siswa: r.siswa.nama,
          pesan: `[BUKAN ANGGOTA] ${namaSemester} • ${kelas.nama} • ${r.siswa.nama} (${r.status}): raport ada tetapi siswa tidak terdaftar di kelas ini`,
        })
      }

      const tanpaRaport = rekap.siswas.filter((s) => !raportKelas.some((r) => r.siswaId === s.id))
      if (raportKelas.length > 0 && tanpaRaport.length > 0) {
        statistik.siswaTanpaRaport += tanpaRaport.length
        tambah({
          jenis: "TANPA_RAPORT",
          pesan: `[TANPA RAPORT] ${namaSemester} • ${kelas.nama}: ${tanpaRaport.map((s) => s.nama).join(", ")}`,
        })
      }

      // Peringkat: unik 1..N dan urut sesuai rata-rata (hanya bila ditampilkan).
      if (raportKelas.length > 1 && pengaturan.tampilkanPeringkat) {
        const urut = [...raportKelas].sort(
          (a, b) => (a.peringkat ?? Number.MAX_SAFE_INTEGER) - (b.peringkat ?? Number.MAX_SAFE_INTEGER),
        )
        const peringkatUnik = urut.every((r, i) => r.peringkat === i + 1)
        const rataTurun = urut.every((r, i) => i === 0 || (urut[i - 1].rataRata ?? -1) >= (r.rataRata ?? -1))
        if (!peringkatUnik || !rataTurun) {
          statistik.peringkatSalah++
          tambah({
            jenis: "PERINGKAT",
            pesan: `[PERINGKAT] ${namaSemester} • ${kelas.nama}: peringkat ${
              peringkatUnik ? "tidak urut sesuai rata-rata" : "tidak unik/berurutan 1.." + raportKelas.length
            }`,
          })
        }
      }

      perKelas.push({
        semesterId: semester.id,
        semester: namaSemester,
        semesterAktif: semester.isAktif,
        kelasId: kelas.id,
        kelas: kelas.nama,
        siswa: rekap.siswas.length,
        mapel: rekap.mapels.length,
        barisRaport: raportKelas.reduce((a, r) => a + r.nilais.length, 0),
        nilaiTerisi: terisi,
        nilaiKosong: kosong,
        masalah: temuan.length - masalahAwal,
      })
    }
  }

  return {
    dijalankanPada: new Date().toISOString(),
    durasiMs: Date.now() - mulai,
    dataSumber: {
      kelas: kelasAll.length,
      semester: semesterAll.length,
      raport: raports.length,
      barisRaport: raports.reduce((a, r) => a + r.nilais.length, 0),
      nilai: nilaiAll.length,
      komponen: komponenAll.length,
      nilaiKomponen: nilaiKomponenAll.length,
      nilaiKomponenTerisi: nilaiKomponenAll.filter((n) => n.nilai != null).length,
    },
    statistik,
    totalMasalah: temuan.length,
    perKelas,
    temuan,
  }
}
