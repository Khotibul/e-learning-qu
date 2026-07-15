import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { CalendarClock, Clock, Users, BookOpen } from "lucide-react"

export default async function JadwalUjianPage() {
  const ujians = await prisma.ujian.findMany({
    where: { deletedAt: null },
    include: {
      mataPelajaran: true,
      kelas: true,
      guru: { select: { nama: true } },
    },
    orderBy: { tanggal: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jadwal Ujian</h1>
          <p className="text-muted-foreground">Kelola jadwal pelaksanaan ujian</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Ujian</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ujians.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktif</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ujians.filter(u => u.status === "AKTIF").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Selesai</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ujians.filter(u => u.status === "SELESAI").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Users className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ujians.filter(u => u.status === "DRAFT").length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">No</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Nama Ujian</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Mapel</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Kelas</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Durasi</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {ujians.map((u, i) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4">{i + 1}</td>
                    <td className="p-4 font-medium">{u.nama}</td>
                    <td className="p-4">{u.mataPelajaran.nama}</td>
                    <td className="p-4">{u.kelas.nama}</td>
                    <td className="p-4">{formatDate(u.tanggal)}</td>
                    <td className="p-4">{u.durasi} menit</td>
                    <td className="p-4">
                      <Badge variant={
                        u.status === "AKTIF" ? "success" :
                        u.status === "SELESAI" ? "secondary" : "warning"
                      }>
                        {u.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {ujians.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Belum ada jadwal ujian
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
