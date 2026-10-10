import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getAntreanMusyrif, getMonitoringPondokAction } from "./actions"
import { IzinMusyrifUI } from "./_components/izin-musyrif-ui"

export const metadata = { title: "Izin Musyrif — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  let data: Awaited<ReturnType<typeof getAntreanMusyrif>> | null = null
  let mon: Awaited<ReturnType<typeof getMonitoringPondokAction>> | null = null
  try {
    ;[data, mon] = await Promise.all([getAntreanMusyrif(), getMonitoringPondokAction()])
  } catch {
    return <div className="text-center py-16 text-gray-500">Halaman ini khusus Musyrif / Pembina Asrama.</div>
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Perizinan Santri — Musyrif</h1>
        <p className="text-sm text-gray-500">Persetujuan tahap musyrif & monitoring keberadaan santri binaan</p>
      </div>
      <IzinMusyrifUI antrean={data.rows as never} monitoring={mon as never} />
    </div>
  )
}
