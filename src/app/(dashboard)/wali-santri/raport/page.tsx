import Link from "next/link"
import { redirect } from "next/navigation"
import { Award, FileText, Info } from "lucide-react"
import { auth } from "@/lib/auth"
import { getRaportAnakWali } from "@/app/(dashboard)/raport/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Raport Anak" }
export const dynamic = "force-dynamic"

function tanggal(value: Date | string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default async function RaportAnakWaliPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const data = await getRaportAnakWali().catch(() => ({ wali: null, anak: [] }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Raport Anak
        </h1>
        <p className="text-muted-foreground mt-1">
          Hanya raport yang sudah diterbitkan sekolah yang tampil di halaman ini.
        </p>
      </div>

      {!data.wali ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Akun ini tidak terdaftar sebagai wali santri. Hubungi admin pondok untuk mengaktifkan akun wali.
        </CardContent></Card>
      ) : data.anak.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Info className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Belum ada raport terbit</p>
          <p className="text-sm text-muted-foreground mt-1">
            Raport anak Anda akan muncul di sini setelah diterbitkan wali kelas.
          </p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Raport {data.wali.nama}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama anak</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Rata-rata</TableHead>
                  <TableHead className="text-center">Peringkat</TableHead>
                  <TableHead>Diterbitkan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.anak.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.siswa.nama}</TableCell>
                    <TableCell>{r.siswa.kelas?.nama ?? "-"}</TableCell>
                    <TableCell>{r.semester.nama} — {r.semester.tahunAjaran.nama}</TableCell>
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
      )}
    </div>
  )
}
