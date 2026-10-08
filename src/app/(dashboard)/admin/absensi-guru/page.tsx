import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminAbsensiGuru } from "./_components/admin-absensi-guru"

export const metadata = { title: "Absensi Guru" }

export default function AdminAbsensiGuruPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AdminAbsensiGuru />
    </Suspense>
  )
}
