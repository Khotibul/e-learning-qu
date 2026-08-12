"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Database, RefreshCw, Trash2, FileText, Sparkles } from "lucide-react"
import { getAIKnowledgeBase, indexMateri, deleteMateriIndex } from "../ai/actions"

export default function AIKnowledgePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [indexing, setIndexing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchData = async () => {
    setLoading(true)
    try {
      setData(await getAIKnowledgeBase())
    } catch {
      toast.error("Gagal memuat knowledge base")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const onIndex = async (id: string) => {
    setIndexing(id)
    try {
      const r = await indexMateri(id)
      toast.success(`Berhasil diindeks: ${r.jumlahChunk} chunk (mode ${r.modeEmbed})`)
      fetchData()
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengindeks")
    } finally {
      setIndexing(null)
    }
  }

  const onDelete = async (id: string) => {
    setDeleting(id)
    try {
      await deleteMateriIndex(id)
      toast.success("Indeks dihapus")
      fetchData()
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus indeks")
    } finally {
      setDeleting(null)
    }
  }

  const filtered = (data?.materis || []).filter((m: any) =>
    m.judul.toLowerCase().includes(search.toLowerCase()) ||
    (m.mataPelajaran?.nama || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> AI Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-1">
          Kelola indeks materi untuk sistem RAG pada AI Tutor siswa
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/40"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold">{data?.materis?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Materi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5 text-green-700 dark:bg-green-900/40"><Database className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold">{data?.materis?.filter((m: any) => m._count.chunks > 0).length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Materi Terindeks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-900/40"><Sparkles className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold">{data?.chunks ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                Total Chunk &middot; {data?.geminiEnabled ? "Semantic (Gemini)" : "Keyword (tanpa API key)"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Daftar Materi</CardTitle>
            <Input
              placeholder="Cari materi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada materi.</p>
          )}
          {filtered.map((m: any) => {
            const indexed = m._count.chunks > 0
            return (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.judul}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{m.mataPelajaran?.nama}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {(m.konten?.length || m.deskripsi?.length || 0) > 0 ? `${(m.konten?.length || m.deskripsi?.length || 0)} karakter teks` : "Tidak ada teks"}
                    </span>
                    {indexed ? (
                      <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {m._count.chunks} chunk
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Belum diindeks</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={indexed ? "outline" : "default"}
                    onClick={() => onIndex(m.id)}
                    disabled={indexing === m.id || deleting === m.id}
                  >
                    {indexing === m.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    {indexed ? "Reindeks" : "Indeks"}
                  </Button>
                  {indexed && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(m.id)} disabled={deleting === m.id}>
                      {deleting === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}