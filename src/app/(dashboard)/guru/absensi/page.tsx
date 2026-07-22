import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getGuruKelasWithSiswa } from "./actions"
import { AbsensiClient } from "./_components/absensi-form"

export const metadata = { title: "Absensi" }

export default async function AbsensiPage() {
  const kelasList = await getGuruKelasWithSiswa()

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AbsensiClient kelasList={kelasList} />
    </Suspense>
  )
}
