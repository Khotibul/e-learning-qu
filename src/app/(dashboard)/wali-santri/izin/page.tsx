import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getIzinAnakAction } from "./actions"
import { IzinWaliUI } from "./_components/izin-wali-ui"

export const metadata = { title: "Persetujuan Izin Anak — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const data = await getIzinAnakAction().catch(() => null)
  if (!data) {
    return (
      <div className="text-center py-16 text-gray-500">
        Akun ini tidak terdaftar sebagai wali santri. Hubungi admin pondok untuk mengaktifkan akun wali.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Persetujuan Izin Anak</h1>
        <p className="text-sm text-gray-500">Sebagai {data.wali.hubungan.toLowerCase()} {data.wali.nama}</p>
      </div>
      <IzinWaliUI initialRows={data.rows as never} />
    </div>
  )
}
