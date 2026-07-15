"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  BookOpen,
  FileText,
  BarChart3,
  Users,
  Target,
  GraduationCap,
  ArrowRight,
  Sparkles,
} from "lucide-react"

const features = [
  {
    icon: FileText,
    title: "Bank Soal Digital",
    description: "Kumpulan soal terstruktur dengan berbagai tipe: PG, Essay, True/False, dan Matching.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: GraduationCap,
    title: "Ujian Online",
    description: "Ujian dan latihan interaktif real-time dengan pengawasan otomatis.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Monitoring Nilai",
    description: "Pantau perkembangan nilai siswa secara detail dan akurat.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Users,
    title: "Manajemen Kelas",
    description: "Kelola kelas, mata pelajaran, dan jadwal dengan mudah.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Target,
    title: "Analitik & Laporan",
    description: "Visualisasi data pembelajaran untuk evaluasi yang lebih baik.",
    color: "from-violet-500 to-indigo-500",
  },
  {
    icon: BookOpen,
    title: "Belajar Mandiri",
    description: "Akses materi dan latihan kapan saja, di mana saja.",
    color: "from-rose-500 to-pink-500",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (status === "authenticated" && session?.user && !checkedRef.current) {
      checkedRef.current = true
      fetch("/api/auth/role")
        .then((res) => res.json())
        .then((data) => {
          if (data.profileComplete) {
            const role = data.role
            if (role === "ADMIN") router.push("/admin")
            else if (role === "GURU") router.push("/guru")
            else if (role === "SISWA") router.push("/siswa")
            else router.push("/register")
          } else {
            router.push("/register")
          }
        })
        .catch(() => router.push("/register"))
    }
  }, [session, status, router])

  if (status !== "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">E-Learning QU</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Masuk</Button>
            </Link>
            <Link href="/login">
              <Button>Daftar</Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950" />
          <div className="absolute right-0 top-0 -z-10 h-[500px] w-[500px] translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/30 to-purple-200/30 blur-3xl dark:from-blue-800/20 dark:to-purple-800/20" />
          <div className="absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] -translate-x-1/3 rounded-full bg-gradient-to-tr from-purple-200/20 to-pink-200/20 blur-3xl dark:from-purple-800/10 dark:to-pink-800/10" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div
              variants={itemVariants}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-4 w-4" />
              Platform E-Learning Modern
            </motion.div>
            <motion.h1
              variants={itemVariants}
              className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              Belajar Jadi Lebih{" "}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Mudah & Menyenangkan
              </span>
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl"
            >
              Platform pembelajaran digital modern yang menghubungkan Guru dan Siswa
              dalam ekosistem belajar yang interaktif, terstruktur, dan menyenangkan.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="mt-10 flex items-center justify-center gap-4"
            >
              <Link href="/login">
                <Button size="lg" className="gap-2 text-base">
                  Mulai Belajar
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="text-base">
                  Pelajari Lebih Lanjut
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Fitur Unggulan
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Semua yang Anda butuhkan untuk pengalaman belajar mengajar yang lebih baik.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={containerVariants}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.div key={feature.title} variants={itemVariants}>
                  <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                    />
                    <CardContent className="p-6">
                      <div
                        className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${feature.color} p-3 text-white shadow-sm`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-purple-600 px-8 py-16 text-center text-white sm:px-16 sm:py-24"
          >
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Siap Memulai Perjalanan Belajar?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
                Bergabunglah dengan ribuan Guru dan Siswa yang sudah menggunakan
                E-Learning QU untuk pengalaman belajar yang lebih baik.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 bg-white text-primary hover:bg-white/90 text-base"
                  >
                    Mulai Sekarang
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} E-Learning QU. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
