import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (session.user.role !== "ADMIN") {
    redirect(session.user.role === "GURU" ? "/guru" : session.user.role === "SISWA" ? "/siswa" : "/")
  }

  return <>{children}</>
}
