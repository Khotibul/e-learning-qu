"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Loader2, Wallet, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { getIuranSiswa, bayarIuran } from "../actions"

export default function IuranPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedIuran, setSelectedIuran] = useState<any>(null)
  const [nominal, setNominal] = useState("")
  const [keterangan, setKeterangan] = useState("")

  const fetchData = async () => {
    try {
      const d = await getIuranSiswa()
      setData(d as any)
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const openDialog = (iuran: any) => {
    setSelectedIuran(iuran)
    setNominal(iuran.nominal.toString())
    setKeterangan("")
    setDialogOpen(true)
  }

  const handleBayar = async () => {
    if (!selectedIuran) return
    const nominalNum = Number(nominal)
    if (isNaN(nominalNum) || nominalNum <= 0) { toast.error("Nominal tidak valid"); return }
    setSubmitting(true)
    try {
      await bayarIuran(selectedIuran.id, { nominal: nominalNum, keterangan: keterangan || undefined })
      toast.success("Pengajuan pembayaran dikirim, menunggu konfirmasi bendahara")
      setDialogOpen(false)
      fetchData()
    } catch { toast.error("Gagal mengirim pengajuan") }
    finally { setSubmitting(false) }
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
          const status = myPayment?.status
          const sudahLunas = status === "LUNAS"
          const menunggu = status === "MENUNGGU"
          const lewatTenggat = iuran.tenggat && new Date(iuran.tenggat) < new Date()

          return (
            <Card key={iuran.id} className={sudahLunas ? "border-emerald-300 dark:border-emerald-700" : menunggu ? "border-amber-300 dark:border-amber-700" : lewatTenggat ? "border-red-300 dark:border-red-700" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {iuran.nama}
                      {sudahLunas && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {menunggu && <Clock className="h-4 w-4 text-amber-500" />}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Rp {iuran.nominal.toLocaleString("id-ID")}
                    </p>
                  </div>
                  {sudahLunas ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Lunas</Badge>
                  ) : menunggu ? (
                    <Badge variant="warning">Menunggu Konfirmasi</Badge>
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
                {sudahLunas ? (
                  myPayment?.dibayarPada && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Dibayar {new Date(myPayment.dibayarPada).toLocaleDateString("id-ID")}
                      {myPayment.jumlah ? ` · Rp ${myPayment.jumlah.toLocaleString("id-ID")}` : ""}
                    </p>
                  )
                ) : menunggu ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Pengajuan pembayaran Anda sedang menunggu konfirmasi bendahara
                      {myPayment?.keterangan ? ` (${myPayment.keterangan})` : ""}.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDialog(iuran)} disabled={submitting}>
                        Perbarui Pengajuan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => openDialog(iuran)} disabled={submitting}>
                    Bayar Sekarang
                  </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bayar {selectedIuran?.nama ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="number"
                min={1}
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                placeholder="Masukkan nominal pembayaran"
              />
              <p className="text-xs text-muted-foreground">
                Tagihan: Rp {selectedIuran?.nominal?.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Keterangan (opsional)</Label>
              <Textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: sudah transfer ke bendahara"
                rows={2}
              />
            </div>
            <Button onClick={handleBayar} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kirim Pengajuan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
