"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, Users, ShieldCheck, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStrukturKelas } from "../actions"

const jabatanLabels: Record<string, string> = {
  KETUA: "Ketua Kelas",
  WAKIL: "Wakil Ketua",
  BENDAHARA: "Bendahara",
  SEKRETARIS: "Sekretaris",
}
const jabatanColors: Record<string, string> = {
  KETUA: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  WAKIL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
  BENDAHARA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  SEKRETARIS: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
}

export default function StrukturKelasPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStrukturKelas().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!data) return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-muted-foreground">Anda belum memiliki kelas.</p></div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Struktur Kelas
        </h1>
        <p className="text-muted-foreground mt-1">
          {data.kelas?.nama} — Wali Kelas: <span className="font-medium">{data.kelas?.guru?.nama || "-"}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["KETUA", "WAKIL", "SEKRETARIS", "BENDAHARA"].map((pos) => {
          const siswa = data.siswas?.find((s: any) => s.jabatan === pos)
          return (
            <Card key={pos} className={`border-primary/20 ${jabatanColors[pos]} bg-opacity-5`}>
              <CardContent className="p-6 text-center">
                <User className="h-8 w-8 mx-auto mb-3 opacity-60" />
                <Badge className="mb-2">{jabatanLabels[pos]}</Badge>
                <p className="font-semibold text-base">
                  {siswa?.nama || <span className="text-muted-foreground italic text-sm">Belum diisi</span>}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Semua Siswa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.siswas?.filter((s: any) => !s.deletedAt).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-4">Belum ada siswa</p>
            )}
            {data.siswas?.filter((s: any) => !s.deletedAt).map((siswa: any) => (
              <div key={siswa.id} className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">{siswa.nama}</span>
                {siswa.jabatan ? (
                  <Badge className={jabatanColors[siswa.jabatan]}>{jabatanLabels[siswa.jabatan]}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Anggota</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
