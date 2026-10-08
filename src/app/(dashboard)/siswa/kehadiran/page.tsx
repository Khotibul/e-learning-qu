import type { Metadata } from "next"
import { Suspense } from "react"
import KehadiranSiswa from "./_components/kehadiran-siswa"

export const metadata: Metadata = {
  title: "Monitoring Kehadiran | Siswa",
}

export default function KehadiranPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat kehadiran…</div>}>
      <KehadiranSiswa />
    </Suspense>
  )
}
