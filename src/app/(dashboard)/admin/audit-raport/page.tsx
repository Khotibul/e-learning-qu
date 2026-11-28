import { Suspense } from "react"
import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditRaportPanel } from "./_components/audit-raport-panel"
import { jalankanAuditRaport } from "./actions"

export const metadata: Metadata = {
  title: "Audit Raport | Admin",
}

function SkeletonPanel() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

async function Content() {
  const hasil = await jalankanAuditRaport()
  return <AuditRaportPanel awal={hasil} />
}

export default function Page() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6" /> Audit Raport
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Menghitung ulang nilai akhir seluruh siswa dari data nilai sumber, lalu membandingkannya dengan isi raport
          (nilai, predikat, rata-rata, peringkat, dan kelengkapan baris mapel). Hanya membaca data.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pemeriksaan yang sama berjalan otomatis setiap hari melalui cron{" "}
          <code className="rounded bg-muted px-1 py-0.5">/api/cron/audit-raport</code>.
        </p>
      </div>
      <Suspense fallback={<SkeletonPanel />}>
        <Content />
      </Suspense>
    </div>
  )
}
