import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { GerbangUI } from "./_components/gerbang-ui"

export const metadata = { title: "Gerbang Pondok — E-Learning QU" }

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  // guard role berat dilakukan di server action; halaman menampilkan hint bila bukan petugas
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gerbang Pondok</h1>
        <p className="text-sm text-gray-500">Check-out & check-in santri dengan izin sah — akses: Admin / Musyrif / Petugas Gerbang</p>
      </div>
      <GerbangUI />
    </div>
  )
}
