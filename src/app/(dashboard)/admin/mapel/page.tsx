import { Suspense } from "react"
import { getMapels } from "../actions"
import { MapelManagement } from "../_components/mapel-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>
}

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

async function Content({ searchParams }: PageProps) {
  const sp = await searchParams
  const { data, total, totalPages } = await getMapels({
    search: sp.search || "",
    page: parseInt(sp.page || "1"),
    limit: 10,
  })

  return (
    <MapelManagement
      initialData={data as any}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={parseInt(sp.page || "1")}
      initialSearch={sp.search || ""}
    />
  )
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content {...props} />
    </Suspense>
  )
}
