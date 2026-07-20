"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  School,
  Users,
  UserCheck,
  LayoutDashboard,
  BarChart3,
  Megaphone,
} from "lucide-react"
import Link from "next/link"

interface Stats {
  totalGuru: number
  totalSiswa: number
  totalSoal: number
  totalUjian: number
  totalKelas: number
  totalMapel: number
  totalNilai: number
}

const statCards = [
  { label: "Total Guru", value: "totalGuru", icon: UserCheck, color: "text-blue-600 bg-blue-100" },
  { label: "Total Murid", value: "totalSiswa", icon: Users, color: "text-green-600 bg-green-100" },
  { label: "Total Soal", value: "totalSoal", icon: FileText, color: "text-purple-600 bg-purple-100" },
  { label: "Total Ujian", value: "totalUjian", icon: ClipboardList, color: "text-orange-600 bg-orange-100" },
  { label: "Total Kelas", value: "totalKelas", icon: School, color: "text-pink-600 bg-pink-100" },
  { label: "Total Mapel", value: "totalMapel", icon: BookOpen, color: "text-cyan-600 bg-cyan-100" },
  { label: "Total Nilai", value: "totalNilai", icon: GraduationCap, color: "text-rose-600 bg-rose-100" },
]

const quickActions = [
  { label: "Kelola Guru", href: "/admin/guru", icon: UserCheck, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Kelola Murid", href: "/admin/murid", icon: Users, color: "bg-green-500 hover:bg-green-600" },
  { label: "Kelola Kelas", href: "/admin/kelas", icon: School, color: "bg-pink-500 hover:bg-pink-600" },
  { label: "Kelola Mapel", href: "/admin/mapel", icon: BookOpen, color: "bg-cyan-500 hover:bg-cyan-600" },
  { label: "Lihat Statistik", href: "/admin/statistik", icon: BarChart3, color: "bg-purple-500 hover:bg-purple-600" },
  { label: "Pengumuman", href: "/admin/pengumuman", icon: Megaphone, color: "bg-orange-500 hover:bg-orange-600" },
]

export function AdminDashboardClient({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Dashboard Admin
        </h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang di panel administrasi E-Learning. Kelola seluruh data aplikasi di sini.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          const value = stats[card.value as keyof Stats]
          return (
            <Card key={card.value}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <div className={`rounded-xl p-2 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">Total keseluruhan</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.href} href={action.href}>
                  <Button className={`text-white gap-2 ${action.color}`}>
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

