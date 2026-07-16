import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getPengumumen, getKelasRefs } from "../actions"
import { PengumumanForm } from "../_components/pengumuman-form"
import { Skeleton } from "@/components/ui/skeleton"

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

async function Content() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const { data: pengumumen } = await getPengumumen({ page: 1, limit: 50 })
  const kelasRefs = await getKelasRefs()

  return (
    <PengumumanForm
      userId={userId}
      initialData={pengumumen as any}
      kelasRefs={kelasRefs as any}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content />
    </Suspense>
  )
}
