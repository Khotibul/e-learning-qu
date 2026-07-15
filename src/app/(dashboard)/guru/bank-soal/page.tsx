import { Suspense } from "react"
import { getBankSoal, getKategoriRefs, getGuruMapelRefs } from "../actions"
import { BankSoalClient } from "./_components/bank-soal"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Bank Soal" }

async function BankSoalContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const search = (sp.search as string) || ""
  const page = Number(sp.page) || 1
  const mataPelajaranId = (sp.mapel as string) || ""
  const kategoriId = (sp.kategori as string) || ""

  const [data, kategories, mapels] = await Promise.all([
    getBankSoal({ search, mataPelajaranId, kategoriId, page, limit: 20 }),
    getKategoriRefs(),
    getGuruMapelRefs(),
  ])

  return (
    <BankSoalClient
      data={data as any}
      kategories={kategories as any}
      mapels={mapels as any}
      searchParams={{ search, page, mataPelajaranId, kategoriId }}
    />
  )
}

export default function BankSoalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      }
    >
      <BankSoalContent searchParams={searchParams} />
    </Suspense>
  )
}
