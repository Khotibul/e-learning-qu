"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Save, Globe, Image, Plus, Trash2, GripVertical, Loader2,
  LayoutDashboard, BookOpen, BarChart3, Users, Target, GraduationCap, Sparkles,
} from "lucide-react"

const iconOptions = [
  { value: "FileText", label: "File" },
  { value: "GraduationCap", label: "Graduation" },
  { value: "BarChart3", label: "Chart" },
  { value: "Users", label: "Users" },
  { value: "Target", label: "Target" },
  { value: "BookOpen", label: "Book" },
  { value: "Sparkles", label: "Sparkles" },
  { value: "Globe", label: "Globe" },
  { value: "Shield", label: "Shield" },
  { value: "Zap", label: "Zap" },
  { value: "Heart", label: "Heart" },
  { value: "Star", label: "Star" },
  { value: "Award", label: "Award" },
  { value: "TrendingUp", label: "Trending" },
]

interface Feature {
  id?: string
  icon: string
  title: string
  description: string
  order: number
  isActive: boolean
}

export default function PengaturanPage() {
  const [siteName, setSiteName] = useState("")
  const [tagline, setTagline] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [aboutTitle, setAboutTitle] = useState("")
  const [aboutText, setAboutText] = useState("")
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/site-config").then((r) => r.json()),
      fetch("/api/features").then((r) => r.json()),
    ])
      .then(([config, feats]) => {
        setSiteName(config.siteName || "")
        setTagline(config.tagline || "")
        setDescription(config.description || "")
        setLogoUrl(config.logoUrl || "")
        setAboutTitle(config.aboutTitle || "")
        setAboutText(config.aboutText || "")
        if (Array.isArray(feats)) setFeatures(feats)
      })
      .catch(() => toast.error("Gagal memuat data"))
      .finally(() => setLoading(false))
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogoUrl(data.url)
      toast.success("Logo berhasil diupload")
    } catch {
      toast.error("Gagal upload logo")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveInfo = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName, tagline, description, logoUrl, aboutTitle, aboutText }),
      })
      if (!res.ok) throw new Error()
      toast.success("Informasi berhasil disimpan")
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const addFeature = () => {
    setFeatures([...features, { icon: "FileText", title: "", description: "", order: features.length + 1, isActive: true }])
  }

  const updateFeature = (idx: number, field: string, value: any) => {
    const updated = [...features]
    updated[idx] = { ...updated[idx], [field]: value }
    setFeatures(updated)
  }

  const removeFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx))
  }

  const moveFeature = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= features.length) return
    const updated = [...features]
    const temp = updated[idx]
    updated[idx] = { ...updated[newIdx], order: updated[idx].order }
    updated[newIdx] = { ...temp, order: updated[newIdx].order }
    setFeatures(updated)
  }

  const saveFeatures = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < features.length; i++) {
        const f = features[i]
        await fetch("/api/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...f, order: i + 1, id: f.id || undefined }),
        })
      }
      toast.success("Fitur berhasil disimpan")
    } catch {
      toast.error("Gagal menyimpan fitur")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Landing Page</h1>
        <p className="text-muted-foreground mt-1">Atur tampilan halaman utama website</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Informasi Website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-xl border flex items-center justify-center bg-muted">
                  <Image className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")} className="ml-2 text-destructive">
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">Nama Website</Label>
              <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi Hero</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>
          <Button onClick={handleSaveInfo} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Informasi"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Tentang Kami
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aboutTitle">Judul Section</Label>
            <Input id="aboutTitle" value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} placeholder="Tentang Kami" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aboutText">Teks Tentang</Label>
            <Textarea id="aboutText" value={aboutText} onChange={(e) => setAboutText(e.target.value)} className="min-h-[120px]" placeholder="Deskripsi tentang platform..." />
          </div>
          <Button onClick={handleSaveInfo} disabled={saving} variant="outline">
            <Save className="h-4 w-4 mr-2" /> Simpan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Keunggulan / Fitur
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addFeature}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {features.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Belum ada fitur</p>
          ) : (
            features.map((f, idx) => (
              <div key={idx} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-grab" onClick={() => moveFeature(idx, -1)} disabled={idx === 0}>
                      <GripVertical className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFeature(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Icon</Label>
                    <select
                      value={f.icon}
                      onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Judul</Label>
                    <Input value={f.title} onChange={(e) => updateFeature(idx, "title", e.target.value)} placeholder="Nama fitur" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Aktif</Label>
                    <select
                      value={f.isActive ? "true" : "false"}
                      onChange={(e) => updateFeature(idx, "isActive", e.target.value === "true")}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deskripsi</Label>
                  <Textarea value={f.description} onChange={(e) => updateFeature(idx, "description", e.target.value)} placeholder="Deskripsi fitur..." className="min-h-[60px]" />
                </div>
              </div>
            ))
          )}
          {features.length > 0 && (
            <Button onClick={saveFeatures} disabled={saving} className="mt-2">
              <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Semua Fitur"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
