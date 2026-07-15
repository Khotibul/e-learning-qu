"use client"

import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BookOpen, ClipboardList, FileText, GraduationCap, School, Users,
  Plus, TestTube,
} from "lucide-react"
import Link from "next/link"
import type { GuruDashboardStats } from "@/types"

const statCards: {
  label: string
  value: keyof GuruDashboardStats
  icon: React.ElementType
  color: string
}[] = [
  { label: "Kelas Diajar", value: "kelasCount", icon: School, color: "text-blue-600 bg-blue-100" },
  { label: "Mata Pelajaran", value: "mapelCount", icon: BookOpen, color: "text-cyan-600 bg-cyan-100" },
  { label: "Total Murid", value: "siswaCount", icon: Users, color: "text-green-600 bg-green-100" },
  { label: "Ujian Aktif", value: "ujianAktif", icon: ClipboardList, color: "text-orange-600 bg-orange-100" },
  { label: "Latihan Aktif", value: "latihanAktif", icon: TestTube, color: "text-purple-600 bg-purple-100" },
  { label: "Total Soal", value: "totalSoal", icon: FileText, color: "text-rose-600 bg-rose-100" },
]

const quickActions = [
  { label: "Buat Soal", href: "/guru/soal", icon: Plus, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Buat Ujian", href: "/guru/ujian", icon: ClipboardList, color: "bg-green-500 hover:bg-green-600" },
  { label: "Bank Soal", href: "/guru/bank-soal", icon: FileText, color: "bg-purple-500 hover:bg-purple-600" },
  { label: "Nilai", href: "/guru/nilai", icon: GraduationCap, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Analitik", href: "/guru/analitik", icon: TestTube, color: "bg-cyan-500 hover:bg-cyan-600" },
]

export function GuruDashboardClient({ stats }: { stats: GuruDashboardStats }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Guru</h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang di dashboard guru. Kelola soal, ujian, dan nilai di sini.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon
          const value = stats[card.value]
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
                <p className="text-xs text-muted-foreground mt-1">
                  {card.label === "Ujian Aktif" || card.label === "Latihan Aktif"
                    ? "Sedang berlangsung"
                    : "Total keseluruhan"}
                </p>
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
