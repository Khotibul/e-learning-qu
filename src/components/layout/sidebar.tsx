"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/constants"
import {
  LayoutDashboard, UserCheck, Users, DoorOpen, BookOpen,
  Calendar, CalendarRange, CalendarClock, Megaphone, Award, BarChart3, Settings,
  Database, FileQuestion, ClipboardList, ClipboardCheck, FileText, Trophy,
  GraduationCap, ShieldCheck, Wallet, Gavel, Bot, X, Target, Shield
} from "lucide-react"
import type { Role } from "@/types"
import { Button } from "@/components/ui/button"

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, UserCheck, Users, DoorOpen, BookOpen,
  Calendar, CalendarRange, CalendarClock, Megaphone, Award, BarChart3, Settings,
  Database, FileQuestion, ClipboardList, ClipboardCheck, FileText, Trophy, GraduationCap, ShieldCheck, Wallet, Gavel, Bot, Target, Shield,
}

interface SidebarProps {
  role: Role
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [siteConfig, setSiteConfig] = useState({
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || "E-Learning QU",
    logoUrl: "",
  })
  const [guruJabatan, setGuruJabatan] = useState<string | null>(null)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SITE_NAME) return
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((d) => { if (d?.siteName) setSiteConfig(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (role !== "GURU") return
    fetch("/api/guru/jabatan")
      .then((r) => r.json())
      .then((d) => setGuruJabatan(d?.jabatan || null))
      .catch(() => {})
  }, [role])

  const items = (NAV_ITEMS[role as keyof typeof NAV_ITEMS] || []).filter(
    (item) => item.href !== "/guru/pelanggaran" || guruJabatan === "BK"
  )

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border/50 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <Link href="/" className="flex items-center gap-2">
            {siteConfig.logoUrl ? (
              <img src={siteConfig.logoUrl} alt={siteConfig.siteName} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="font-bold text-lg">{siteConfig.siteName}</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-64px)]">
          {items.map((item) => {
            const Icon = iconMap[item.icon]
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
