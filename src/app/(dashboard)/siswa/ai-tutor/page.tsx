"use client"

import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, Sparkles, GraduationCap, Send, Loader2, Plus, Target } from "lucide-react"
import { aiIndexData, aiChat, aiJawabLatihan } from "../ai/actions"
import { cn } from "@/lib/utils"

const agentMeta: Record<string, { label: string; cls: string }> = {
  tutor: { label: "Tutor Agent (RAG)", cls: "bg-blue-100 text-blue-700" },
  assessor: { label: "Assessor Agent", cls: "bg-amber-100 text-amber-700" },
  recommender: { label: "Recommender Agent", cls: "bg-purple-100 text-purple-700" },
  orchestrator: { label: "Orchestrator", cls: "bg-slate-100 text-slate-700" },
}

function renderMarkdownLite(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={i} className="flex gap-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{renderBold(line.replace(/^[-•]\s*/, ""))}</span>
        </div>
      )
    }
    if (line.trim() === "") return <div key={i} className="h-2" />
    return <p key={i}>{renderBold(line)}</p>
  })
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))
}

interface Msg {
  id: string
  role: string
  agent?: string | null
  konten: string
  sumber?: any
  createdAt: string
}

interface LatihanAktif {
  id: string
  materiJudul: string
  soal: { tanya: string; jawaban: string; kunci: string }[]
}

export default function AITutorPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [mapels, setMapels] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [mapelId, setMapelId] = useState("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [latihan, setLatihan] = useState<LatihanAktif | null>(null)
  const [jawaban, setJawaban] = useState<Record<number, string>>({})
  const [menilai, setMenilai] = useState(false)
  const [hasilLatihan, setHasilLatihan] = useState<any>(null)
  const [init, setInit] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    aiIndexData()
      .then((d) => {
        setSessions(d.sessions)
        setMapels(d.mapels)
        if (d.sessions.length > 0) {
          setActiveId(d.sessions[0].id)
          setMessages((d.sessions[0].messages || []).map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt).toISOString(),
          })) as Msg[])
          if (d.sessions[0].mapelId) setMapelId(d.sessions[0].mapelId)
        }
      })
      .catch(() => toast.error("Gagal memuat riwayat AI"))
      .finally(() => setInit(true))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, latihan, hasilLatihan, loading])

  const newSession = () => {
    setActiveId(null)
    setMessages([])
    setLatihan(null)
    setHasilLatihan(null)
    setJawaban({})
    setInput("")
  }

  const openSession = (s: any) => {
    setActiveId(s.id)
    setMessages((s.messages || []).map((m: any) => ({
      ...m,
      createdAt: new Date(m.createdAt).toISOString(),
    })) as Msg[])
    setLatihan(null)
    setHasilLatihan(null)
    setJawaban({})
    if (s.mapelId) setMapelId(s.mapelId)
  }

  const send = async () => {
    const pesan = input.trim()
    if (!pesan || loading) return
    setInput("")
    setHasilLatihan(null)
    setLatihan(null)
    setJawaban({})
    setMessages((m) => [...m, { id: `temp-${Date.now()}`, role: "siswa", konten: pesan, createdAt: new Date().toISOString() }])
    setLoading(true)
    try {
      const res = await aiChat({ sessionId: activeId, mapelId: mapelId || null, pesan })
      setActiveId(res.sessionId)
      setMessages((m) => [...m, { ...res.message, createdAt: new Date().toISOString() }])
      if (res.latihan) {
        setLatihan({ id: res.latihan.id, materiJudul: res.latihan.materi.judul, soal: res.latihan.soal })
      }
      aiIndexData().then((d) => setSessions(d.sessions)).catch(() => {})
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengirim pesan")
    } finally {
      setLoading(false)
    }
  }

  const submitLatihan = async () => {
    if (!latihan) return
    const kosong = latihan.soal.some((_, i) => !jawaban[i]?.trim())
    if (kosong) { toast.error("Semua soal harus dijawab"); return }
    setMenilai(true)
    try {
      const hasil = await aiJawabLatihan(latihan.id, jawaban)
      setHasilLatihan(hasil)
    } catch (e: any) {
      toast.error(e?.message || "Gagal menilai")
    } finally {
      setMenilai(false)
    }
  }

  const agentIcon = (agent: string | null | undefined) => {
    const meta = agentMeta[agent || "tutor"]
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", meta?.cls)}>
        {meta?.label || agent}
      </span>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> AI Tutor
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-Agent Learning System &middot; Retrieval-Augmented Generation untuk personalisasi belajar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select value={mapelId} onValueChange={setMapelId}>
              <SelectTrigger><SelectValue placeholder="Semua mapel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua mapel</SelectItem>
                {mapels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={newSession}>
            <Plus className="h-4 w-4 mr-1" /> Baru
          </Button>
        </div>
      </div>

      {!init ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit max-h-[70vh] overflow-y-auto p-2 space-y-1">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Riwayat Percakapan</p>
            {sessions.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada percakapan.</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  activeId === s.id ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"
                )}
              >
                <p className="truncate font-medium">{s.judul}</p>
                <p className="text-[10px] opacity-70">{new Date(s.updatedAt).toLocaleDateString("id-ID")} &middot; {s.messages.length} pesan</p>
              </button>
            ))}
          </Card>

          <Card className="flex flex-col min-h-[60vh]">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 max-h-[62vh]">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10 space-y-2">
                  <Sparkles className="h-8 w-8 mx-auto text-primary" />
                  <p>Tanyakan apa saja tentang materi belajarmu!</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {["Jelaskan materi [judul materi]", "Buatkan latihan untuk [judul materi]", "Rekomendasi materi apa untukku?"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "siswa" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm", m.role === "siswa" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {m.role === "asisten" && (
                      <div className="mb-1.5">{agentIcon(m.agent)}</div>
                    )}
                    <div className="space-y-1">{renderMarkdownLite(m.konten)}</div>
                    {m.role === "asisten" && m.agent === "tutor" && Array.isArray(m.sumber) && m.sumber.length > 0 && (
                      <details className="mt-2 rounded-lg bg-background/60 p-2 text-xs">
                        <summary className="cursor-pointer font-medium text-muted-foreground">
                          Sumber RAG ({m.sumber.length})
                        </summary>
                        <div className="mt-1 space-y-1">
                          {m.sumber.map((s: any, i: number) => (
                            <div key={i} className="flex items-start justify-between gap-2">
                              <span className="text-muted-foreground">{s.mapel} — {s.judul}</span>
                              <Badge variant="secondary" className="shrink-0 text-[10px]">{s.skor}%</Badge>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString("id-ID")}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Agent sedang berpikir...
                  </div>
                </div>
              )}

              {latihan && !hasilLatihan && (
                <Card className="border-amber-300 dark:border-amber-700">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold">Latihan: {latihan.materiJudul}</p>
                    </div>
                    {latihan.soal.map((s, i) => (
                      <div key={i} className="space-y-1.5">
                        <Label className="text-sm">{i + 1}. {s.tanya}</Label>
                        <Textarea
                          rows={2}
                          value={jawaban[i] || ""}
                          onChange={(e) => setJawaban((j) => ({ ...j, [i]: e.target.value }))}
                          placeholder="Tulis jawabanmu..."
                        />
                      </div>
                    ))}
                    <Button onClick={submitLatihan} disabled={menilai}>
                      {menilai && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Kumpulkan & Nilai
                    </Button>
                  </div>
                </Card>
              )}

              {hasilLatihan && (
                <Card className="border-green-300 dark:border-green-700">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Hasil Latihan</p>
                      <span className={cn("text-2xl font-bold", hasilLatihan.skor >= 75 ? "text-green-600" : hasilLatihan.skor >= 50 ? "text-amber-600" : "text-red-600")}>
                        {hasilLatihan.skor}/100
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{hasilLatihan.umpanBalik}</p>
                    <div className="space-y-2">
                      {hasilLatihan.perSoal?.map((p: any, i: number) => (
                        <div key={i} className="rounded-lg bg-muted/60 p-2 text-xs">
                          <p className="font-medium">{i + 1}. {p.tanya}</p>
                          <p className={cn("mt-1", p.benar ? "text-green-600" : "text-red-600")}>
                            {p.benar ? "Benar" : "Perlu dipelajari ulang"} — {p.umpan}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Tanya AI Tutor, minta latihan, atau rekomendasi..."
                  disabled={loading}
                />
                <Button onClick={send} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Agent yang menangani pesanmu ditentukan Orchestrator: Tutor (RAG), Assessor (latihan), Recommender (personalisasi).
              </p>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  )
}