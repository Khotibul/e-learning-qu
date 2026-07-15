import { Suspense } from "react"
import { getStatistikGuruMurid, getStatistikPerKelas, getStatistikPerMapel } from "../actions"
import { StatistikDashboard } from "../_components/statistik-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

async function Content() {
  const [guruMurid, perKelas, perMapel] = await Promise.all([
    getStatistikGuruMurid(),
    getStatistikPerKelas(),
    getStatistikPerMapel(),
  ])

  return (
    <StatistikDashboard
      guruMurid={guruMurid}
      perKelas={perKelas}
      perMapel={perMapel}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content />
    </Suspense>
  )
}
