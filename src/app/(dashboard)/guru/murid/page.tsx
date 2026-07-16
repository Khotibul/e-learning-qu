import { Suspense } from "react"
import { getGuruMurids, getGuruPendingMurids, getGuruKelasForMurid } from "../actions"
import { MuridManagement } from "./_components/murid-management"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; kelas?: string; tab?: string }>
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
  const tab = sp.tab || "saya"

  const kelasRefs = await getGuruKelasForMurid()

  if (tab === "pendaftar") {
    const result = await getGuruPendingMurids({ search, page, limit: 10 })
    return (
      <MuridManagement
        initialData={result.data as any}
        initialTotal={result.total}
        initialTotalPages={result.totalPages}
        initialPage={page}
        initialSearch={search}
        initialKelasId=""
        kelasRefs={kelasRefs as any}
        initialTab="pendaftar"
      />
    )
  }

  const result = await getGuruMurids({ search, page, limit: 10, kelasId })
  return (
    <MuridManagement
      initialData={result.data as any}
      initialTotal={result.total}
      initialTotalPages={result.totalPages}
      initialPage={page}
      initialSearch={search}
      initialKelasId={kelasId ?? ""}
      kelasRefs={kelasRefs as any}
      initialTab="saya"
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
