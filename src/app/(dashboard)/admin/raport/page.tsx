import { Suspense } from "react"
import { getRaportRefs } from "../../raport/actions"
import { AdminRaportWorkspace } from "@/components/raport/admin-workspace"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Penilaian & Raport" }

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

async function Content() {
  const refs = await getRaportRefs()
  return <AdminRaportWorkspace refs={refs as never} />
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content />
    </Suspense>
  )
}
