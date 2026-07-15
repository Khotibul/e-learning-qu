import { Suspense } from "react"
import { NilaiGradingClient } from "./_components/nilai-grading"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Penilaian" }

export default function NilaiPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <NilaiGradingClient />
    </Suspense>
  )
}
