import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const metadata: Metadata = {
  title: {
    template: "%s | E-Learning",
    default: "Dashboard | E-Learning",
  },
  description: "Dashboard Aplikasi E-Learning",
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
