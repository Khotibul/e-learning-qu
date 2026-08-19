"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Download, Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getSiswaMateris, trackOpenMateri } from "../actions"

interface MateriItem {
  id: string
  judul: string
  deskripsi: string | null
  fileUrl: string
  fileType: string | null
  fileSize: number | null
  createdAt: string
  mataPelajaran: { id: string; nama: string }
  guru: { nama: string }
}

interface GroupedMateri {
  mapel: { id: string; nama: string }
  items: MateriItem[]
}

function getFileIcon(fileType: string | null) {
  const type = fileType?.toLowerCase() || ""
  if (["pdf"].includes(type)) return "📄"
  if (["doc", "docx"].includes(type)) return "📝"
  if (["xls", "xlsx", "csv"].includes(type)) return "📊"
  if (["ppt", "pptx"].includes(type)) return "📑"
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(type)) return "🖼️"
  if (["mp4", "avi", "mov", "mkv"].includes(type)) return "🎥"
  return "📁"
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SiswaMateriPage() {
  const [groups, setGroups] = useState<GroupedMateri[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    getSiswaMateris()
      .then((data) => setGroups(data as unknown as GroupedMateri[]))
      .catch(() => toast.error("Gagal memuat materi"))
      .finally(() => setLoading(false))
  }, [])

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.judul.toLowerCase().includes(search.toLowerCase()) ||
          (i.deskripsi || "").toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.items.length > 0)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-4 sm:p-6"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Materi Pembelajaran
        </h1>
        <p className="text-muted-foreground mt-1">Akses materi pembelajaran dari guru Anda</p>
      </div>

      {groups.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari materi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              {search ? "Materi tidak ditemukan" : "Belum ada materi"}
            </p>
            <p className="text-muted-foreground mt-1">
              {search ? "Coba gunakan kata kunci lain" : "Belum ada materi yang diupload untuk kelas Anda"}
            </p>
          </CardContent>
        </Card>
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.mapel.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {group.mapel.nama}
                <Badge variant="outline" className="text-xs">{group.items.length} materi</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-xl shrink-0 mt-0.5">{getFileIcon(item.fileType)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{item.judul}</p>
                      {item.deskripsi && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.deskripsi}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-[10px]">{item.fileType?.toUpperCase() || "FILE"}</Badge>
                        {item.fileSize && <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>}
                        <span className="text-[10px] text-muted-foreground">oleh {item.guru.nama}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
                    <a href={item.fileUrl} download target="_blank" onClick={() => trackOpenMateri(item.id).catch(() => {})}>
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </motion.div>
  )
}
