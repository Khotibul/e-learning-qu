"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/utils"
import { Megaphone } from "lucide-react"

interface PengumumanItem {
  id: string
  judul: string
  isi: string
  createdAt: string
  author: string
}

interface PengumumanListProps {
  items: PengumumanItem[]
}

export function PengumumanList({ items }: PengumumanListProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            Pengumuman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada pengumuman
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Pengumuman Terbaru
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id}>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm leading-tight">{item.judul}</h4>
              <p className="text-xs text-muted-foreground">
                {item.author} &middot; {formatDate(item.createdAt)}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">{item.isi}</p>
            </div>
            {index < items.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
