"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Save, Loader2, Key, User } from "lucide-react"
import { getSiswaProfile, updateSiswaProfile, updateSiswaPassword } from "../actions"

interface ProfileData {
  id: string
  nama: string
  nis: string | null
  nisn: string | null
  alamat: string | null
  noTelp: string | null
  user: { email: string; name: string; image: string | null }
  kelas: { nama: string } | null
}

export default function SiswaPengaturanPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [nama, setNama] = useState("")
  const [nis, setNis] = useState("")
  const [nisn, setNisn] = useState("")
  const [alamat, setAlamat] = useState("")
  const [noTelp, setNoTelp] = useState("")

  const [passwordLama, setPasswordLama] = useState("")
  const [passwordBaru, setPasswordBaru] = useState("")
  const [passwordKonfirmasi, setPasswordKonfirmasi] = useState("")

  useEffect(() => {
    getSiswaProfile()
      .then((data) => {
        if (!data) return
        setProfile(data as unknown as ProfileData)
        setNama(data.nama)
        setNis(data.nis || "")
        setNisn(data.nisn || "")
        setAlamat(data.alamat || "")
        setNoTelp(data.noTelp || "")
      })
      .catch(() => toast.error("Gagal memuat profil"))
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveProfile() {
    setSaving(true)
    try {
      await updateSiswaProfile({ nama, nis, nisn, alamat, noTelp })
      toast.success("Profil berhasil diperbarui")
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan profil")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!passwordLama || !passwordBaru) {
      toast.error("Semua field password harus diisi")
      return
    }
    if (passwordBaru !== passwordKonfirmasi) {
      toast.error("Password baru tidak cocok")
      return
    }
    if (passwordBaru.length < 6) {
      toast.error("Password minimal 6 karakter")
      return
    }
    setSavingPassword(true)
    try {
      await updateSiswaPassword({ passwordLama, passwordBaru })
      toast.success("Password berhasil diubah")
      setPasswordLama("")
      setPasswordBaru("")
      setPasswordKonfirmasi("")
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengubah password")
    } finally {
      setSavingPassword(false)
    }
  }

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
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola informasi profil dan keamanan akun Anda</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Informasi Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.user?.email || ""} disabled />
            </div>
            {profile?.kelas && (
              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <Input id="kelas" value={profile.kelas.nama} disabled />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nis">NIS</Label>
              <Input id="nis" value={nis} onChange={(e) => setNis(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nisn">NISN</Label>
              <Input id="nisn" value={nisn} onChange={(e) => setNisn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noTelp">No. Telepon</Label>
              <Input id="noTelp" value={noTelp} onChange={(e) => setNoTelp(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="alamat">Alamat</Label>
              <Textarea id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Ubah Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passwordLama">Password Lama</Label>
              <Input id="passwordLama" type="password" value={passwordLama} onChange={(e) => setPasswordLama(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordBaru">Password Baru</Label>
              <Input id="passwordBaru" type="password" value={passwordBaru} onChange={(e) => setPasswordBaru(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordKonfirmasi">Konfirmasi Password Baru</Label>
              <Input id="passwordKonfirmasi" type="password" value={passwordKonfirmasi} onChange={(e) => setPasswordKonfirmasi(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Ubah Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
