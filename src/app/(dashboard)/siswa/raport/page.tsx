import Link from "next/link"
import { redirect } from "next/navigation"
import { Award, FileText, Info } from "lucide-react"
import { auth } from "@/lib/auth"
import { getRaportSiswaSendiri } from "@/app/(dashboard)/raport/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Raport Saya" }
export const dynamic = "force-dynamic"

function tanggal(value: Date | string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default async function RaportSiswaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const data = await getRaportSiswaSendiri().catch(() => ({ siswa: null, raports: [] }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Raport Saya
        </h1>
        <p className="text-muted-foreground mt-1">
          Raport yang sudah diterbitkan wali kelas. Raport berstatus draft belum dapat diakses.
        </p>
      </div>

      {!data.siswa ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Akun ini tidak terhubung dengan data siswa. Hubungi admin sekolah.
        </CardContent></Card>
      ) : data.raports.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Info className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada raport terbit</p>
          <p className="text-sm text-muted-foreground mt-1">
            Wali kelas belum menerbitkan raport untuk {data.siswa.nama}. Silakan cek kembali nanti.
          </p>
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {data.siswa.nama} — {data.siswa.kelas?.nama ?? "-"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semester</TableHead>
                    <TableHead>Tahun ajaran</TableHead>
                    <TableHead className="text-center">Rata-rata</TableHead>
                    <TableHead className="text-center">Peringkat</TableHead>
                    <TableHead>Diterbitkan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.raports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.semester.nama}</TableCell>
                      <TableCell>{r.semester.tahunAjaran.nama}</TableCell>
                      <TableCell className="text-center font-semibold">{r.rataRata ?? "-"}</TableCell>
                      <TableCell className="text-center">{r.peringkat ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tanggal(r.terbitAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/raport/cetak/${r.id}`} target="_blank">
                            <FileText className="h-3.5 w-3.5 mr-1.5" /> Lihat / Cetak
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.raports[0].nilais.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nilai semester terakhir</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {data.raports[0].nilais.map((n, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{n.mapel.nama}</span>
                    <span className="flex items-center gap-2">
                      <strong>{n.nilaiAkhir}</strong>
                      <Badge variant="secondary" className="text-[10px]">{n.predikat}</Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
