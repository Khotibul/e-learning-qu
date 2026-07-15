import { Suspense } from "react"
import { getGuruAnalytics } from "../actions"
import { AnalitikDashboardClient } from "./_components/analitik-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Analitik" }

async function AnalitikContent() {
  const data = await getGuruAnalytics()
  return <AnalitikDashboardClient data={data} />
}

export default function AnalitikPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      }
    >
      <AnalitikContent />
    </Suspense>
  )
}
