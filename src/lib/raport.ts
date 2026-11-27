/**
 * Aturan perhitungan nilai raport (Kurikulum Merdeka).
 *
 * Nilai akhir mapel = gabungan nilai formatif, sumatif, proyek, dan praktik.
 * Setiap komponen punya bobot sendiri di dalam jenisnya, lalu tiap jenis
 * dikalikan bobot global semester. Bila suatu jenis tidak punya nilai,
 * bobot jenis tersebut diabaikan dan bobot jenis lain dinormalisasi.
 */

export type JenisKomponen = "FORMATIF" | "SUMATIF" | "PROYEK" | "PRAKTIK"

export const JENIS_KOMPONEN: { value: JenisKomponen; label: string; singkat: string }[] = [
  { value: "FORMATIF", label: "Formatif", singkat: "FMT" },
  { value: "SUMATIF", label: "Sumatif", singkat: "SMT" },
  { value: "PROYEK", label: "Proyek / P5", singkat: "PRJ" },
  { value: "PRAKTIK", label: "Praktik", singkat: "PRK" },
]

export interface BobotRaport {
  bobotFormatif: number
  bobotSumatif: number
  bobotProyek: number
  bobotPraktik: number
  ambangA: number
  ambangB: number
  ambangC: number
}

export const DEFAULT_PENGATURAN = {
  bobotFormatif: 30,
  bobotSumatif: 50,
  bobotProyek: 10,
  bobotPraktik: 10,
  kktp: 70,
  ambangA: 90,
  ambangB: 80,
  ambangC: 70,
  tampilkanPeringkat: true,
}

export function bobotJenis(bobot: BobotRaport, jenis: JenisKomponen): number {
  switch (jenis) {
    case "FORMATIF":
      return bobot.bobotFormatif
    case "SUMATIF":
      return bobot.bobotSumatif
    case "PROYEK":
      return bobot.bobotProyek
    case "PRAKTIK":
      return bobot.bobotPraktik
  }
}

export interface KomponenHitung {
  jenis: JenisKomponen | string
  bobot: number
  nilai: number | null
}

/**
 * Rata-rata tertimbang nilai komponen. Mengembalikan null bila belum ada
 * satu pun nilai yang terisi.
 */
export function hitungNilaiAkhir(komponen: KomponenHitung[], pengaturan: BobotRaport): number | null {
  const perJenis = new Map<string, { jumlah: number; bobot: number }>()
  for (const k of komponen) {
    if (k.nilai == null || Number.isNaN(k.nilai)) continue
    const bobotKomponen = k.bobot > 0 ? k.bobot : 1
    const acc = perJenis.get(k.jenis) ?? { jumlah: 0, bobot: 0 }
    acc.jumlah += k.nilai * bobotKomponen
    acc.bobot += bobotKomponen
    perJenis.set(k.jenis, acc)
  }
  if (perJenis.size === 0) return null

  let total = 0
  let totalBobot = 0
  for (const [jenis, acc] of perJenis) {
    const bobot = bobotJenis(pengaturan, jenis as JenisKomponen)
    if (bobot <= 0 || acc.bobot <= 0) continue
    total += (acc.jumlah / acc.bobot) * bobot
    totalBobot += bobot
  }
  if (totalBobot === 0) return null
  return Math.round((total / totalBobot) * 100) / 100
}

export function predikatDari(nilai: number, pengaturan: Pick<BobotRaport, "ambangA" | "ambangB" | "ambangC">): string {
  if (nilai >= pengaturan.ambangA) return "A"
  if (nilai >= pengaturan.ambangB) return "B"
  if (nilai >= pengaturan.ambangC) return "C"
  return "D"
}

export function deskripsiCapaian(mapel: string, nilai: number, predikat: string): string {
  const kalimat: Record<string, string> = {
    A: "menunjukkan penguasaan sangat baik",
    B: "menunjukkan penguasaan baik",
    C: "menunjukkan penguasaan cukup",
    D: "memerlukan pendampingan untuk mencapai kriteria",
  }
  return `${kalimat[predikat] ?? kalimat.D} pada mata pelajaran ${mapel} dengan nilai ${nilai}.`
}

export function rataRata(nilai: (number | null | undefined)[]): number | null {
  const isi = nilai.filter((n): n is number => typeof n === "number" && !Number.isNaN(n))
  if (isi.length === 0) return null
  return Math.round((isi.reduce((a, b) => a + b, 0) / isi.length) * 100) / 100
}

export function bulatDua(n: number): number {
  return Math.round(n * 100) / 100
}
