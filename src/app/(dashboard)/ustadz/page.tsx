import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDashboardUstadz } from "./actions"
import { UstadzUI } from "./_components/ustadz-ui"

export const metadata = { title: "Ustadz/Ustadzah — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  let dash: Awaited<ReturnType<typeof getDashboardUstadz>>
  try {
    dash = await getDashboardUstadz()
  } catch {
    return <div className="text-center py-16 text-gray-500">Halaman ini khusus Ustadz/Ustadzah dengan penugasan aktif (atau Admin).</div>
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Ustadz / Ustadzah</h1>
        <p className="text-sm text-gray-500">Jadwal mengajar, diniyah & tahfidz, pembinaan, dan rekomendasi izin santri binaan</p>
      </div>
      <UstadzUI dash={dash as never} />
    </div>
  )
}
