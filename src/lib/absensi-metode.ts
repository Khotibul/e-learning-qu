// Modul murni tanpa Prisma — aman di-import dari client & server.

export const DAFTAR_METODE = [
  { value: "TANPA", label: "Tanpa verifikasi (waktu saja)" },
  { value: "FOTO", label: "Foto Selfie" },
  { value: "SIDIK_JARI", label: "Biometrik Sidik Jari" },
  { value: "FOTO_SIDIK_JARI", label: "Foto + Sidik Jari" },
  { value: "GPS_FOTO", label: "GPS + Foto" },
  { value: "GPS_SIDIK_JARI", label: "GPS + Sidik Jari" },
  { value: "GPS_FOTO_SIDIK_JARI", label: "GPS + Foto + Sidik Jari" },
] as const

export type MetodeAbsensi = string

export function labelMetode(metode: string | null | undefined): string {
  const m = (metode || "TANPA").toUpperCase()
  return DAFTAR_METODE.find((x) => x.value === m)?.label ?? m
}

export function wajibFoto(metode: MetodeAbsensi | null | undefined): boolean {
  const m = (metode || "TANPA").toUpperCase()
  return m === "FOTO" || m === "FOTO_SIDIK_JARI" || m === "GPS_FOTO" || m === "GPS_FOTO_SIDIK_JARI"
}

export function wajibSidikJari(metode: MetodeAbsensi | null | undefined): boolean {
  const m = (metode || "TANPA").toUpperCase()
  return m === "SIDIK_JARI" || m === "FOTO_SIDIK_JARI" || m === "GPS_SIDIK_JARI" || m === "GPS_FOTO_SIDIK_JARI"
}

export function wajibGps(metode: MetodeAbsensi | null | undefined): boolean {
  const m = (metode || "TANPA").toUpperCase()
  return m === "GPS_FOTO" || m === "GPS_SIDIK_JARI" || m === "GPS_FOTO_SIDIK_JARI"
}

export function haversineMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
