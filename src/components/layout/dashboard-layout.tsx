"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"
import type { Role } from "@/types"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession()
  const role = ((session?.user as any)?.role || "SISWA") as Role

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
