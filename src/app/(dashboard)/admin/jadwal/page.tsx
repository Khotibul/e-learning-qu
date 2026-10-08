import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { JadwalManagement } from "./_components/jadwal-management"

export const metadata = { title: "Jadwal Mengajar" }

export default function AdminJadwalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <JadwalManagement />
    </Suspense>
  )
}
