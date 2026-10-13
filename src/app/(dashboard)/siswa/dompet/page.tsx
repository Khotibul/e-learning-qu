import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getDompetSaya, getRiwayatTransaksiKantinSaya, getTagihanSaya } from "./actions"
import { DompetUI } from "./_components/dompet-ui"

export default async function DompetPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  try {
    const [dompet, transaksi, tagihan] = await Promise.all([
      getDompetSaya(),
      getRiwayatTransaksiKantinSaya(),
      getTagihanSaya(),
    ])
    return <DompetUI dompet={dompet} transaksi={transaksi} tagihan={tagihan} />
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun ini belum memiliki dompet. Hubungi pengurus pondok untuk aktivasi uang saku.
        </div>
      </div>
    )
  }
}
