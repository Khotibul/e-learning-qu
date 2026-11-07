import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CalendarDays, LogIn, LogOut, ScanFace, UserCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ambilRekapWajah, prasetRekapWajah, rentangRekapWajah } from "@/lib/rekap-wajah"

export const metadata: Metadata = {
  title: "Rekap Absensi Wajah | Admin",
}

type Props = {
  searchParams: Promise<{ dari?: string; sampai?: string }>
}

function persen(bagian: number, total: number): string {
  if (total <= 0) return "0%"
  return `${Math.round((bagian / total) * 100)}%`
}

export default async function RekapWajahPage({ searchParams }: Props) {
  const sp = await searchParams
  const rentang = rentangRekapWajah(sp.dari, sp.sampai)
  const rekap = await ambilRekapWajah(rentang)

  const { hariIni, tujuhHari, awalBulan } = prasetRekapWajah()
  const aktif = (dari: string, sampai: string) => rentang.dari === dari && rentang.sampai === sampai

  const total = rekap.perKelas.reduce(
    (acc, k) => ({
      siswa: acc.siswa + k.siswa,
      terdaftar: acc.terdaftar + k.terdaftarWajah,
      masuk: acc.masuk + k.masukWajah,
      pulang: acc.pulang + k.pulangWajah,
      unik: acc.unik + k.siswaAbsenWajah,
    }),
    { siswa: 0, terdaftar: 0, masuk: 0, pulang: 0, unik: 0 }
  )

  const kartu = [
    { label: "Absen masuk via wajah", nilai: rekap.ringkasan.masukWajah, ikon: LogIn, warna: "text-emerald-600" },
    { label: "Absen pulang via wajah", nilai: rekap.ringkasan.pulangWajah, ikon: LogOut, warna: "text-sky-600" },
    {
      label: "Siswa absen via wajah",
      nilai: `${rekap.ringkasan.siswaAbsenWajah} / ${rekap.ringkasan.siswaTerdaftarWajah}`,
      ikon: Users,
      warna: "text-foreground",
      ket: "unik / terdaftar",
    },
    {
      label: "Hari absensi guru via wajah",
      nilai: rekap.ringkasan.guruHariWajah,
      ikon: UserCheck,
      warna: "text-foreground",
      ket: `${rekap.ringkasan.guruTerdaftarWajah} guru terdaftar wajah`,
    },
  ]

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ScanFace className="h-5 w-5 text-primary" /> Rekap Absensi Wajah
          </h1>
          <p className="text-sm text-muted-foreground">
            Kehadiran yang diverifikasi lewat wajah, dirangkum per kelas dan per guru.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/wajah">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium">
              <span className="mb-1 block text-muted-foreground">Dari tanggal</span>
              <input
                type="date"
                name="dari"
                defaultValue={rentang.dari}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium">
              <span className="mb-1 block text-muted-foreground">Sampai tanggal</span>
              <input
                type="date"
                name="sampai"
                defaultValue={rentang.sampai}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <Button type="submit" size="sm">
              <CalendarDays className="mr-1.5 h-4 w-4" /> Terapkan
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant={aktif(hariIni, hariIni) ? "default" : "outline"}>
              <Link href={`/admin/wajah/rekap?dari=${hariIni}&sampai=${hariIni}`}>Hari ini</Link>
            </Button>
            <Button asChild size="sm" variant={aktif(tujuhHari, hariIni) ? "default" : "outline"}>
              <Link href={`/admin/wajah/rekap?dari=${tujuhHari}&sampai=${hariIni}`}>7 hari</Link>
            </Button>
            <Button asChild size="sm" variant={aktif(awalBulan, hariIni) ? "default" : "outline"}>
              <Link href={`/admin/wajah/rekap?dari=${awalBulan}&sampai=${hariIni}`}>Bulan ini</Link>
            </Button>
          </div>
          <p className="ml-auto text-xs text-muted-foreground">
            Periode {rentang.dari} s.d. {rentang.sampai} ({rentang.hari} hari)
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kartu.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <k.ikon className="h-3.5 w-3.5" /> {k.label}
              </p>
              <p className={`text-xl font-bold ${k.warna}`}>{k.nilai}</p>
              {k.ket ? <p className="text-[11px] text-muted-foreground">{k.ket}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Rekap per Kelas
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-right">Siswa</TableHead>
                <TableHead className="text-right">Profil wajah</TableHead>
                <TableHead className="text-right">Masuk via wajah</TableHead>
                <TableHead className="text-right">Pulang via wajah</TableHead>
                <TableHead className="text-right">Siswa absen via wajah</TableHead>
                <TableHead className="text-right">Kehadiran wajah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rekap.perKelas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Belum ada data kelas
                  </TableCell>
                </TableRow>
              ) : (
                rekap.perKelas.map((k) => (
                  <TableRow key={k.kelasId ?? "tanpa-kelas"}>
                    <TableCell className="font-medium">{k.kelas}</TableCell>
                    <TableCell className="text-right">{k.siswa}</TableCell>
                    <TableCell className="text-right">
                      {k.terdaftarWajah} <span className="text-xs text-muted-foreground">({persen(k.terdaftarWajah, k.siswa)})</span>
                    </TableCell>
                    <TableCell className="text-right">{k.masukWajah}</TableCell>
                    <TableCell className="text-right">{k.pulangWajah}</TableCell>
                    <TableCell className="text-right">{k.siswaAbsenWajah}</TableCell>
                    <TableCell className="text-right">{persen(k.siswaAbsenWajah, k.terdaftarWajah)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rekap.perKelas.length > 0 ? (
              <tfoot>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{total.siswa}</TableCell>
                  <TableCell className="text-right">
                    {total.terdaftar} <span className="text-xs font-normal text-muted-foreground">({persen(total.terdaftar, total.siswa)})</span>
                  </TableCell>
                  <TableCell className="text-right">{total.masuk}</TableCell>
                  <TableCell className="text-right">{total.pulang}</TableCell>
                  <TableCell className="text-right">{total.unik}</TableCell>
                  <TableCell className="text-right">{persen(total.unik, total.terdaftar)}</TableCell>
                </TableRow>
              </tfoot>
            ) : null}
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4" /> Rekap per Guru
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guru</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Profil wajah</TableHead>
                <TableHead className="text-right">Hari absen via wajah</TableHead>
                <TableHead>Terakhir absen wajah</TableHead>
                <TableHead>Jam masuk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rekap.perGuru.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Belum ada data guru
                  </TableCell>
                </TableRow>
              ) : (
                rekap.perGuru.map((g) => (
                  <TableRow key={g.guruId}>
                    <TableCell className="font-medium">{g.nama}</TableCell>
                    <TableCell className="text-xs">{g.nip ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={g.terdaftarWajah ? "default" : "outline"}>
                        {g.terdaftarWajah ? "Terdaftar" : "Belum"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{g.hariWajah}</TableCell>
                    <TableCell className="text-xs">{g.terakhir ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{g.jamMasukTerakhir ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Hanya absensi dengan bukti wajah yang dihitung. Data absensi manual/fingerprint tidak masuk rekap ini.
      </p>
    </div>
  )
}
