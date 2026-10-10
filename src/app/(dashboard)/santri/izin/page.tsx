import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getSantriByUserId } from "@/lib/izin-santri"
import { getIzinSayaAction } from "./actions"
import { IzinSantriUI } from "./_components/izin-santri-ui"

export const metadata = { title: "Perizinan Santri — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const santri = await getSantriByUserId(session.user.id)
  if (!santri) {
    return (
      <div className="text-center py-16 text-gray-500">
        Akun ini tidak terdaftar sebagai santri. Hubungi admin pondok untuk aktivasi.
      </div>
    )
  }
  const data = await getIzinSayaAction()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Perizinan Santri</h1>
        <p className="text-sm text-gray-500">Pengajuan izin pulang & keluar pondok — {santri.nama}</p>
      </div>
      <IzinSantriUI
        initialSantri={{
          nama: santri.nama, nisNo: santri.nisNo, status: santri.status, keberadaan: santri.keberadaan,
          asrama: santri.asrama, kamar: santri.kamar,
        }}
        initialRows={data.rows as never}
      />
    </div>
  )
}
