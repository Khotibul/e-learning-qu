import { Suspense } from "react"
import { getGurus } from "../actions"
import { GuruManagement } from "../_components/guru-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; status?: string }>
}

function GuruSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

async function GuruContent({ searchParams }: PageProps) {
  const sp = await searchParams
  const page = parseInt(sp.page || "1")
  const search = sp.search || ""
  const includeDeleted = sp.status === "all"

  const { data, total, totalPages } = await getGurus({
    search,
    page,
    limit: 10,
    includeDeleted,
  })

  return (
    <GuruManagement
      initialData={data}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={page}
      initialSearch={search}
      initialIncludeDeleted={includeDeleted}
    />
  )
}

export default function GuruPage(props: PageProps) {
  return (
    <Suspense fallback={<GuruSkeleton />}>
      <GuruContent {...props} />
    </Suspense>
  )
}
