import { Suspense } from "react"
import { getGuruMurids, getGuruKelasForMurid } from "../actions"
import { MuridManagement } from "./_components/murid-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; kelas?: string }>
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
  const kelasId = sp.kelas || undefined

  const [result, kelasRefs] = await Promise.all([
    getGuruMurids({ search, page, limit: 10, kelasId }),
    getGuruKelasForMurid(),
  ])

  return (
    <MuridManagement
      initialData={result.data as any}
      initialTotal={result.total}
      initialTotalPages={result.totalPages}
      initialPage={page}
      initialSearch={search}
      initialKelasId={kelasId ?? ""}
      kelasRefs={kelasRefs as any}
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
