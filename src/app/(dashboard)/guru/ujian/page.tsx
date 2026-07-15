import { Suspense } from "react"
import { UjianManagementClient } from "./_components/ujian-management"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Kelola Ujian" }

export default function UjianPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>}>
      <UjianManagementClient />
    </Suspense>
  )
}
