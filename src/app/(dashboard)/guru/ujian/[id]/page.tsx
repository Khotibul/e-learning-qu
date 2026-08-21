import { Suspense } from "react"
import { getUjian, getGuruMapelRefs, getGuruKelasRefs, getGuruWaliKelasRefs, getBankSoalRefs } from "../../actions"
import { getSemesterRefs, getTahunAjaranRefs } from "../../../admin/actions"
import { UjianFormClient } from "./_components/ujian-form"
import { Skeleton } from "@/components/ui/skeleton"
import { notFound } from "next/navigation"

export const metadata = { title: "Detail Ujian" }

async function UjianFormContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === "new"
  let ujian = null

  const [mapels, kelass, waliKelass, semesters, tahunAjarans, bankSoal] = await Promise.all([
    getGuruMapelRefs(),
    getGuruKelasRefs(),
    getGuruWaliKelasRefs(),
    getSemesterRefs(),
    getTahunAjaranRefs(),
    getBankSoalRefs(),
  ])

  if (!isNew) {
    ujian = await getUjian(id)
    if (!ujian) notFound()
  }

  return (
    <UjianFormClient
      ujian={ujian as any}
      mapels={mapels as any}
      kelass={kelass as any}
      waliKelass={waliKelass as any}
      semesters={semesters as any}
      tahunAjarans={tahunAjarans as any}
      bankSoal={bankSoal as any}
      isNew={isNew}
    />
  )
}

export default function UjianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <UjianFormContent params={params} />
    </Suspense>
  )
}
