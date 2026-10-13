import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDashboardBendahara, getAntreanVerifikasi, getAkunLaporan, getJurnalUmum } from "./actions"
import { BendaharaUI } from "./_components/bendahara-ui"

export default async function BendaharaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  try {
    const [dash, antrean, akun, jurnal] = await Promise.all([
      getDashboardBendahara(),
      getAntreanVerifikasi(),
      getAkunLaporan(),
      getJurnalUmum(30),
    ])
    return <BendaharaUI dash={dash} antrean={antrean} akun={akun} jurnal={jurnal} />
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Hanya admin/bendahara/auditor yang dapat mengakses dashboard ini.
        </div>
      </div>
    )
  }
}
