"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TombolCetak() {
  return (
    <div className="print:hidden flex justify-end gap-2 mb-4">
      <Button variant="outline" onClick={() => window.close()}>Tutup</Button>
      <Button onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-1.5" /> Cetak / Simpan PDF
      </Button>
    </div>
  )
}
