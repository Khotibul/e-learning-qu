import { Badge } from "@/components/ui/badge"

export const STATUS_IZIN_LABEL: Record<string, string> = {
  DRAFT: "Draft", DIAJUKU: "Diajukan",
  MENUNGGU_WALI: "Menunggu Wali", MENUNGGU_MUSYRIF: "Menunggu Musyrif", MENUNGGU_ADMIN: "Menunggu Admin",
  DISETUJUI: "Disetujui", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan",
  KEDALUWARSA: "Kedaluwarsa", SELESAI: "Selesai",
}

export const STATUS_IZIN_CLASS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  DIAJUKU: "bg-sky-100 text-sky-700",
  MENUNGGU_WALI: "bg-amber-100 text-amber-700",
  MENUNGGU_MUSYRIF: "bg-orange-100 text-orange-700",
  MENUNGGU_ADMIN: "bg-violet-100 text-violet-700",
  DISETUJUI: "bg-green-100 text-green-700",
  DITOLAK: "bg-red-100 text-red-700",
  DIBATALKAN: "bg-gray-200 text-gray-600",
  KEDALUWARSA: "bg-red-100 text-red-600",
  SELESAI: "bg-emerald-100 text-emerald-700",
}

export const KEBERADAAN_LABEL: Record<string, string> = {
  DI_PONDOK: "Di Pondok", KEGIATAN_LUAR: "Kegiatan Luar", IZIN_KELUAR: "Izin Keluar",
  IZIN_PULANG: "Pulang / Di Rumah", DALAM_PERJALANAN: "Dalam Perjalanan", DI_RUMAH: "Pulang / Di Rumah",
  TERLAMBAT_KEMBALI: "Terlambat Kembali", BELUM_KEMBALI: "Belum Kembali", TIDAK_DIKETAHUI: "Tidak Diketahui",
}

export const KEBERADAAN_CLASS: Record<string, string> = {
  DI_PONDOK: "bg-green-100 text-green-700",
  KEGIATAN_LUAR: "bg-sky-100 text-sky-700",
  IZIN_KELUAR: "bg-amber-100 text-amber-700",
  IZIN_PULANG: "bg-amber-100 text-amber-700",
  DALAM_PERJALANAN: "bg-blue-100 text-blue-700",
  DI_RUMAH: "bg-violet-100 text-violet-700",
  TERLAMBAT_KEMBALI: "bg-red-100 text-red-700",
  BELUM_KEMBALI: "bg-red-100 text-red-700",
  TIDAK_DIKETAHUI: "bg-gray-100 text-gray-600",
}

export const JENIS_IZIN_LABEL: Record<string, string> = {
  PULANG_RUMAH: "Izin Pulang ke Rumah", KELUAR_SEMENTARA: "Izin Keluar Sementara",
  BEROBAT: "Izin Berobat", KEGIATAN_KELUARGA: "Izin Kegiatan Keluarga",
  KEGIATAN_SEKOLAH: "Izin Kegiatan Sekolah", DARURAT: "Izin Darurat", LIBURAN_PONDOK: "Izin Liburan Pondok",
}

export function BadgeIzin({ status }: { status: string }) {
  return <Badge className={`${STATUS_IZIN_CLASS[status] ?? "bg-gray-100 text-gray-700"} border-0`}>{STATUS_IZIN_LABEL[status] ?? status}</Badge>
}

export function BadgeKeberadaan({ keberadaan }: { keberadaan: string }) {
  return <Badge className={`${KEBERADAAN_CLASS[keberadaan] ?? "bg-gray-100 text-gray-600"} border-0`}>{KEBERADAAN_LABEL[keberadaan] ?? keberadaan}</Badge>
}

export function fmtTanggal(d: string | Date | null | undefined) {
  if (!d) return "-"
  return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })
}

export function fmtJam(d: string | Date | null | undefined) {
  if (!d) return "-"
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
}
