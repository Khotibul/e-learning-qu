"use client"

import { ClipboardList, ShieldCheck } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PanelNilai } from "./panel-nilai"
import { PanelRaport } from "./panel-raport"
import type { RaportRefs } from "./types"

export function GuruRaportWorkspace({ refs }: { refs: RaportRefs }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 sm:w-7 sm:h-7 text-primary" /> Penilaian & Raport
        </h1>
        <p className="text-muted-foreground mt-1">
          Input nilai formatif, sumatif, proyek, dan praktik. Wali kelas menyusun serta menerbitkan raport kelasnya.
        </p>
      </div>

      <Tabs defaultValue="nilai" className="space-y-4">
        <TabsList>
          <TabsTrigger value="nilai"><ClipboardList className="h-4 w-4 mr-1.5" /> Input Nilai</TabsTrigger>
          <TabsTrigger value="raport"><ShieldCheck className="h-4 w-4 mr-1.5" /> Raport Kelas</TabsTrigger>
        </TabsList>
        <TabsContent value="nilai"><PanelNilai refs={refs} /></TabsContent>
        <TabsContent value="raport"><PanelRaport refs={refs} mode="guru" /></TabsContent>
      </Tabs>
    </div>
  )
}
