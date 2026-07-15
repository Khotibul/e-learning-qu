import { Suspense } from "react"
import { getSoal, getGuruMapelRefs } from "../../actions"
import { SoalFormClient } from "./_components/soal-form"
import { Skeleton } from "@/components/ui/skeleton"
import { notFound } from "next/navigation"

export const metadata = { title: "Detail Soal" }

async function SoalFormContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === "new"
  let soal = null
  let mapels = await getGuruMapelRefs()

  if (!isNew) {
    soal = await getSoal(id)
    if (!soal) notFound()
  }

  return <SoalFormClient soal={soal as any} mapels={mapels as any} isNew={isNew} />
}

export default function SoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <SoalFormContent params={params} />
    </Suspense>
  )
}
