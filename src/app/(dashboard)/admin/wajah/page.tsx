import type { Metadata } from "next"
import AdminWajah from "./_components/admin-wajah"

export const metadata: Metadata = {
  title: "Absensi Wajah | Admin",
}

export default function AdminWajahPage() {
  return <AdminWajah />
}
