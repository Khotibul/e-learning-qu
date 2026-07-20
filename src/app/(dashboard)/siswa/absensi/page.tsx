import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AbsensiSiswaClient } from "./_components/absensi-siswa"

export const metadata = { title: "Riwayat Absensi" }

export default function AbsensiSiswaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AbsensiSiswaClient />
    </Suspense>
  )
}
