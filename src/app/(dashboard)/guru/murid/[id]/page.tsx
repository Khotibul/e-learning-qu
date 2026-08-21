import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getStudentDetail } from "./actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { User, BookOpen, Brain, AlertTriangle, MessageSquare, TrendingUp, TrendingDown, Clock, Target, Activity, Shield, Lightbulb, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface PageProps {
  params: Promise<{ id: string }>
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

async function StudentDetailContent({ id }: { id: string }) {
  let data
  try {
    data = await getStudentDetail(id)
  } catch {
    notFound()
  }

  const { siswa, stats, kompetensiTerkuat, kompetensiTerlemah, nilaiList, penguasaanList, activities, warnings, agentLogs, rekomendasi, insight } = data

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/guru/murid"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 p-3">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{siswa.nama}</h1>
          <p className="text-muted-foreground">{siswa.kelas} &middot; {siswa.jurusan}</p>
          {siswa.email && <p className="text-sm text-muted-foreground">{siswa.email}</p>}
          {siswa.jabatan && <Badge variant="secondary" className="mt-1">{siswa.jabatan}</Badge>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"><Brain className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Rata-rata Nilai</p>
                <p className="text-2xl font-bold">{stats.rataNilai}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30"><Target className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Mastery Rata-rata</p>
                <p className="text-2xl font-bold">{stats.rataMastery}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30"><Clock className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats.streak} hari</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stats.openWarnings > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.openWarnings > 0 ? "text-red-600" : "text-green-600"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warning Aktif</p>
                <p className="text-2xl font-bold">{stats.openWarnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insight & Rekomendasi Tindakan (agregat agent, tanpa detail teknis) */}
      {insight && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" /> AI Insight &amp; Rekomendasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Progress Materi</p>
                <p className="text-xl font-bold">{insight.progress}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Engagement</p>
                <p className="text-xl font-bold">{insight.engagement}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Risk Level</p>
                <Badge variant={
                  insight.riskLevel === "Prioritas Intervensi" || insight.riskLevel === "Risiko Tinggi"
                    ? "destructive"
                    : insight.riskLevel === "Perlu Perhatian" ? "warning" : "success"
                }>
                  {insight.riskLevel}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div>
                <p className="text-sm font-medium mb-1.5">Kekuatan</p>
                {insight.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada kompetensi yang dikuasai baik</p>
                ) : (
                  <ul className="space-y-1">
                    {insight.strengths.map((s) => (
                      <li key={s} className="text-sm flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5">Perlu Penguatan</p>
                {insight.weaknesses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada — semua kompetensi di atas 60%</p>
                ) : (
                  <ul className="space-y-1">
                    {insight.weaknesses.map((w) => (
                      <li key={w} className="text-sm flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Separator className="mb-4" />
            <p className="text-sm font-medium mb-2">Rekomendasi Tindakan</p>
            <ol className="space-y-1.5">
              {insight.recommendations.map((r, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {r}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" /> Penguasaan Kompetensi</CardTitle>
            </CardHeader>
            <CardContent>
              {penguasaanList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data penguasaan</p>
              ) : (
                <div className="space-y-3">
                  {penguasaanList.map((p, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{p.nama} <span className="text-muted-foreground">({p.mapel})</span></span>
                        <span className="font-medium">{p.skor}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${p.skor >= 70 ? "bg-green-500" : p.skor >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${p.skor}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{p.jumlahLatihan} latihan &middot; {p.jumlahBenar} benar</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" /> Nilai Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              {nilaiList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada nilai</p>
              ) : (
                <div className="space-y-2">
                  {nilaiList.slice(0, 10).map((n) => (
                    <div key={n.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{n.ujian}</p>
                        <p className="text-xs text-muted-foreground">{n.mapel}</p>
                      </div>
                      <Badge variant={n.nilai >= 70 ? "default" : "destructive"}>{n.nilai}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> Aktivitas Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
              ) : (
                <div className="space-y-2">
                  {activities.slice(0, 15).map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{a.jenis}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Kompetensi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kompetensiTerkuat && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 text-green-500" /> Terkuat</div>
                  <p className="font-medium mt-1">{kompetensiTerkuat.nama}</p>
                  <p className="text-xs text-muted-foreground">{kompetensiTerkuat.mapel} &middot; {kompetensiTerkuat.skor}%</p>
                </div>
              )}
              {kompetensiTerlemah && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingDown className="h-4 w-4 text-red-500" /> Perlu Diperhatikan</div>
                  <p className="font-medium mt-1">{kompetensiTerlemah.nama}</p>
                  <p className="text-xs text-muted-foreground">{kompetensiTerlemah.mapel} &middot; {kompetensiTerlemah.skor}%</p>
                </div>
              )}
              {!kompetensiTerkuat && <p className="text-sm text-muted-foreground">Belum ada data</p>}
            </CardContent>
          </Card>

          {warnings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Early Warning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {warnings.map((w) => (
                  <div key={w.id} className={`rounded-lg border p-3 ${w.isResolved ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <Badge variant={w.severity === "HIGH" ? "destructive" : w.severity === "MEDIUM" ? "default" : "secondary"}>{w.severity}</Badge>
                      {w.isResolved && <Badge variant="outline">Resolved</Badge>}
                    </div>
                    <p className="text-sm mt-1">{w.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString("id-ID")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {rekomendasi.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" /> Rekomendasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rekomendasi.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{r.judul}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.alasan}</p>
                    <Badge variant={r.status === "BARU" ? "default" : "secondary"} className="mt-2 text-xs">{r.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {agentLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" /> AI Interaksi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {agentLogs.slice(0, 5).map((l, i) => (
                  <div key={i} className="rounded border p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{l.agent}</Badge>
                      <span className="text-xs text-muted-foreground">{l.durasiMs}ms</span>
                    </div>
                    <p className="text-xs mt-1 truncate">{l.query}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <StudentDetailContent id={id} />
    </Suspense>
  )
}
