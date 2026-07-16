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
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold">E-Learning QU</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="sm:h-10 sm:px-4">Masuk</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="sm:h-10 sm:px-4">Daftar</Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      <section className="relative pt-28 pb-16 sm:pt-40 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950" />
          <div className="absolute right-0 top-0 -z-10 h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/30 to-purple-200/30 blur-3xl dark:from-blue-800/20 dark:to-purple-800/20" />
          <div className="absolute bottom-0 left-0 -z-10 h-[250px] w-[250px] sm:h-[400px] sm:w-[400px] -translate-x-1/3 rounded-full bg-gradient-to-tr from-purple-200/20 to-pink-200/20 blur-3xl dark:from-purple-800/10 dark:to-pink-800/10" />
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
              className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight"
            >
              Belajar Jadi Lebih{" "}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Mudah & Menyenangkan
              </span>
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl leading-7 sm:leading-8 text-muted-foreground px-2 sm:px-0"
            >
              Platform pembelajaran digital modern yang menghubungkan Guru dan Siswa
              dalam ekosistem belajar yang interaktif, terstruktur, dan menyenangkan.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
            >
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="gap-2 text-base w-full sm:w-auto">
                  Mulai Belajar
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="#features" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="text-base w-full sm:w-auto">
                  Pelajari Lebih Lanjut
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Fitur Unggulan
            </h2>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground px-4 sm:px-0">
              Semua yang Anda butuhkan untuk pengalaman belajar mengajar yang lebih baik.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={containerVariants}
            className="mt-10 sm:mt-16 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.div key={feature.title} variants={itemVariants}>
                  <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                    />
                    <CardContent className="p-5 sm:p-6">
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

      <section className="py-16 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-purple-600 px-6 py-12 text-center text-white sm:px-16 sm:py-24"
          >
            <div className="relative">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Siap Memulai Perjalanan Belajar?
              </h2>
              <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-lg text-white/80">
                Bergabunglah dengan ribuan Guru dan Siswa yang sudah menggunakan
                E-Learning QU untuk pengalaman belajar yang lebih baik.
              </p>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link href="/login" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 bg-white text-primary hover:bg-white/90 text-base w-full sm:w-auto"
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

      <footer className="border-t border-border py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs sm:text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} E-Learning QU. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
