/**
 * Audit kesesuaian nilai raport dengan data nilai sumber (read-only).
 *
 * Logika audit ada di `src/lib/audit-raport.ts` dan dipakai bersama oleh
 * endpoint cron harian serta halaman admin, jadi hasil ketiganya selalu sama.
 *
 * Pemakaian:
 *   npm run audit:raport
 *   npm run audit:raport -- --all   # tampilkan semua detail
 *
 * Kode keluar: 0 = tidak ada ketidaksesuaian, 1 = ada ketidaksesuaian,
 * 2 = gagal menjalankan audit (mis. database tidak terjangkau).
 */

import { loadEnvConfig } from "@next/env"
import { PrismaClient } from "@prisma/client"
import { auditRaport } from "../src/lib/audit-raport"

loadEnvConfig(process.cwd())
const prisma = new PrismaClient()

const BATAS_DETAIL = 100
const tampilkanSemua = process.argv.includes("--all")

async function main() {
  const hasil = await auditRaport(prisma)

  const d = hasil.dataSumber
  console.log("=== DATA SUMBER ===")
  console.log(
    `kelas ${d.kelas} • semester ${d.semester} • raport ${d.raport} • raport_nilai ${d.barisRaport}`,
  )
  console.log(
    `nilai (ujian/manual) ${d.nilai} • komponen ${d.komponen} • nilai_komponen ${d.nilaiKomponen} (terisi ${d.nilaiKomponenTerisi})`,
  )

  const semesterUrut = [...new Set(hasil.perKelas.map((b) => b.semesterId))]
  for (const semesterId of semesterUrut) {
    const baris = hasil.perKelas.filter((b) => b.semesterId === semesterId)
    const contoh = baris[0]
    console.log(`\n=== ${contoh.semester}${contoh.semesterAktif ? " (AKTIF)" : ""} ===`)
    console.log(
      baris
        .map(
          (b) =>
            `  ${b.kelas.padEnd(12)} siswa ${String(b.siswa).padStart(3)} • mapel ${String(b.mapel).padStart(2)} • sel raport ${String(b.barisRaport).padStart(4)} • nilai terisi ${String(b.nilaiTerisi).padStart(3)} kosong ${String(b.nilaiKosong).padStart(3)} • masalah ${b.masalah}`,
        )
        .join("\n"),
    )
  }

  const s = hasil.statistik
  console.log("\n=== RINGKASAN ===")
  console.log(
    `selisih nilai ${s.selisihNilai} • predikat salah ${s.salahPredikat} • baris hilang ${s.barisHilang} • baris tanpa sumber ${s.barisTanpaSumber}`,
  )
  console.log(
    `rata-rata salah ${s.salahRata} • peringkat salah ${s.peringkatSalah} • raport bukan anggota ${s.raportBukanAnggota} • siswa tanpa raport ${s.siswaTanpaRaport}`,
  )
  console.log(`nilai ujian dengan mapel tidak cocok ${s.nilaiUjianRusak}`)
  console.log(`TOTAL MASALAH: ${hasil.totalMasalah}`)

  if (hasil.temuan.length > 0) {
    const tampil = tampilkanSemua ? hasil.temuan : hasil.temuan.slice(0, BATAS_DETAIL)
    console.log(`\n=== DETAIL${tampilkanSemua ? "" : ` (${BATAS_DETAIL} pertama)`} ===`)
    console.log(tampil.map((t) => t.pesan).join("\n"))
    if (hasil.temuan.length > tampil.length) {
      console.log(
        `... dan ${hasil.temuan.length - tampil.length} masalah lain (jalankan dengan --all untuk melihat semuanya)`,
      )
    }
  }

  return hasil.totalMasalah
}

main()
  .then((totalMasalah) => {
    if (totalMasalah > 0) {
      console.log("\nHasil: ADA KETIDAKSESUAIAN.")
      process.exitCode = 1
    } else {
      console.log("\nHasil: semua nilai raport sesuai dengan data nilai.")
      process.exitCode = 0
    }
  })
  .catch((e) => {
    console.error("Audit gagal dijalankan:", e instanceof Error ? e.message : e)
    process.exitCode = 2
  })
  .finally(() => prisma.$disconnect())
