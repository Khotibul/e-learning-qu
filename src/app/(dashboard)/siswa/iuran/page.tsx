"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Loader2, Wallet, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getIuranSiswa, bayarIuran } from "../actions"

export default function IuranPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const d = await getIuranSiswa()
      setData(d as any)
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleBayar = async (iuranId: string) => {
    setPayingId(iuranId)
    try {
      await bayarIuran(iuranId)
      toast.success("Pembayaran berhasil dicatat")
      fetchData()
    } catch { toast.error("Gagal membayar") }
    finally { setPayingId(null) }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-muted-foreground">Anda belum memiliki kelas.</p></div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Iuran Kelas
        </h1>
        <p className="text-muted-foreground mt-1">{data.kelas?.nama}</p>
      </div>

      {data.iuran?.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada iuran yang ditagihkan.</CardContent></Card>
      ) : (
        data.iuran?.map((iuran: any) => {
          const myPayment = iuran.pembayaran?.find((p: any) => p.siswaId === data.siswaId)
          const sudahLunas = myPayment?.status === "LUNAS"
          const lewatTenggat = iuran.tenggat && new Date(iuran.tenggat) < new Date()

          return (
            <Card key={iuran.id} className={sudahLunas ? "border-emerald-300 dark:border-emerald-700" : lewatTenggat ? "border-red-300 dark:border-red-700" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {iuran.nama}
                      {sudahLunas && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Rp {iuran.nominal.toLocaleString("id-ID")}
                    </p>
                  </div>
                  {sudahLunas ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Lunas</Badge>
                  ) : (
                    <Badge variant="secondary" className={lewatTenggat ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : ""}>
                      {lewatTenggat ? "Lewat" : "Belum Bayar"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {iuran.deskripsi && <p className="text-xs text-muted-foreground mb-3">{iuran.deskripsi}</p>}
                {iuran.tenggat && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Tenggat: {new Date(iuran.tenggat).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
                {!sudahLunas && (
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => handleBayar(iuran.id)} disabled={payingId === iuran.id}>
                    {payingId === iuran.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Bayar Sekarang
                  </Button>
                )}
                {myPayment?.dibayarPada && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                    Dibayar {new Date(myPayment.dibayarPada).toLocaleDateString("id-ID")}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Total iuran: <span className="font-semibold">Rp {data.iuran?.reduce((sum: number, i: any) => sum + i.nominal, 0).toLocaleString("id-ID") || 0}</span> |
            Lunas: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{data.iuran?.filter((i: any) => i.pembayaran?.some((p: any) => p.siswaId === data.siswaId && p.status === "LUNAS")).length || 0}</span> /
            {data.iuran?.length || 0} item
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
