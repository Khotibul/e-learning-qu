"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getJadwalPelajaranSiswa } from "../actions"

const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export default function JadwalPelajaranPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJadwalPelajaranSiswa().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-muted-foreground">Anda belum memiliki kelas.</p></div>

  const jadwal = data.jadwalPelajaran || []

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Jadwal Pelajaran
        </h1>
        <p className="text-muted-foreground mt-1">{data.kelas?.nama}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {hariList.map((hari) => {
          const items = jadwal.filter((j: any) => j.hari === hari)
          return (
            <Card key={hari} className={items.length === 0 ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-center">{hari}</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4">Tidak ada</p>
                ) : (
                  <div className="space-y-2">
                    {items
                      .sort((a: any, b: any) => (a.jamMulai || "").localeCompare(b.jamMulai || ""))
                      .map((j: any) => (
                        <div key={j.id} className="rounded-lg border p-2 text-center">
                          <p className="text-xs font-medium">{j.mataPelajaran?.nama || j.namaMapel}</p>
                          {j.jamMulai && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {j.jamMulai?.slice(0, 5)}{j.jamSelesai ? ` - ${j.jamSelesai?.slice(0, 5)}` : ""}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </motion.div>
  )
}
