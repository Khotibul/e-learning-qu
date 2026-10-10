import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  getAntreanAdmin, getStatistikAdmin, getRiwayatAdmin, getPengaturanIzin, getAsramaOpts, getKonflikAbsensiAction,
} from "./actions"
import { IzinAdminUI } from "./_components/izin-admin-ui"

export const metadata = { title: "Izin Santri — Admin Pondok" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  let data: {
    antrean: unknown; statistik: unknown; riwayat: unknown; pengaturan: unknown; asrama: unknown; konflik: unknown
  }
  try {
    const [antrean, statistik, riwayat, pengaturan, asrama, konflik] = await Promise.all([
      getAntreanAdmin(), getStatistikAdmin(), getRiwayatAdmin({ page: 1 }),
      getPengaturanIzin(), getAsramaOpts(), getKonflikAbsensiAction(),
    ])
    data = {
      antrean: antrean.rows, statistik, riwayat: riwayat.data,
      pengaturan, asrama, konflik: konflik.rows,
    }
  } catch {
    return <div className="text-center py-16 text-gray-500">Halaman ini khusus Admin.</div>
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Perizinan Santri — Admin Pondok</h1>
        <p className="text-sm text-gray-500">Keputusan akhir, statistik, pengaturan persetujuan, asrama & kamar</p>
      </div>
      <IzinAdminUI
        antrean={data.antrean as never}
        statistik={data.statistik as never}
        riwayat={data.riwayat as never}
        pengaturan={data.pengaturan as never}
        asrama={data.asrama as never}
        konflik={data.konflik as never}
      />
    </div>
  )
}
