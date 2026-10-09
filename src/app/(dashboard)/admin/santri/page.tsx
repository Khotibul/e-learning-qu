import { Suspense } from "react"
import { getSantris } from "./actions"
import { SantriManagement } from "../_components/santri-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>
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
  const { data, total, totalPages } = await getSantris({
    search: sp.search || "",
    page: parseInt(sp.page || "1"),
    limit: 10,
    status: sp.status || undefined,
  })

  return (
    <SantriManagement
      initialData={data as any}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={parseInt(sp.page || "1")}
      initialSearch={sp.search || ""}
      initialStatus={sp.status || ""}
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
