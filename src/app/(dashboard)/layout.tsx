import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: {
    template: "%s | E-Learning",
    default: "Dashboard | E-Learning",
  },
  description: "Dashboard Aplikasi E-Learning",
}

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return <DashboardLayout>{children}</DashboardLayout>
}
