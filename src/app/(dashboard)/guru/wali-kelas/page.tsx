// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users, ClipboardList, Wallet, Trash2, Plus, Loader2, ShieldCheck,
  Banknote, Receipt, TrendingUp, TrendingDown, PiggyBank, Calendar,
  Gavel, ClipboardCheck,
} from "lucide-react"
import {
  getWaliKelasInfo, updateSiswaJabatan,
  getJadwalPiket, createJadwalPiket, deleteJadwalPiket,
  getIuran, createIuran, deleteIuran, recordPembayaranIuran,
  getDenda, createDenda, deleteDenda, recordPembayaranDenda,
  getPengeluaran, createPengeluaran, deletePengeluaran,
  getSummaryKas,
  getJadwalPelajaranGuru, getMapelByKelas, createJadwalPelajaranGuru, deleteJadwalPelajaranGuru,
  getPelanggaran, createPelanggaran, deletePelanggaran,
  getAbsensiHarian, getJadwalByHari, saveAbsensiHarian,
} from "../actions"

const jabatanLabels: Record<string, string> = {
  KETUA: "Ketua Kelas", WAKIL: "Wakil Ketua",
  BENDAHARA: "Bendahara", SEKRETARIS: "Sekretaris",
}
const jabatanColors: Record<string, string> = {
  KETUA: "bg-blue-100 text-blue-700", WAKIL: "bg-indigo-100 text-indigo-700",
  BENDAHARA: "bg-emerald-100 text-emerald-700", SEKRETARIS: "bg-amber-100 text-amber-700",
}
const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export default function WaliKelasPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKelas, setSelectedKelas] = useState<any>(null)
  const [jadwalPiket, setJadwalPiket] = useState<any[]>([])
  const [iuranList, setIuranList] = useState<any[]>([])
  const [dendaList, setDendaList] = useState<any[]>([])
  const [pengeluaranList, setPengeluaranList] = useState<any[]>([])
  const [summaryKas, setSummaryKas] = useState<any>(null)
  const [piketDialog, setPiketDialog] = useState(false)
  const [iuranDialog, setIuranDialog] = useState(false)
  const [dendaDialog, setDendaDialog] = useState(false)
  const [pengeluaranDialog, setPengeluaranDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [piketSiswaId, setPiketSiswaId] = useState("")
  const [piketHari, setPiketHari] = useState("")
  const [iuranNama, setIuranNama] = useState("")
  const [iuranNominal, setIuranNominal] = useState("")
  const [iuranTenggat, setIuranTenggat] = useState("")
  const [iuranDeskripsi, setIuranDeskripsi] = useState("")
  const [dendaNama, setDendaNama] = useState("")
  const [dendaNominal, setDendaNominal] = useState("")
  const [dendaDeskripsi, setDendaDeskripsi] = useState("")
  const [pengeluaranJumlah, setPengeluaranJumlah] = useState("")
  const [pengeluaranKeterangan, setPengeluaranKeterangan] = useState("")
  const [pengeluaranTanggal, setPengeluaranTanggal] = useState("")
  const [jadwalPelajaranList, setJadwalPelajaranList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [jpDialog, setJpDialog] = useState(false)
  const [jpMapelId, setJpMapelId] = useState("")
  const [jpHari, setJpHari] = useState("")
  const [jpJamMulai, setJpJamMulai] = useState("")
  const [jpJamSelesai, setJpJamSelesai] = useState("")

  const [pelanggaranList, setPelanggaranList] = useState<any[]>([])
  const [pelanggaranDialog, setPelanggaranDialog] = useState(false)
  const [pelanggaranSiswaId, setPelanggaranSiswaId] = useState("")
  const [pelanggaranJenis, setPelanggaranJenis] = useState("")
  const [pelanggaranDeskripsi, setPelanggaranDeskripsi] = useState("")
  const [pelanggaranPoin, setPelanggaranPoin] = useState("")
  const [pelanggaranTindakan, setPelanggaranTindakan] = useState("")
  const [pelanggaranTanggal, setPelanggaranTanggal] = useState("")
  const [pelanggaranFilterSiswa, setPelanggaranFilterSiswa] = useState("")

  const [absensiTanggal, setAbsensiTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [jadwalHariIni, setJadwalHariIni] = useState<any[]>([])
  const [absensiData, setAbsensiData] = useState<any[]>([])
  const [absensiForm, setAbsensiForm] = useState<Record<string, Record<string, string>>>({})
  const [absensiSaving, setAbsensiSaving] = useState(false)

  const fetchData = async () => {
    try {
      const k = await getWaliKelasInfo()
      setKelasList(k as any[])
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const loadKelas = async (k: any) => {
    setSelectedKelas(k)
    try {
      const [piket, iuran, denda, pengeluaran, summary, jp, mapel] = await Promise.all([
        getJadwalPiket(k.id),
        getIuran(k.id),
        getDenda(k.id),
        getPengeluaran(k.id),
        getSummaryKas(k.id),
        getJadwalPelajaranGuru(k.id),
        getMapelByKelas(k.id),
      ])
      setJadwalPiket(piket as any[])
      setIuranList(iuran as any[])
      setDendaList(denda as any[])
      setPengeluaranList(pengeluaran as any[])
      setSummaryKas(summary as any)
      setJadwalPelajaranList(jp as any[])
      setMapelList(mapel as any[])
    } catch { toast.error("Gagal memuat detail kelas") }
  }

  const handleJabatan = async (siswaId: string, jabatan: string) => {
    try {
      await updateSiswaJabatan(siswaId, jabatan || null)
      toast.success("Jabatan diperbarui")
      fetchData().then(() => selectedKelas && loadKelas(selectedKelas))
    } catch { toast.error("Gagal update jabatan") }
  }

  const handleAddPiket = async () => {
    if (!piketSiswaId || !piketHari) { toast.error("Pilih siswa dan hari"); return }
    setSaving(true)
    try {
      await createJadwalPiket(selectedKelas.id, piketSiswaId, piketHari)
      toast.success("Piket ditambahkan")
      setPiketDialog(false); setPiketSiswaId(""); setPiketHari("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePiket = async (id: string) => {
    try { await deleteJadwalPiket(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus piket") }
  }

  const handleAddIuran = async () => {
    if (!iuranNama || !iuranNominal) { toast.error("Nama dan nominal harus diisi"); return }
    setSaving(true)
    try {
      await createIuran({ kelasId: selectedKelas.id, nama: iuranNama, nominal: Number(iuranNominal), tenggat: iuranTenggat || undefined, deskripsi: iuranDeskripsi || undefined })
      toast.success("Iuran ditambahkan")
      setIuranDialog(false); setIuranNama(""); setIuranNominal(""); setIuranTenggat(""); setIuranDeskripsi("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteIuran = async (id: string) => {
    try { await deleteIuran(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus iuran") }
  }

  const handleBayarIuran = async (iuranId: string, siswaId: string) => {
    try {
      const iuran = iuranList.find((i) => i.id === iuranId)
      await recordPembayaranIuran(iuranId, siswaId, iuran?.nominal || 0)
      toast.success("Pembayaran dicatat")
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal") }
  }

  const handleAddDenda = async () => {
    if (!dendaNama || !dendaNominal) { toast.error("Nama dan nominal harus diisi"); return }
    setSaving(true)
    try {
      await createDenda({ kelasId: selectedKelas.id, nama: dendaNama, nominal: Number(dendaNominal), deskripsi: dendaDeskripsi || undefined })
      toast.success("Denda ditambahkan")
      setDendaDialog(false); setDendaNama(""); setDendaNominal(""); setDendaDeskripsi("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteDenda = async (id: string) => {
    try { await deleteDenda(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus denda") }
  }

  const handleBayarDenda = async (dendaId: string, siswaId: string) => {
    try {
      const denda = dendaList.find((d) => d.id === dendaId)
      await recordPembayaranDenda(dendaId, siswaId, denda?.nominal || 0)
      toast.success("Pembayaran denda dicatat")
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal") }
  }

  const handleAddPengeluaran = async () => {
    if (!pengeluaranJumlah || !pengeluaranKeterangan) { toast.error("Jumlah dan keterangan harus diisi"); return }
    setSaving(true)
    try {
      await createPengeluaran({ kelasId: selectedKelas.id, jumlah: Number(pengeluaranJumlah), keterangan: pengeluaranKeterangan, tanggal: pengeluaranTanggal || undefined })
      toast.success("Pengeluaran ditambahkan")
      setPengeluaranDialog(false); setPengeluaranJumlah(""); setPengeluaranKeterangan(""); setPengeluaranTanggal("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePengeluaran = async (id: string) => {
    try { await deletePengeluaran(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus pengeluaran") }
  }

  const handleAddJadwalPelajaran = async () => {
    if (!jpMapelId || !jpHari || !jpJamMulai || !jpJamSelesai) { toast.error("Semua field harus diisi"); return }
    setSaving(true)
    try {
      await createJadwalPelajaranGuru({ kelasId: selectedKelas.id, mataPelajaranId: jpMapelId, hari: jpHari, jamMulai: jpJamMulai, jamSelesai: jpJamSelesai })
      toast.success("Jadwal pelajaran ditambahkan")
      setJpDialog(false); setJpMapelId(""); setJpHari(""); setJpJamMulai(""); setJpJamSelesai("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteJadwalPelajaran = async (id: string) => {
    try { await deleteJadwalPelajaranGuru(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus jadwal pelajaran") }
  }

  const loadPelanggaran = async () => {
    if (!selectedKelas) return
    try {
      const data = await getPelanggaran(selectedKelas.id)
      setPelanggaranList(data as any[])
    } catch { toast.error("Gagal memuat pelanggaran") }
  }

  const handleAddPelanggaran = async () => {
    if (!pelanggaranSiswaId || !pelanggaranJenis) { toast.error("Pilih siswa dan jenis pelanggaran"); return }
    setSaving(true)
    try {
      await createPelanggaran({
        kelasId: selectedKelas.id,
        siswaId: pelanggaranSiswaId,
        jenis: pelanggaranJenis,
        deskripsi: pelanggaranDeskripsi || undefined,
        poin: pelanggaranPoin ? Number(pelanggaranPoin) : undefined,
        tindakan: pelanggaranTindakan || undefined,
        tanggal: pelanggaranTanggal || undefined,
      })
      toast.success("Pelanggaran dicatat")
      setPelanggaranDialog(false)
      setPelanggaranSiswaId("")
      setPelanggaranJenis("")
      setPelanggaranDeskripsi("")
      setPelanggaranPoin("")
      setPelanggaranTindakan("")
      setPelanggaranTanggal("")
      loadPelanggaran()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePelanggaran = async (id: string) => {
    try { await deletePelanggaran(id); loadPelanggaran() }
    catch { toast.error("Gagal hapus pelanggaran") }
  }

  const loadAbsensi = async (tanggal: string) => {
    if (!selectedKelas) return
    try {
      const dayName = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long" })
      const hari = dayName.charAt(0).toUpperCase() + dayName.slice(1)
      const [jadwal, existing] = await Promise.all([
        getJadwalByHari(selectedKelas.id, hari),
        getAbsensiHarian(selectedKelas.id, tanggal),
      ])
      setJadwalHariIni(jadwal as any[])
      setAbsensiData(existing as any[])
    } catch { toast.error("Gagal memuat absensi") }
  }

  useEffect(() => {
    if (selectedKelas) {
      loadPelanggaran()
      loadAbsensi(absensiTanggal)
    }
  }, [selectedKelas])

  useEffect(() => {
    if (selectedKelas) loadAbsensi(absensiTanggal)
  }, [absensiTanggal])

  const initAbsensiForm = (mataPelajaranId: string) => {
    if (!selectedKelas?.siswas) return
    const existingAbsensi = absensiData.find((a) => a.mataPelajaranId === mataPelajaranId)
    const form: Record<string, string> = {}
    const activeSiswa = selectedKelas.siswas.filter((s: any) => !s.deletedAt)
    activeSiswa.forEach((s: any) => {
      const record = existingAbsensi?.siswa?.find((as: any) => as.siswaId === s.id)
      form[s.id] = record?.status || "HADIR"
    })
    return form
  }

  const getAbsensiFormForLesson = (mataPelajaranId: string) => {
    if (!absensiForm[mataPelajaranId]) {
      const form = initAbsensiForm(mataPelajaranId)
      if (form) {
        setAbsensiForm((prev) => ({ ...prev, [mataPelajaranId]: form }))
      }
      return form || {}
    }
    return absensiForm[mataPelajaranId]
  }

  const handleAbsensiStatusChange = (mataPelajaranId: string, siswaId: string, status: string) => {
    setAbsensiForm((prev) => ({
      ...prev,
      [mataPelajaranId]: { ...(prev[mataPelajaranId] || {}), [siswaId]: status },
    }))
  }

  const handleSaveAbsensi = async (mataPelajaranId: string) => {
    if (!selectedKelas) return
    setAbsensiSaving(true)
    try {
      const form = absensiForm[mataPelajaranId] || {}
      const siswaStatus = Object.entries(form).map(([siswaId, status]) => ({ siswaId, status }))
      await saveAbsensiHarian(selectedKelas.id, mataPelajaranId, absensiTanggal, siswaStatus)
      toast.success("Absensi disimpan")
      loadAbsensi(absensiTanggal)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setAbsensiSaving(false) }
  }

  const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  if (kelasList.length === 0) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card><CardContent className="p-12 text-center"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Anda belum menjadi wali kelas</p>
        <p className="text-muted-foreground mt-1">Admin harus menetapkan Anda sebagai wali kelas di menu Kelas.</p>
      </CardContent></Card>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />Wali Kelas</h1>
        <p className="text-muted-foreground mt-1">Kelola kelas yang Anda ampu sebagai wali kelas</p>
      </div>

      {!selectedKelas ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kelasList.map((k) => (
            <Card key={k.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadKelas(k)}>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{k.nama}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{k._count.siswas} siswa</p></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedKelas(null)}>&larr; Kembali</Button>
            <h2 className="text-xl font-bold">{selectedKelas.nama}</h2>
            <Badge variant="secondary">{selectedKelas._count?.siswas || selectedKelas.siswas?.length || 0} siswa</Badge>
          </div>

          <Tabs defaultValue="kas">
            <div className="overflow-x-auto pb-px">
              <TabsList className="flex-nowrap w-max min-w-full">
                <TabsTrigger value="kas"><PiggyBank className="h-4 w-4 mr-1" /> Kas</TabsTrigger>
                <TabsTrigger value="struktur"><Users className="h-4 w-4 mr-1" /> Struktur</TabsTrigger>
                <TabsTrigger value="piket"><ClipboardList className="h-4 w-4 mr-1" /> Piket</TabsTrigger>
                <TabsTrigger value="iuran"><Wallet className="h-4 w-4 mr-1" /> Iuran</TabsTrigger>
                <TabsTrigger value="denda"><Banknote className="h-4 w-4 mr-1" /> Denda</TabsTrigger>
                <TabsTrigger value="pengeluaran"><Receipt className="h-4 w-4 mr-1" /> Pengeluaran</TabsTrigger>
                <TabsTrigger value="jadwal"><Calendar className="h-4 w-4 mr-1" /> Jadwal</TabsTrigger>
                <TabsTrigger value="pelanggaran"><Gavel className="h-4 w-4 mr-1" /> Pelanggaran</TabsTrigger>
                <TabsTrigger value="absensi"><ClipboardCheck className="h-4 w-4 mr-1" /> Absensi</TabsTrigger>
              </TabsList>
            </div>

            {/* KAS */}
            <TabsContent value="kas" className="space-y-4 mt-4">
              {summaryKas && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card><CardContent className="p-5 text-center"><TrendingUp className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Pemasukan Iuran</p><p className="text-lg font-bold text-emerald-600">{formatRp(summaryKas.pemasukanIuran)}</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><Banknote className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Pemasukan Denda</p><p className="text-lg font-bold text-amber-600">{formatRp(summaryKas.pemasukanDenda)}</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><TrendingDown className="h-6 w-6 mx-auto text-red-500 mb-2" />
                      <p className="text-xs text-muted-foreground">Pengeluaran</p><p className="text-lg font-bold text-red-600">{formatRp(summaryKas.totalPengeluaran)}</p></CardContent></Card>
                    <Card className="border-primary"><CardContent className="p-5 text-center"><PiggyBank className="h-6 w-6 mx-auto text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">Sisa Kas</p><p className={`text-lg font-bold ${summaryKas.sisaKas >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(summaryKas.sisaKas)}</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Detail Kas</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between py-1 border-b"><span>Total Pemasukan</span><span className="font-semibold text-emerald-600">{formatRp(summaryKas.totalPemasukan)}</span></div>
                      <div className="flex justify-between py-1 border-b"><span>Total Pengeluaran</span><span className="font-semibold text-red-600">{formatRp(summaryKas.totalPengeluaran)}</span></div>
                      <div className="flex justify-between py-1 text-base"><span className="font-bold">Sisa Kas</span><span className={`font-bold ${summaryKas.sisaKas >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(summaryKas.sisaKas)}</span></div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* STRUKTUR */}
            <TabsContent value="struktur" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-lg">Struktur Kelas</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {["KETUA", "WAKIL", "SEKRETARIS", "BENDAHARA"].map((pos) => {
                      const siswa = selectedKelas.siswas?.find((s: any) => s.jabatan === pos)
                      return (
                        <Card key={pos} className="border-primary/20">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{jabatanLabels[pos]}</p>
                            <p className="font-semibold mt-1">{siswa?.nama || <span className="text-muted-foreground italic">Kosong</span>}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Atur Jabatan Siswa</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((siswa: any) => (
                      <div key={siswa.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                        <span className="text-sm font-medium">{siswa.nama}</span>
                        <Select value={siswa.jabatan || "none"} onValueChange={(v) => handleJabatan(siswa.id, v === "none" ? "" : v)}>
                          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Tidak ada</SelectItem>
                            <SelectItem value="KETUA">Ketua Kelas</SelectItem>
                            <SelectItem value="WAKIL">Wakil Ketua</SelectItem>
                            <SelectItem value="BENDAHARA">Bendahara</SelectItem>
                            <SelectItem value="SEKRETARIS">Sekretaris</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PIKET */}
            <TabsContent value="piket" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={piketDialog} onOpenChange={setPiketDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Piket</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Jadwal Piket</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Siswa</Label>
                        <Select value={piketSiswaId} onValueChange={setPiketSiswaId}>
                          <SelectTrigger><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                          <SelectContent>
                            {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Hari</Label>
                        <Select value={piketHari} onValueChange={setPiketHari}>
                          <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                          <SelectContent>{hariList.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddPiket} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Hari</th>
                      <th className="text-left p-3 font-medium">Siswa</th>
                      <th className="text-right p-3 font-medium w-16">Aksi</th>
                    </tr></thead>
                    <tbody>
                      {jadwalPiket.length === 0 ? (
                        <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Belum ada jadwal piket</td></tr>
                      ) : (
                        hariList.map((hari) => {
                          const items = jadwalPiket.filter((p) => p.hari === hari)
                          return items.length > 0 ? items.map((p, i) => (
                            <tr key={p.id} className={i === 0 ? "border-t" : ""}>
                              {i === 0 && <td className="p-3 font-medium align-top" rowSpan={items.length}>{hari}</td>}
                              <td className="p-3">{p.siswa.nama}</td>
                              <td className="p-3 text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePiket(p.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          )) : null
                        })
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* IURAN */}
            <TabsContent value="iuran" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={iuranDialog} onOpenChange={setIuranDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Iuran</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Iuran Kelas</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Nama Iuran</Label>
                        <Input value={iuranNama} onChange={(e) => setIuranNama(e.target.value)} placeholder="Contoh: Iuran Seragam" /></div>
                      <div className="space-y-2"><Label>Nominal (Rp)</Label>
                        <Input type="number" value={iuranNominal} onChange={(e) => setIuranNominal(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Tenggat (opsional)</Label>
                        <Input type="date" value={iuranTenggat} onChange={(e) => setIuranTenggat(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Deskripsi (opsional)</Label>
                        <Textarea value={iuranDeskripsi} onChange={(e) => setIuranDeskripsi(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddIuran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {iuranList.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada iuran</CardContent></Card>
              ) : iuranList.map((iuran) => {
                const totalSiswa = selectedKelas.siswas?.filter((s: any) => !s.deletedAt).length || 0
                const sudahBayar = iuran._count?.pembayaran || 0
                return (
                  <Card key={iuran.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div><CardTitle className="text-base">{iuran.nama}</CardTitle>
                          <p className="text-xs text-muted-foreground">{formatRp(iuran.nominal)} per siswa
                            {iuran.tenggat && ` · Tenggat: ${new Date(iuran.tenggat).toLocaleDateString("id-ID")}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteIuran(iuran.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">{sudahBayar}/{totalSiswa} sudah bayar</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {iuran.pembayaran?.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5">
                            <span>{p.siswa.nama}</span>
                            <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                          </div>
                        ))}
                        {selectedKelas.siswas?.filter((s: any) => !s.deletedAt && !iuran.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                            <span>{s.nama}</span>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleBayarIuran(iuran.id, s.id)}>
                              Catat Bayar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            {/* DENDA */}
            <TabsContent value="denda" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={dendaDialog} onOpenChange={setDendaDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Denda</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Denda</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Nama Denda</Label>
                        <Input value={dendaNama} onChange={(e) => setDendaNama(e.target.value)} placeholder="Contoh: Denda Terlambat" /></div>
                      <div className="space-y-2"><Label>Nominal (Rp)</Label>
                        <Input type="number" value={dendaNominal} onChange={(e) => setDendaNominal(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Deskripsi (opsional)</Label>
                        <Textarea value={dendaDeskripsi} onChange={(e) => setDendaDeskripsi(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddDenda} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {dendaList.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada denda</CardContent></Card>
              ) : dendaList.map((denda) => {
                const totalSiswa = selectedKelas.siswas?.filter((s: any) => !s.deletedAt).length || 0
                const sudahBayar = denda._count?.pembayaran || 0
                return (
                  <Card key={denda.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div><CardTitle className="text-base">{denda.nama}</CardTitle>
                          <p className="text-xs text-muted-foreground">{formatRp(denda.nominal)} per siswa</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteDenda(denda.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">{sudahBayar}/{totalSiswa} sudah bayar</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {denda.pembayaran?.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5">
                            <span>{p.siswa.nama}</span>
                            <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                          </div>
                        ))}
                        {selectedKelas.siswas?.filter((s: any) => !s.deletedAt && !denda.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                            <span>{s.nama}</span>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleBayarDenda(denda.id, s.id)}>
                              Catat Bayar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            {/* PENGELUARAN */}
            <TabsContent value="pengeluaran" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={pengeluaranDialog} onOpenChange={setPengeluaranDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Pengeluaran</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Jumlah (Rp)</Label>
                        <Input type="number" value={pengeluaranJumlah} onChange={(e) => setPengeluaranJumlah(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Keterangan</Label>
                        <Input value={pengeluaranKeterangan} onChange={(e) => setPengeluaranKeterangan(e.target.value)} placeholder="Contoh: Beli alat kebersihan" /></div>
                      <div className="space-y-2"><Label>Tanggal (opsional)</Label>
                        <Input type="date" value={pengeluaranTanggal} onChange={(e) => setPengeluaranTanggal(e.target.value)} /></div>
                      <Button onClick={handleAddPengeluaran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {pengeluaranList.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada pengeluaran</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Tanggal</th>
                        <th className="text-left p-3 font-medium">Keterangan</th>
                        <th className="text-right p-3 font-medium">Jumlah</th>
                        <th className="text-right p-3 font-medium w-16">Aksi</th>
                      </tr></thead>
                      <tbody>
                        {pengeluaranList.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-3 text-xs">{new Date(p.tanggal).toLocaleDateString("id-ID")}</td>
                            <td className="p-3">{p.keterangan}</td>
                            <td className="p-3 text-right font-medium text-red-600">{formatRp(p.jumlah)}</td>
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePengeluaran(p.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* JADWAL PELAJARAN */}
            <TabsContent value="jadwal" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={jpDialog} onOpenChange={setJpDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Jadwal</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Jadwal Pelajaran</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Mata Pelajaran</Label>
                        <Select value={jpMapelId} onValueChange={setJpMapelId}>
                          <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                          <SelectContent>{mapelList.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Hari</Label>
                        <Select value={jpHari} onValueChange={setJpHari}>
                          <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                          <SelectContent>{hariList.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Jam Mulai</Label><Input type="time" value={jpJamMulai} onChange={(e) => setJpJamMulai(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Jam Selesai</Label><Input type="time" value={jpJamSelesai} onChange={(e) => setJpJamSelesai(e.target.value)} /></div>
                      </div>
                      <Button onClick={handleAddJadwalPelajaran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {hariList.map((hari) => {
                  const items = jadwalPelajaranList.filter((j) => j.hari === hari)
                  return (
                    <Card key={hari} className={items.length === 0 ? "opacity-50" : ""}>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-center">{hari}</CardTitle></CardHeader>
                      <CardContent>
                        {items.length === 0 ? (
                          <p className="text-xs text-center text-muted-foreground py-4">Tidak ada</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((j) => (
                              <div key={j.id} className="rounded-lg border p-2 text-center relative group">
                                <Button variant="ghost" size="icon" className="absolute -top-1.5 -right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteJadwalPelajaran(j.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                                <p className="text-xs font-medium">{j.mataPelajaran?.nama}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {j.jamMulai?.slice(0, 5)} - {j.jamSelesai?.slice(0, 5)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {/* PELANGGARAN */}
            <TabsContent value="pelanggaran" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="w-full sm:w-48">
                  <Select value={pelanggaranFilterSiswa} onValueChange={setPelanggaranFilterSiswa}>
                    <SelectTrigger><SelectValue placeholder="Semua siswa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Semua siswa</SelectItem>
                      {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={pelanggaranDialog} onOpenChange={setPelanggaranDialog}>
                  <DialogTrigger asChild><Button size="sm" className="p-2 sm:px-3 sm:py-1"><Plus className="h-4 w-4 mr-1" /> Catat Pelanggaran</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Catat Pelanggaran</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Siswa</Label>
                        <Select value={pelanggaranSiswaId} onValueChange={setPelanggaranSiswaId}>
                          <SelectTrigger><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                          <SelectContent>
                            {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Jenis Pelanggaran</Label>
                        <Input value={pelanggaranJenis} onChange={(e) => setPelanggaranJenis(e.target.value)} placeholder="Contoh: Terlambat, Membuang Sampah Sembarangan" /></div>
                      <div className="space-y-2"><Label>Deskripsi (opsional)</Label>
                        <Textarea value={pelanggaranDeskripsi} onChange={(e) => setPelanggaranDeskripsi(e.target.value)} rows={2} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Poin (opsional)</Label>
                          <Input type="number" value={pelanggaranPoin} onChange={(e) => setPelanggaranPoin(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Tanggal</Label>
                          <Input type="date" value={pelanggaranTanggal} onChange={(e) => setPelanggaranTanggal(e.target.value)} /></div>
                      </div>
                      <div className="space-y-2"><Label>Tindakan (opsional)</Label>
                        <Textarea value={pelanggaranTindakan} onChange={(e) => setPelanggaranTindakan(e.target.value)} rows={2} placeholder="Contoh: Teguran lisan, panggilan orang tua" /></div>
                      <Button onClick={handleAddPelanggaran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {pelanggaranList.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada pelanggaran</CardContent></Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pelanggaranList
                    .filter((p) => !pelanggaranFilterSiswa || pelanggaranFilterSiswa === " " || p.siswaId === pelanggaranFilterSiswa)
                    .map((p: any) => (
                      <Card key={p.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-sm">{p.siswa?.nama}</CardTitle>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="secondary" className="text-[10px]">{p.jenis}</Badge>
                                {p.poin != null && (
                                  <Badge className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100">{p.poin} poin</Badge>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePelanggaran(p.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {p.deskripsi && <p className="text-muted-foreground">{p.deskripsi}</p>}
                          {p.tindakan && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Tindakan: </span>
                              <span className="text-xs">{p.tindakan}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID")}</p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </TabsContent>

            {/* ABSENSI */}
            <TabsContent value="absensi" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-full sm:w-56">
                  <Label className="text-xs text-muted-foreground mb-1 block">Tanggal</Label>
                  <Input type="date" value={absensiTanggal} onChange={(e) => setAbsensiTanggal(e.target.value)} />
                </div>
              </div>

              {jadwalHariIni.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Tidak ada jadwal pelajaran hari ini</CardContent></Card>
              ) : (
                jadwalHariIni.map((jd: any) => {
                  const form = getAbsensiFormForLesson(jd.id)
                  const activeSiswa = selectedKelas.siswas?.filter((s: any) => !s.deletedAt) || []
                  return (
                    <Card key={jd.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{jd.mataPelajaran?.nama}</CardTitle>
                            {jd.jamMulai && jd.jamSelesai && (
                              <p className="text-xs text-muted-foreground">{jd.jamMulai.slice(0, 5)} - {jd.jamSelesai.slice(0, 5)}</p>
                            )}
                          </div>
                          <Button size="sm" className="p-2 sm:px-3 sm:py-1" onClick={() => handleSaveAbsensi(jd.id)} disabled={absensiSaving}>
                            {absensiSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Simpan
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50">
                            <th className="text-left p-2 sm:p-3 font-medium">No</th>
                            <th className="text-left p-2 sm:p-3 font-medium">Nama</th>
                            <th className="text-center p-2 sm:p-3 font-medium w-32">Status</th>
                          </tr></thead>
                          <tbody>
                            {activeSiswa.length === 0 ? (
                              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Tidak ada siswa</td></tr>
                            ) : (
                              activeSiswa.map((s: any, i: number) => (
                                <tr key={s.id} className="border-t">
                                  <td className="p-2 sm:p-3 text-xs text-muted-foreground">{i + 1}</td>
                                  <td className="p-2 sm:p-3 font-medium">{s.nama}</td>
                                  <td className="p-2 sm:p-3 text-center">
                                    <Select
                                      value={form[s.id] || "HADIR"}
                                      onValueChange={(v) => handleAbsensiStatusChange(jd.id, s.id, v)}
                                    >
                                      <SelectTrigger className="h-8 w-28 text-xs mx-auto"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="HADIR">HADIR</SelectItem>
                                        <SelectItem value="SAKIT">SAKIT</SelectItem>
                                        <SelectItem value="IZIN">IZIN</SelectItem>
                                        <SelectItem value="ALPA">ALPA</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </motion.div>
  )
}
