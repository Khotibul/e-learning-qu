import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDashboardKepala } from "./actions"
import { KepalaPondokUI } from "./_components/kepala-pondok-ui"

export const metadata = { title: "Kepala Pondok — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  let dash: Awaited<ReturnType<typeof getDashboardKepala>>
  try {
    dash = await getDashboardKepala()
  } catch {
    return <div className="text-center py-16 text-gray-500">Halaman ini khusus Kepala Pondok / Admin.</div>
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Kepala Pondok</h1>
        <p className="text-sm text-gray-500">Monitoring eksekutif & pengambilan keputusan operasional kepesantrenan</p>
      </div>
      <KepalaPondokUI dash={dash as never} />
    </div>
  )
}
