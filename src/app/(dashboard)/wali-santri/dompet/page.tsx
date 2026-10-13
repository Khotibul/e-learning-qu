import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getAnakUntukWali, getRiwayatTopupWali } from "../../siswa/dompet/actions"
import { WaliDompetUI } from "./_components/wali-dompet-ui"

export default async function WaliDompetPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  try {
    const [anak, riwayat] = await Promise.all([getAnakUntukWali(), getRiwayatTopupWali()])
    return <WaliDompetUI anak={anak} riwayat={riwayat} />
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Akun ini belum terdaftar sebagai wali santri. Hubungi pengurus pondok.
        </div>
      </div>
    )
  }
}
