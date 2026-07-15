import { Suspense } from "react"
import { SoalManagementClient } from "./_components/soal-management"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Kelola Soal" }

export default function SoalPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>}>
      <SoalManagementClient />
    </Suspense>
  )
}
