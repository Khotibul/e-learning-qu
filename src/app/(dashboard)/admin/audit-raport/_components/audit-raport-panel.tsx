"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HasilAudit, JenisTemuan } from "@/lib/audit-raport"
import { jalankanAuditRaport } from "../actions"

const WARNA_JENIS: Record<JenisTemuan, string> = {
  SELISIH: "text-destructive",
  PREDIKAT: "text-destructive",
  HILANG: "text-destructive",
  TANPA_SUMBER: "text-destructive",
  RATA: "text-destructive",
  PERINGKAT: "text-destructive",
  BUKAN_ANGGOTA: "text-destructive",
  TANPA_RAPORT: "text-amber-600 dark:text-amber-400",
  UJIAN: "text-destructive",
}

function waktu(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function AuditRaportPanel({ awal }: { awal: HasilAudit }) {
  const [hasil, setHasil] = useState<HasilAudit>(awal)
  const [galat, setGalat] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)

  async function jalankan() {
    setMemuat(true)
    setGalat(null)
    try {
      setHasil(await jalankanAuditRaport())
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Audit gagal dijalankan")
    } finally {
      setMemuat(false)
    }
  }

  const stat = hasil.statistik

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        (
          <>
            {hasil.totalMasalah === 0 ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Semua nilai raport sesuai
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {hasil.totalMasalah} ketidaksesuaian
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Dijalankan {waktu(hasil.dijalankanPada)} • {hasil.durasiMs} ms
            </span>
          </>
        )
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void jalankan()} disabled={memuat}>
          {memuat ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          {memuat ? "Menjalankan…" : "Jalankan Ulang"}
        </Button>
      </div>

      {galat && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">{galat}</CardContent>
        </Card>
      )}

      {stat && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Selisih nilai", nilai: stat.selisihNilai },
              { label: "Baris hilang", nilai: stat.barisHilang },
              { label: "Baris tanpa sumber", nilai: stat.barisTanpaSumber },
              { label: "Predikat salah", nilai: stat.salahPredikat },
              { label: "Rata-rata salah", nilai: stat.salahRata },
              { label: "Peringkat salah", nilai: stat.peringkatSalah },
              { label: "Raport bukan anggota", nilai: stat.raportBukanAnggota },
              { label: "Siswa tanpa raport", nilai: stat.siswaTanpaRaport },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={item.nilai > 0 ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>
                    {item.nilai}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Data sumber</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {hasil.dataSumber.kelas} kelas • {hasil.dataSumber.semester} semester • {hasil.dataSumber.raport} raport (
              {hasil.dataSumber.barisRaport} baris) • {hasil.dataSumber.nilai} nilai • {hasil.dataSumber.komponen}{" "}
              komponen • {hasil.dataSumber.nilaiKomponenTerisi}/{hasil.dataSumber.nilaiKomponen} nilai komponen terisi
              {stat.nilaiUjianRusak > 0 && ` • ${stat.nilaiUjianRusak} nilai ujian dengan mapel tidak cocok`}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per kelas &amp; semester</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semester</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-right">Siswa</TableHead>
                      <TableHead className="text-right">Mapel</TableHead>
                      <TableHead className="text-right">Sel raport</TableHead>
                      <TableHead className="text-right">Terisi</TableHead>
                      <TableHead className="text-right">Kosong</TableHead>
                      <TableHead className="text-right">Masalah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hasil.perKelas.map((b) => (
                      <TableRow key={`${b.semesterId}-${b.kelasId}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {b.semester}
                          {b.semesterAktif && <span className="ml-1 text-xs text-muted-foreground">(aktif)</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{b.kelas}</TableCell>
                        <TableCell className="text-right text-sm">{b.siswa}</TableCell>
                        <TableCell className="text-right text-sm">{b.mapel}</TableCell>
                        <TableCell className="text-right text-sm">{b.barisRaport}</TableCell>
                        <TableCell className="text-right text-sm">{b.nilaiTerisi}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{b.nilaiKosong}</TableCell>
                        <TableCell className="text-right text-sm">
                          {b.masalah > 0 ? (
                            <Badge variant="destructive">{b.masalah}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600">
                              0
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {hasil.temuan.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detail ketidaksesuaian ({hasil.temuan.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="max-h-96 space-y-1 overflow-y-auto pr-2 font-mono text-xs">
                  {hasil.temuan.map((t, i) => (
                    <li key={i} className={WARNA_JENIS[t.jenis]}>
                      {t.pesan}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
