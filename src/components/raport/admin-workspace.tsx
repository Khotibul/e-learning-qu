"use client"

import { Award, ClipboardList, Settings2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PanelRaport } from "./panel-raport"
import { PanelNilai } from "./panel-nilai"
import { PengaturanForm } from "./pengaturan-form"
import type { RaportRefs } from "./types"

export function AdminRaportWorkspace({ refs }: { refs: RaportRefs }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Penilaian & Raport
        </h1>
        <p className="text-muted-foreground mt-1">
          Pantau kelengkapan nilai, terbitkan atau tarik raport, dan atur bobot penilaian Kurikulum Merdeka.
        </p>
      </div>

      <Tabs defaultValue="raport" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="raport"><Award className="h-4 w-4 mr-1.5" /> Raport & Terbit</TabsTrigger>
          <TabsTrigger value="nilai"><ClipboardList className="h-4 w-4 mr-1.5" /> Komponen Nilai</TabsTrigger>
          <TabsTrigger value="pengaturan"><Settings2 className="h-4 w-4 mr-1.5" /> Pengaturan</TabsTrigger>
        </TabsList>
        <TabsContent value="raport"><PanelRaport refs={refs} mode="admin" /></TabsContent>
        <TabsContent value="nilai"><PanelNilai refs={refs} /></TabsContent>
        <TabsContent value="pengaturan"><PengaturanForm refs={refs} /></TabsContent>
      </Tabs>
    </div>
  )
}
