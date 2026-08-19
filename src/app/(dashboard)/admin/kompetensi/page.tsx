import { Suspense } from "react"
import { getKompetensis, getJurusanRefs, getMapelRefs } from "../actions"
import { KompetensiManagement } from "../_components/kompetensi-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; jurusanId?: string; mapelId?: string }>
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
  const [kompetensiResult, jurusanRefs, mapelRefs] = await Promise.all([
    getKompetensis({
      search: sp.search || "",
      page: parseInt(sp.page || "1"),
      limit: 10,
      jurusanId: sp.jurusanId || undefined,
      mapelId: sp.mapelId || undefined,
    }),
    getJurusanRefs(),
    getMapelRefs(),
  ])

  return (
    <KompetensiManagement
      initialData={kompetensiResult.data as any}
      initialTotal={kompetensiResult.total}
      initialTotalPages={kompetensiResult.totalPages}
      initialPage={parseInt(sp.page || "1")}
      initialSearch={sp.search || ""}
      jurusanRefs={jurusanRefs}
      mapelRefs={mapelRefs}
      initialJurusanId={sp.jurusanId || ""}
      initialMapelId={sp.mapelId || ""}
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
