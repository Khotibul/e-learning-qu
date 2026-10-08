"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type Notif = {
  id: string
  judul: string
  pesan: string
  tipe: string
  isRead: boolean
  link: string | null
  status: string
  createdAt: string
}

/** Notification Center — polling in-app real-time (60 detik). */
export function NotificationCenter() {
  const [rows, setRows] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const reqRef = useRef(0)

  const muat = useCallback(async () => {
    const id = ++reqRef.current
    try {
      const res = await fetch("/api/notifikasi?take=30", { cache: "no-store" })
      if (!res.ok || id !== reqRef.current) return
      const data = await res.json()
      if (id !== reqRef.current) return
      setRows(data.rows ?? [])
      setUnread(data.unread ?? 0)
    } catch {
      /* diam — coba lagi pada siklus berikutnya */
    }
  }, [])

  useEffect(() => {
    muat()
    const t = setInterval(muat, 60000)
    const fokus = () => muat()
    window.addEventListener("focus", fokus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", fokus)
    }
  }, [muat])

  const tandai = async (ids?: string[]) => {
    try {
      await fetch("/api/notifikasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      setRows((r) => r.map((n) => (!ids || ids.includes(n.id) ? { ...n, isRead: true } : n)))
      setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0))
    } catch {
      /* abaikan */
    }
  }

  const buka = async (n: Notif) => {
    if (!n.isRead) await tandai([n.id])
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) muat() }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifikasi{unread > 0 ? ` (${unread} baru)` : ""}</span>
          {unread > 0 && (
            <button onClick={() => tandai()} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Tandai semua dibaca
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <span className="text-sm">Belum ada notifikasi</span>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link || "#"}
                  onClick={() => buka(n)}
                  className={cn(
                    "block px-4 py-3 transition-colors hover:bg-muted/50",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className={cn("min-w-0 flex-1", n.isRead && "pl-4")}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{n.judul}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.pesan}</p>
                      {n.status === "GAGAL" && (
                        <p className="mt-0.5 text-[10px] font-medium text-destructive">Gagal dikirim — lihat log</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
