"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, Loader2, RefreshCw, ShieldQuestion, X } from "lucide-react"
import { getPengecualianList, setPengecualianStatus } from "../actions"

const ONE = "__all__"

export function AdminPengecualian() {
  const [status, setStatus] = useState("MENUNGGU")
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPengecualianList(status === ONE ? undefined : status)
      setRows(data as any[])
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat pengecualian")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const setujuiTolak = async (id: string, newStatus: "DISETUJUI" | "DITOLAK") => {
    setBusy(id + newStatus)
    try {
      await setPengecualianStatus(id, newStatus)
      toast.success(newStatus === "DISETUJUI" ? "Pengecualian disetujui" : "Pengecualian ditolak")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Gagal memproses")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-primary" /> Pengecualian Verifikasi (Foto / Sidik Jari / GPS)
          </CardTitle>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="ml-auto h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MENUNGGU">Menunggu</SelectItem>
              <SelectItem value="DISETUJUI">Disetujui</SelectItem>
              <SelectItem value="DITOLAK">Ditolak</SelectItem>
              <SelectItem value={ONE}>Semua Status</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Tidak ada permohonan pengecualian
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Guru</th>
                  <th className="p-3">Jenis</th>
                  <th className="p-3">Alasan</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Catatan Admin</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 whitespace-nowrap">{new Date(r.tanggal).toLocaleDateString("id-ID")}</td>
                    <td className="p-3 font-medium">{r.guru?.nama}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={r.jenis === "LOKASI" ? "bg-sky-50 text-sky-700 border-sky-200" : r.jenis === "BIOMETRIK" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                        {r.jenis}
                      </Badge>
                    </td>
                    <td className="p-3 max-w-[280px] text-xs">{r.alasan}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={r.status === "DISETUJUI" ? "bg-emerald-100 text-emerald-700" : r.status === "DITOLAK" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.catatanAdmin || "-"}</td>
                    <td className="p-3 text-right">
                      {r.status === "MENUNGGU" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-700" disabled={busy === r.id + "DISETUJUI"} onClick={() => setujuiTolak(r.id, "DISETUJUI")}>
                            {busy === r.id + "DISETUJUI" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Setujui
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs text-red-600" disabled={busy === r.id + "DITOLAK"} onClick={() => setujuiTolak(r.id, "DITOLAK")}>
                            {busy === r.id + "DITOLAK" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Tolak
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Pengecualian hanya berlaku untuk tanggal &amp; guru bersangkutan, dan dicatat sebagai catatan verifikasi pada absensi terkait.
        </p>
      </CardContent>
    </Card>
  )
}
