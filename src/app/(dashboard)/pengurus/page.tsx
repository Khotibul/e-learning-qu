import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDashboardPengurus } from "./actions"
import { PengurusUI } from "./_components/pengurus-ui"

export const metadata = { title: "Pengurus Pondok — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  let dash: Awaited<ReturnType<typeof getDashboardPengurus>>
  try {
    dash = await getDashboardPengurus()
  } catch {
    return <div className="text-center py-16 text-gray-500">Halaman ini khusus Pengurus Pondok / Admin (dengan penugasan aktif).</div>
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Pengurus Pondok</h1>
        <p className="text-sm text-gray-500">Operasional harian: kegiatan, absensi, perizinan, asrama & pembinaan</p>
      </div>
      <PengurusUI dash={dash as never} />
    </div>
  )
}
