// @ts-nocheck
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
  Gavel, ClipboardCheck, ExternalLink, Check, X, Pencil, Camera, ImagePlus, BarChart3,
} from "lucide-react"
import {
  getWaliKelasInfo, updateSiswaJabatan,
  getJadwalPiket, createJadwalPiket, deleteJadwalPiket,
  getIuran, createIuran, deleteIuran, recordPembayaranIuran,
  confirmPembayaranIuran, rejectPembayaranIuran,
  getDenda, createDenda, deleteDenda, recordPembayaranDenda,
  getPengeluaran, createPengeluaran, deletePengeluaran,
  getSummaryKas,
  getJadwalPelajaranGuru, getMapelByKelas, createJadwalPelajaranGuru, updateJadwalPelajaranGuru, deleteJadwalPelajaranGuru,
  getPelanggaran, createPelanggaran, updatePelanggaran, deletePelanggaran,
  getRekapAbsensi, getDetailAbsensiSiswa,
} from "../actions"
import { compressImage } from "@/lib/compress-image"

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
  const [editingJp, setEditingJp] = useState<any>(null)

  const [pelanggaranList, setPelanggaranList] = useState<any[]>([])
  const [pelanggaranDialog, setPelanggaranDialog] = useState(false)
  const [pelanggaranSiswaId, setPelanggaranSiswaId] = useState("")
  const [pelanggaranJenis, setPelanggaranJenis] = useState("")
  const [pelanggaranDeskripsi, setPelanggaranDeskripsi] = useState("")
  const [pelanggaranPoin, setPelanggaranPoin] = useState("")
  const [pelanggaranTindakan, setPelanggaranTindakan] = useState("")
  const [pelanggaranTanggal, setPelanggaranTanggal] = useState("")
  const [pelanggaranFoto, setPelanggaranFoto] = useState<File | null>(null)
  const [pelanggaranFotoPreview, setPelanggaranFotoPreview] = useState<string | null>(null)
  const [pelanggaranFotoUploading, setPelanggaranFotoUploading] = useState(false)
  const [pelanggaranFilterSiswa, setPelanggaranFilterSiswa] = useState("")
  const [editingPelanggaran, setEditingPelanggaran] = useState<any>(null)
  const pelanggaranFotoInputRef = useRef<HTMLInputElement>(null)
  const pelanggaranCameraInputRef = useRef<HTMLInputElement>(null)

  const [rekapAbsensi, setRekapAbsensi] = useState<any>(null)
  const [detailAbsensi, setDetailAbsensi] = useState<any>(null)
  const [detailAbsensiOpen, setDetailAbsensiOpen] = useState(false)
  const [kelasLoading, setKelasLoading] = useState(false)
  const [rekapLoading, setRekapLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("kas")
  const loadKelasReqRef = useRef(0)
  const activeKelasIdRef = useRef<string | null>(null)
  const rekapInFlightRef = useRef<string | null>(null)

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
    activeKelasIdRef.current = k.id
    setKelasLoading(true)
    const reqId = ++loadKelasReqRef.current
    try {
      const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn() } catch (e) { console.error("Wali kelas: gagal memuat sebagian data", e); return fallback }
      }
      const [piket, iuran, denda, pengeluaran, summary, jp, mapel] = await Promise.all([
        safe(() => getJadwalPiket(k.id), []),
        safe(() => getIuran(k.id), []),
        safe(() => getDenda(k.id), []),
        safe(() => getPengeluaran(k.id), []),
        safe(() => getSummaryKas(k.id), null),
        safe(() => getJadwalPelajaranGuru(k.id), []),
        safe(() => getMapelByKelas(k.id), []),
      ])
      if (reqId !== loadKelasReqRef.current) return
      setJadwalPiket(piket as any[])
      setIuranList(iuran as any[])
      setDendaList(denda as any[])
      setPengeluaranList(pengeluaran as any[])
      setSummaryKas(summary as any)
      setJadwalPelajaranList(jp as any[])
      setMapelList(mapel as any[])
      setRekapAbsensi(null)
      setDetailAbsensi(null)
    } catch (e) { console.error("Gagal memuat detail kelas", e); toast.error("Gagal memuat detail kelas") }
    finally { if (reqId === loadKelasReqRef.current) setKelasLoading(false) }
  }

  const loadRekapAbsensi = useCallback(async () => {
    if (!selectedKelas) return
    const kelasId = selectedKelas.id
    if (rekapAbsensi || rekapInFlightRef.current === kelasId) return
    rekapInFlightRef.current = kelasId
    setRekapLoading(true)
    try {
      const data = await getRekapAbsensi(kelasId)
      if (activeKelasIdRef.current === kelasId) setRekapAbsensi(data as any)
    } catch {
      if (activeKelasIdRef.current === kelasId) toast.error("Gagal memuat rekap absensi")
    } finally {
      if (rekapInFlightRef.current === kelasId) {
        rekapInFlightRef.current = null
        setRekapLoading(false)
      }
    }
  }, [selectedKelas, rekapAbsensi])

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
      await recordPembayaranIuran(iuranId, siswaId)
      toast.success("Pembayaran dicatat")
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal") }
  }

  const handleConfirmIuran = async (iuranId: string, siswaId: string) => {
    try {
      await confirmPembayaranIuran(iuranId, siswaId)
      toast.success("Pembayaran dikonfirmasi")
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal konfirmasi") }
  }

  const handleRejectIuran = async (iuranId: string, siswaId: string) => {
    try {
      await rejectPembayaranIuran(iuranId, siswaId)
      toast.success("Pengajuan ditolak")
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal menolak pengajuan") }
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
      setJpDialog(false); setJpMapelId(""); setJpHari(""); setJpJamMulai(""); setJpJamSelesai(""); setEditingJp(null)
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleEditJadwalPelajaran = async () => {
    if (!editingJp || !jpMapelId || !jpHari || !jpJamMulai || !jpJamSelesai) { toast.error("Semua field harus diisi"); return }
    setSaving(true)
    try {
      await updateJadwalPelajaranGuru(editingJp.id, { mataPelajaranId: jpMapelId, hari: jpHari, jamMulai: jpJamMulai, jamSelesai: jpJamSelesai })
      toast.success("Jadwal pelajaran diperbarui")
      setJpDialog(false); setJpMapelId(""); setJpHari(""); setJpJamMulai(""); setJpJamSelesai(""); setEditingJp(null)
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const openAddJp = () => {
    setEditingJp(null)
    setJpMapelId(""); setJpHari(""); setJpJamMulai(""); setJpJamSelesai("")
    setJpDialog(true)
  }

  const openEditJp = (j: any) => {
    setEditingJp(j)
    setJpMapelId(j.mataPelajaranId || "")
    setJpHari(j.hari)
    setJpJamMulai(j.jamMulai?.slice(0, 5) || "")
    setJpJamSelesai(j.jamSelesai?.slice(0, 5) || "")
    setJpDialog(true)
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

  const handleFotoPelanggaran = (file: File | null) => {
    setPelanggaranFoto(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setPelanggaranFotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setPelanggaranFotoPreview(null)
    }
  }

  const resetPelanggaranForm = () => {
    setEditingPelanggaran(null)
    setPelanggaranSiswaId("")
    setPelanggaranJenis("")
    setPelanggaranDeskripsi("")
    setPelanggaranPoin("")
    setPelanggaranTindakan("")
    setPelanggaranTanggal("")
    handleFotoPelanggaran(null)
    if (pelanggaranFotoInputRef.current) pelanggaranFotoInputRef.current.value = ""
    if (pelanggaranCameraInputRef.current) pelanggaranCameraInputRef.current.value = ""
  }

  const openEditPelanggaran = (p: any) => {
    setEditingPelanggaran(p)
    setPelanggaranSiswaId(p.siswaId)
    setPelanggaranJenis(p.jenis)
    setPelanggaranDeskripsi(p.deskripsi || "")
    setPelanggaranPoin(p.poin != null ? String(p.poin) : "")
    setPelanggaranTindakan(p.tindakan || "")
    setPelanggaranTanggal(p.tanggal ? new Date(p.tanggal).toISOString().slice(0, 10) : "")
    handleFotoPelanggaran(null)
    setPelanggaranFotoPreview(p.fotoUrl || null)
    setPelanggaranDialog(true)
  }

  const handleAddPelanggaran = async () => {
    if (!pelanggaranSiswaId || !pelanggaranJenis) { toast.error("Pilih siswa dan jenis pelanggaran"); return }
    setSaving(true)
    try {
      let fotoUrl: string | null = null
      if (pelanggaranFoto) {
        setPelanggaranFotoUploading(true)
        const file = await compressImage(pelanggaranFoto)
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        if (!uploadRes.ok) throw new Error("Gagal upload foto")
        const { url } = await uploadRes.json()
        fotoUrl = url
      } else if (editingPelanggaran) {
        fotoUrl = pelanggaranFotoPreview || null
      }
      const payload = {
        kelasId: selectedKelas.id,
        siswaId: pelanggaranSiswaId,
        jenis: pelanggaranJenis,
        deskripsi: pelanggaranDeskripsi || undefined,
        poin: pelanggaranPoin ? Number(pelanggaranPoin) : undefined,
        tindakan: pelanggaranTindakan || undefined,
        tanggal: pelanggaranTanggal || undefined,
        fotoUrl: fotoUrl || undefined,
      }
      if (editingPelanggaran) {
        await updatePelanggaran(editingPelanggaran.id, { ...payload, fotoUrl })
        toast.success("Pelanggaran diperbarui")
      } else {
        await createPelanggaran(payload)
        toast.success("Pelanggaran dicatat")
      }
      setPelanggaranDialog(false)
      resetPelanggaranForm()
      loadPelanggaran()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setPelanggaranFotoUploading(false); setSaving(false) }
  }

  const handleDeletePelanggaran = async (id: string) => {
    try { await deletePelanggaran(id); loadPelanggaran() }
    catch { toast.error("Gagal hapus pelanggaran") }
  }

  useEffect(() => {
    if (selectedKelas) {
      loadPelanggaran()
    }
  }, [selectedKelas])

  useEffect(() => {
    if (activeTab === "absensi" && selectedKelas) {
      loadRekapAbsensi()
    }
  }, [activeTab, selectedKelas, loadRekapAbsensi])

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
            {kelasLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="kas">
            <div className="sticky top-0 z-10 bg-background pb-px -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
              <TabsList className="flex-nowrap w-max min-w-full">
                <TabsTrigger value="kas" className="px-3 py-1.5 text-xs sm:text-sm"><PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Kas</TabsTrigger>
                <TabsTrigger value="struktur" className="px-3 py-1.5 text-xs sm:text-sm"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Struktur</TabsTrigger>
                <TabsTrigger value="piket" className="px-3 py-1.5 text-xs sm:text-sm"><ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Piket</TabsTrigger>
                <TabsTrigger value="iuran" className="px-3 py-1.5 text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Iuran</TabsTrigger>
                <TabsTrigger value="denda" className="px-3 py-1.5 text-xs sm:text-sm"><Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Denda</TabsTrigger>
                <TabsTrigger value="pengeluaran" className="px-3 py-1.5 text-xs sm:text-sm"><Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Pengeluaran</TabsTrigger>
                <TabsTrigger value="jadwal" className="px-3 py-1.5 text-xs sm:text-sm"><Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Jadwal</TabsTrigger>
                <TabsTrigger value="pelanggaran" className="px-3 py-1.5 text-xs sm:text-sm"><Gavel className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Pelanggaran</TabsTrigger>
                <TabsTrigger value="absensi" className="px-3 py-1.5 text-xs sm:text-sm"><ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" /> Absensi</TabsTrigger>
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
                const lunasCount = iuran.pembayaran?.filter((p: any) => p.status === "LUNAS").length || 0
                const menungguCount = iuran.pembayaran?.filter((p: any) => p.status === "MENUNGGU").length || 0
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
                      <p className="text-xs text-muted-foreground mb-2">
                        {lunasCount}/{totalSiswa} sudah bayar
                        {menungguCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {menungguCount} menunggu konfirmasi</span>}
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {iuran.pembayaran?.map((p: any) => (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-1.5 ${
                              p.status === "MENUNGGU"
                                ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                                : "bg-emerald-50 dark:bg-emerald-950/20"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{p.siswa.nama}</span>
                              {p.keterangan && (
                                <span className="block text-[10px] text-muted-foreground truncate">{p.keterangan}</span>
                              )}
                            </span>
                            {p.status === "MENUNGGU" ? (
                              <span className="flex items-center gap-1 shrink-0">
                                <Badge variant="warning" className="text-[10px]">Menunggu</Badge>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-emerald-600" onClick={() => handleConfirmIuran(iuran.id, p.siswaId)}>
                                  <Check className="h-3 w-3 mr-1" /> Konfirmasi
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-red-600" onClick={() => handleRejectIuran(iuran.id, p.siswaId)}>
                                  <X className="h-3 w-3 mr-1" /> Tolak
                                </Button>
                              </span>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Lunas</Badge>
                            )}
                          </div>
                        ))}
                        {selectedKelas.siswas?.filter((s: any) => !s.deletedAt && !iuran.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                            <span className="truncate mr-1">{s.nama}</span>
                            <Button variant="outline" size="sm" className="h-7 sm:h-6 text-[10px] px-2 shrink-0" onClick={() => handleBayarIuran(iuran.id, s.id)}>
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
                            <span className="truncate mr-1">{s.nama}</span>
                            <Button variant="outline" size="sm" className="h-7 sm:h-6 text-[10px] px-2 shrink-0" onClick={() => handleBayarDenda(denda.id, s.id)}>
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
                  <DialogTrigger asChild><Button size="sm" onClick={openAddJp}><Plus className="h-4 w-4 mr-1" /> Tambah Jadwal</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingJp ? "Edit Jadwal Pelajaran" : "Tambah Jadwal Pelajaran"}</DialogTitle></DialogHeader>
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
                      <Button onClick={editingJp ? handleEditJadwalPelajaran : handleAddJadwalPelajaran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {editingJp ? "Perbarui" : "Simpan"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {hariList.map((hari) => {
                  const items = jadwalPelajaranList
                    .filter((j) => j.hari === hari)
                    .sort((a: any, b: any) => (a.jamMulai || "").localeCompare(b.jamMulai || ""))
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
                                <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditJp(j)}>
                                    <Pencil className="h-3 w-3 text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteJadwalPelajaran(j.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
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
                <Dialog open={pelanggaranDialog} onOpenChange={(open) => { setPelanggaranDialog(open); if (!open) resetPelanggaranForm() }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="p-2 sm:px-3 sm:py-1" onClick={resetPelanggaranForm}>
                      <Plus className="h-4 w-4 mr-1" /> Catat Pelanggaran
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingPelanggaran ? "Edit Pelanggaran" : "Catat Pelanggaran"}</DialogTitle></DialogHeader>
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
                      <div className="space-y-2">
                        <Label>Dokumen Foto (opsional)</Label>
                        <input
                          id="pelanggaran-foto-input"
                          ref={pelanggaranFotoInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleFotoPelanggaran(e.target.files?.[0] || null)}
                        />
                        <input
                          id="pelanggaran-foto-camera"
                          ref={pelanggaranCameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          onChange={(e) => handleFotoPelanggaran(e.target.files?.[0] || null)}
                        />
                        {pelanggaranFotoPreview ? (
                          <div className="relative w-fit">
                            <img
                              src={pelanggaranFotoPreview}
                              alt="Dokumen pelanggaran"
                              className="h-32 w-44 rounded-lg border object-cover"
                            />
                            <Button
                              variant="destructive" size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                              onClick={() => {
                                handleFotoPelanggaran(null)
                                if (pelanggaranFotoInputRef.current) pelanggaranFotoInputRef.current.value = ""
                                if (pelanggaranCameraInputRef.current) pelanggaranCameraInputRef.current.value = ""
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <label
                              htmlFor="pelanggaran-foto-input"
                              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            >
                              <ImagePlus className="h-4 w-4 mr-1.5" /> Pilih Foto
                            </label>
                            <label
                              htmlFor="pelanggaran-foto-camera"
                              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            >
                              <Camera className="h-4 w-4 mr-1.5" /> Ambil Foto
                            </label>
                          </div>
                        )}
                      </div>
                      <Button onClick={handleAddPelanggaran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {pelanggaranFotoUploading ? "Mengunggah foto..." : "Simpan"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {(() => {
                const perSiswa: Record<string, { nama: string; jumlah: number; poin: number }> = {}
                for (const p of pelanggaranList) {
                  if (!perSiswa[p.siswaId]) perSiswa[p.siswaId] = { nama: p.siswa?.nama || "?", jumlah: 0, poin: 0 }
                  perSiswa[p.siswaId].jumlah++
                  perSiswa[p.siswaId].poin += p.poin || 0
                }
                const ranked = Object.values(perSiswa).sort((a: any, b: any) => b.jumlah - a.jumlah || b.poin - a.poin)
                const maxCount = ranked[0]?.jumlah || 1
                const totalPoin = pelanggaranList.reduce((s: number, p: any) => s + (p.poin || 0), 0)
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" /> Statistika Pelanggaran
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-lg font-bold">{pelanggaranList.length}</p>
                          <p className="text-[10px] text-muted-foreground">Total Pelanggaran</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-lg font-bold">{ranked.length}</p>
                          <p className="text-[10px] text-muted-foreground">Siswa Melanggar</p>
                        </div>
                        <div className="rounded-lg bg-muted p-3 text-center">
                          <p className="text-lg font-bold">{totalPoin}</p>
                          <p className="text-[10px] text-muted-foreground">Total Poin</p>
                        </div>
                      </div>
                      {ranked.length > 0 && (
                        <div className="space-y-2">
                          {ranked.map((s: any, i: number) => (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="truncate">{i + 1}. {s.nama}</span>
                                <span className="text-muted-foreground shrink-0">{s.jumlah}x {s.poin > 0 ? `· ${s.poin} poin` : ""}</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${i === 0 ? "bg-red-500" : "bg-primary/60"}`}
                                  style={{ width: `${(s.jumlah / maxCount) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}

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
                            <div className="flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPelanggaran(p)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePelanggaran(p.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {p.fotoUrl && (
                            <a href={p.fotoUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={p.fotoUrl}
                                alt="Dokumen pelanggaran"
                                className="h-28 w-full rounded-md border object-cover transition hover:opacity-80"
                              />
                            </a>
                          )}
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
              {rekapLoading && !rekapAbsensi ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : rekapAbsensi ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total <span className="font-semibold text-foreground">{rekapAbsensi.totalPertemuan}</span> pertemuan
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a href="/guru/absensi">
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Input Absensi Harian
                      </a>
                    </Button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Rata-rata Hadir</p>
                        <p className="text-lg font-bold text-green-600">
                          {rekapAbsensi.totalPertemuan > 0
                            ? Math.round(rekapAbsensi.siswa.reduce((s: any, a: any) => s + a.persentase, 0) / rekapAbsensi.siswa.length)
                            : 0}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Sakit</p>
                        <p className="text-lg font-bold text-blue-600">
                          {rekapAbsensi.siswa.reduce((s: any, a: any) => s + a.totalSakit, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-200 dark:border-amber-800">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Izin</p>
                        <p className="text-lg font-bold text-amber-600">
                          {rekapAbsensi.siswa.reduce((s: any, a: any) => s + a.totalIzin, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200 dark:border-red-800">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Alpa</p>
                        <p className="text-lg font-bold text-red-600">
                          {rekapAbsensi.siswa.reduce((s: any, a: any) => s + a.totalAlpa + a.totalTidakHadir, 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-purple-200 dark:border-purple-800">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">Siswa &lt; 75%</p>
                        <p className="text-lg font-bold text-purple-600">
                          {rekapAbsensi.siswa.filter((s: any) => s.persentase < 75).length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Per-student Table */}
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">No</th>
                            <th className="text-left p-3 font-medium">Nama</th>
                            <th className="text-center p-3 font-medium">Hadir</th>
                            <th className="text-center p-3 font-medium">Sakit</th>
                            <th className="text-center p-3 font-medium">Izin</th>
                            <th className="text-center p-3 font-medium">Alpa</th>
                            <th className="text-center p-3 font-medium">Kehadiran</th>
                            <th className="text-center p-3 font-medium w-20">Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rekapAbsensi.siswa.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-muted-foreground">
                                Belum ada data absensi
                              </td>
                            </tr>
                          ) : (
                            rekapAbsensi.siswa.map((s: any, i: number) => {
                              const color =
                                s.persentase >= 90 ? "text-green-600" :
                                s.persentase >= 75 ? "text-amber-600" :
                                "text-red-600"
                              return (
                                <tr key={s.id} className="border-t hover:bg-muted/30">
                                  <td className="p-3 text-muted-foreground text-xs">{i + 1}</td>
                                  <td className="p-3 font-medium">{s.nama}</td>
                                  <td className="p-3 text-center text-green-600 font-medium">{s.totalHadir}</td>
                                  <td className="p-3 text-center text-blue-600">{s.totalSakit}</td>
                                  <td className="p-3 text-center text-amber-600">{s.totalIzin}</td>
                                  <td className="p-3 text-center text-red-600">{s.totalAlpa + s.totalTidakHadir}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            s.persentase >= 90 ? "bg-green-500" :
                                            s.persentase >= 75 ? "bg-amber-500" :
                                            "bg-red-500"
                                          }`}
                                          style={{ width: `${s.persentase}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-semibold w-10 text-right ${color}`}>
                                        {s.persentase}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={async () => {
                                        try {
                                          const d = await getDetailAbsensiSiswa(selectedKelas.id, s.id)
                                          setDetailAbsensi(d as any)
                                          setDetailAbsensiOpen(true)
                                        } catch {
                                          toast.error("Gagal memuat detail absensi")
                                        }
                                      }}
                                    >
                                      Detail
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  </CardContent>
                </Card>
              )}

              {/* Detail Dialog */}
              <Dialog open={detailAbsensiOpen} onOpenChange={setDetailAbsensiOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      Detail Absensi: {detailAbsensi?.siswa?.nama}
                    </DialogTitle>
                  </DialogHeader>
                  {detailAbsensi && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-2">
                          <p className="text-green-700 font-bold text-sm">
                            {detailAbsensi.detail.filter((d: any) => d.status === "HADIR").length}
                          </p>
                          <p className="text-green-600">Hadir</p>
                        </div>
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
                          <p className="text-blue-700 font-bold text-sm">
                            {detailAbsensi.detail.filter((d: any) => d.status === "SAKIT").length}
                          </p>
                          <p className="text-blue-600">Sakit</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2">
                          <p className="text-amber-700 font-bold text-sm">
                            {detailAbsensi.detail.filter((d: any) => d.status === "IZIN").length}
                          </p>
                          <p className="text-amber-600">Izin</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-2">
                          <p className="text-red-700 font-bold text-sm">
                            {detailAbsensi.detail.filter((d: any) => d.status === "ALPA" || d.status === "TIDAK_HADIR").length}
                          </p>
                          <p className="text-red-600">Alpa</p>
                        </div>
                        <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-2">
                          <p className="text-purple-700 font-bold text-sm">{detailAbsensi.detail.length}</p>
                          <p className="text-purple-600">Total</p>
                        </div>
                      </div>

                      {detailAbsensi.detail.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Belum ada data absensi</p>
                      ) : (
                        <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg">
                          {detailAbsensi.detail.map((d: any, i: number) => {
                            const statusColor: Record<string, string> = {
                              HADIR: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                              SAKIT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                              IZIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              ALPA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              TIDAK_HADIR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                            }
                            return (
                              <div key={i} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 text-sm">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground w-24 shrink-0">
                                    {new Date(d.tanggal).toLocaleDateString("id-ID")}
                                  </span>
                                  <span className="text-xs">{d.mataPelajaran}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[d.status] || ""}`}>
                                    {d.status === "TIDAK_HADIR" ? "Alpa" : d.status}
                                  </span>
                                  {d.keterangan && (
                                    <span className="text-[10px] text-muted-foreground italic">{d.keterangan}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </>
      )}
    </motion.div>
  )
}
