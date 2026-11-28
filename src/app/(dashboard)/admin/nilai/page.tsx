import { Suspense } from "react"
import { getKelasRefs, getMapelRefs, getSemesterRefs } from "../actions"
import { getRekapNilaiAdmin } from "../../raport/actions"
import { NilaiOverview } from "../_components/nilai-overview"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ kelas?: string; mapel?: string; semester?: string; search?: string; page?: string }>
}

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

async function Content({ searchParams }: PageProps) {
  const sp = await searchParams
  const kelasId = sp.kelas || undefined
  const mapelId = sp.mapel || undefined
  const semesterId = sp.semester || undefined
  const search = sp.search || ""
  const page = parseInt(sp.page || "1")

  const [rekap, kelasRefs, mapelRefs, semesterRefs] = await Promise.all([
    getRekapNilaiAdmin({
      kelasId,
      mapelId,
      semesterId,
      search,
      page,
      limit: 20,
    }),
    getKelasRefs(),
    getMapelRefs(),
    getSemesterRefs(),
  ])

  return (
    <NilaiOverview
      initialData={rekap.data}
      initialTotal={rekap.total}
      initialTotalPages={rekap.totalPages}
      initialPage={page}
      initialSearch={search}
      initialKelasId={kelasId ?? ""}
      initialMapelId={mapelId ?? ""}
      initialSemesterId={rekap.semesterId ?? ""}
      initialSummary={rekap.summary}
      kelasRefs={kelasRefs}
      mapelRefs={mapelRefs}
      semesterRefs={semesterRefs}
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
