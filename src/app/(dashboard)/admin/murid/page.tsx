import { Suspense } from "react"
import { getMurids } from "../actions"
import { MuridManagement } from "../_components/murid-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; status?: string; kelas?: string }>
}

function MuridSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

async function MuridContent({ searchParams }: PageProps) {
  const sp = await searchParams
  const page = parseInt(sp.page || "1")
  const search = sp.search || ""
  const includeDeleted = sp.status === "all"
  const kelasId = sp.kelas || undefined

  const { data, total, totalPages } = await getMurids({
    search,
    page,
    limit: 10,
    includeDeleted,
    kelasId,
  })

  return (
    <MuridManagement
      initialData={data as any}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={page}
      initialSearch={search}
      initialIncludeDeleted={includeDeleted}
      initialKelasId={kelasId}
    />
  )
}

export default function MuridPage(props: PageProps) {
  return (
    <Suspense fallback={<MuridSkeleton />}>
      <MuridContent {...props} />
    </Suspense>
  )
}
