import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, BookOpen } from "lucide-react"
import { runRecommenderAgent } from "@/lib/agents/recommender"

export default async function RekomendasiAI() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const siswa = await prisma.siswa.findUnique({ where: { userId: session.user.id } })
  if (!siswa) return null

  let hasil = null
  try {
    hasil = await runRecommenderAgent(siswa.id)
  } catch (e) {
    console.error("Rekomendasi gagal:", e)
  }

  const rekomendasi = hasil?.rekomendasi ?? []
  if (rekomendasi.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Rekomendasi untukmu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rekomendasi.map((r: any, i: number) => (
          <div key={i} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{r.judul}</p>
                <p className="text-xs text-muted-foreground">{r.mapel}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{r.skor}%</Badge>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Direkomendasikan oleh Recommender Agent berdasarkan riwayat nilai & materi yang diakses.
        </p>
      </CardContent>
    </Card>
  )
}