import { Suspense } from "react"
import { getDashboardStats } from "./actions"
import { AdminDashboardClient } from "./_components/admin-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "Dashboard Admin",
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-2xl border p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function DashboardContent() {
  const stats = await getDashboardStats()
  return <AdminDashboardClient stats={stats} />
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
