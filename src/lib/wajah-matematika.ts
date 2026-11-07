// Modul murni tanpa Prisma — aman di-import dari client & server.

export const DIMENSI_DESKRIPTOR = 128
/** Ambang jarak euclidean: ≤ 0.52 dianggap orang yang sama (face-api). */
export const AMBANG_WAJAH = 0.52
/** Selisih minimum dengan kandidat kedua — cegah salah orang saat wajah mirip. */
export const MARGIN_WAJAH = 0.03

export function normalisasiDeskriptor(input: unknown): number[] {
  if (!Array.isArray(input) || input.length !== DIMENSI_DESKRIPTOR) {
    throw new Error(`Descriptor wajah harus ${DIMENSI_DESKRIPTOR} angka`)
  }
  const out = input.map((v) => Number(v))
  if (out.some((v) => !Number.isFinite(v) || Math.abs(v) > 5)) {
    throw new Error("Descriptor wajah tidak valid")
  }
  return out
}

export function jarakEuclidean(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let jumlah = 0
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    jumlah += d * d
  }
  return Math.sqrt(jumlah)
}

export function rataRataDeskriptor(samples: number[][]): number[] {
  if (samples.length === 0) throw new Error("Minimal satu sampel wajah")
  const hasil = new Array(DIMENSI_DESKRIPTOR).fill(0)
  for (const s of samples) {
    if (s.length !== DIMENSI_DESKRIPTOR) throw new Error("Panjang descriptor tidak konsisten")
    for (let i = 0; i < DIMENSI_DESKRIPTOR; i++) hasil[i] += s[i] / samples.length
  }
  return hasil
}

/** Bulatkan jarak untuk ditampilkan (3 desimal). */
export function bulatJarak(v: number): number {
  return Math.round(v * 1000) / 1000
}

export function labelTipeWajah(tipe: string | null | undefined): string {
  if (tipe === "SISWA") return "Siswa"
  if (tipe === "GURU") return "Guru"
  if (tipe === "PEGAWAI") return "Pegawai"
  return "-"
}
