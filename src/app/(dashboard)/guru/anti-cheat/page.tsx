import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AntiCheatDashboard } from "./_components/anti-cheat-dashboard"

export const metadata = { title: "Anti-Cheat" }

export default async function AntiCheatPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AntiCheatDashboard />
    </Suspense>
  )
}
