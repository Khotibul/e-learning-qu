import { Suspense } from "react"
import { getNilais, getKelasRefs, getMapelRefs, getSemesterRefs } from "../actions"
import { NilaiOverview } from "../_components/nilai-overview"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ kelas?: string; mapel?: string; semester?: string; page?: string }>
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
  const kelasId = sp.kelas || ""
  const mapelId = sp.mapel || ""
  const semesterId = sp.semester || ""
  const page = parseInt(sp.page || "1")

  const { data, total, totalPages } = await getNilais({
    kelasId: kelasId || undefined,
    mapelId: mapelId || undefined,
    semesterId: semesterId || undefined,
    page,
    limit: 20,
  })

  const [kelasRefs, mapelRefs, semesterRefs] = await Promise.all([
    getKelasRefs(),
    getMapelRefs(),
    getSemesterRefs(),
  ])

  return (
    <NilaiOverview
      initialData={data as any}
      initialTotal={total}
      initialTotalPages={totalPages}
      initialPage={page}
      initialKelasId={kelasId}
      initialMapelId={mapelId}
      initialSemesterId={semesterId}
      kelasRefs={kelasRefs as any}
      mapelRefs={mapelRefs as any}
      semesterRefs={semesterRefs as any}
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
