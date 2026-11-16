import { Loader2 } from "lucide-react"

/**
 * Ditampilkan selama data halaman dashboard dimuat. Berguna saat server sibuk:
 * pengguna melihat proses berjalan, bukan halaman kosong yang memancing refresh
 * berulang (yang justru menambah beban).
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Memuat data…</p>
    </div>
  )
}
