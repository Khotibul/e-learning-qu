import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getOutletKasir } from "./actions"
import { KantinUI } from "./_components/kantin-ui"

export default async function KantinPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  try {
    const outlets = await getOutletKasir()
    return <KantinUI outlets={outlets} />
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Anda bukan kasir yang ditugaskan. Hubungi bendahara/admin untuk penugasan outlet kantin.
        </div>
      </div>
    )
  }
}
