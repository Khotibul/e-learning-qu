import { Suspense } from "react"
import { getSemesters } from "../actions"
import { SemesterManagement } from "../_components/semester-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; tahunAjaran?: string }>
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
  const { data, total, totalPages } = await getSemesters({
    search: sp.search || "",
    page: parseInt(sp.page || "1"),
    limit: 10,
    tahunAjaranId: sp.tahunAjaran || undefined,
  })

  return (
    <SemesterManagement
      initialData={data as any}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={parseInt(sp.page || "1")}
      initialSearch={sp.search || ""}
      initialTahunAjaranId={sp.tahunAjaran || ""}
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
