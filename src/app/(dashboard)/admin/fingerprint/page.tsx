import type { Metadata } from "next"
import AdminFingerprint from "./_components/admin-fingerprint"

export const metadata: Metadata = {
  title: "Fingerprint & Absensi Harian | Admin",
}

export default function AdminFingerprintPage() {
  return <AdminFingerprint />
}
