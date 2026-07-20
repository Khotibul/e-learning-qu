"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { roleSelectionSchema } from "@/validators/auth"
import { Sparkles, GraduationCap, Users } from "lucide-react"

const registerSchema = roleSelectionSchema.superRefine((data, ctx) => {
  if (data.role === "GURU" && !data.nip) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "NIP wajib diisi untuk Guru",
      path: ["nip"],
    })
  }
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [profileComplete, setProfileComplete] = useState(false)
  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([])
  const checkedRef = useRef(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "SISWA",
      nama: "",
      nip: "",
      nis: "",
      nisn: "",
      kelasId: "",
      noTelp: "",
      alamat: "",
    },
  })

  const selectedRole = watch("role")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.name) {
      setValue("nama", session.user.name)
    }
    fetch("/api/kelas")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setKelasList(data) })
      .catch(() => {})
  }, [session, setValue])

  useEffect(() => {
    if (status === "authenticated" && session?.user && !checkedRef.current) {
      checkedRef.current = true
      fetch("/api/auth/role")
        .then((res) => res.json())
        .then((data) => {
          if (data.profileComplete) {
            setProfileComplete(true)
            const role = data.role
            if (role === "ADMIN") router.push("/admin")
            else if (role === "GURU") router.push("/guru")
            else router.push("/siswa")
          }
        })
        .catch(() => {})
        .finally(() => setCheckingProfile(false))
    }
  }, [status, session, router])

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || "Terjadi kesalahan")
        return
      }

      toast.success("Profil berhasil dibuat!")

      if (data.role === "GURU") router.push("/guru")
      else router.push("/siswa")
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || checkingProfile || profileComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full border-none bg-background/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center space-y-4 pb-6 pt-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Lengkapi Profil</CardTitle>
            <CardDescription className="text-base">
              Pilih role dan lengkapi data diri Anda
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label>Pilih Role</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setValue("role", "SISWA", { shouldValidate: true })
                    trigger("role")
                  }}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                    selectedRole === "SISWA"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      selectedRole === "SISWA"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Siswa</p>
                    <p className="text-xs text-muted-foreground">Untuk pelajar</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setValue("role", "GURU", { shouldValidate: true })
                    trigger("role")
                  }}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                    selectedRole === "GURU"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      selectedRole === "GURU"
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Guru</p>
                    <p className="text-xs text-muted-foreground">Untuk pengajar</p>
                  </div>
                </button>
              </div>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input
                id="nama"
                placeholder="Masukkan nama lengkap"
                {...register("nama")}
                className={errors.nama ? "border-destructive" : ""}
              />
              {errors.nama && (
                <p className="text-sm text-destructive">{errors.nama.message}</p>
              )}
            </div>

            <AnimatePresence mode="wait">
              {selectedRole === "GURU" && (
                <motion.div
                  key="guru-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-2">
                    <Label htmlFor="nip">NIP</Label>
                    <Input
                      id="nip"
                      placeholder="Masukkan NIP"
                      {...register("nip")}
                      className={errors.nip ? "border-destructive" : ""}
                    />
                    {errors.nip && (
                      <p className="text-sm text-destructive">{errors.nip.message}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {selectedRole === "SISWA" && (
                <motion.div
                  key="siswa-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-2">
                    <Label htmlFor="kelasId">Kelas</Label>
                    <Select
                      value={watch("kelasId")}
                      onValueChange={(v) => setValue("kelasId", v, { shouldValidate: true })}
                    >
                      <SelectTrigger id="kelasId">
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {kelasList.map((k) => (
                          <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nis">NIS (opsional)</Label>
                    <Input
                      id="nis"
                      placeholder="Masukkan NIS"
                      {...register("nis")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nisn">NISN (opsional)</Label>
                    <Input
                      id="nisn"
                      placeholder="Masukkan NISN"
                      {...register("nisn")}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label htmlFor="noTelp">No. Telepon (opsional)</Label>
              <Input
                id="noTelp"
                placeholder="Masukkan nomor telepon"
                {...register("noTelp")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alamat">Alamat (opsional)</Label>
              <Input
                id="alamat"
                placeholder="Masukkan alamat"
                {...register("alamat")}
              />
            </div>

            <Button type="submit" className="w-full gap-2" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Profil"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
