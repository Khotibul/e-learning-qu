"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, ClipboardList } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getJadwalPiketSiswa } from "../actions"

const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export default function JadwalPiketPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJadwalPiketSiswa().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-muted-foreground">Anda belum memiliki kelas.</p></div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Jadwal Piket
        </h1>
        <p className="text-muted-foreground mt-1">{data.kelas?.nama}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Jadwal Piket Kelas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium w-28">Hari</th>
                <th className="text-left p-3 font-medium">Siswa yang Bertugas</th>
              </tr>
            </thead>
            <tbody>
              {data.jadwalPiket?.length === 0 ? (
                <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Belum ada jadwal piket</td></tr>
              ) : (
                hariList.map((hari) => {
                  const items = data.jadwalPiket?.filter((p: any) => p.hari === hari) || []
                  return items.length > 0 ? items.map((p: any, i: number) => (
                    <tr key={p.id} className={i === 0 ? "border-t" : "border-t-0"}>
                      {i === 0 && (
                        <td className="p-3 font-medium align-top" rowSpan={items.length}>
                          {hari}
                        </td>
                      )}
                      <td className="p-3">{p.siswa.nama}</td>
                    </tr>
                  )) : null
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
