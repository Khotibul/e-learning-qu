import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/lib/providers"
import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"

const inter = Inter({ subsets: ["latin"] })

const getFaviconUrl = unstable_cache(
  async () => {
    try {
      const cfg = await prisma.siteConfig.findFirst({ select: { faviconUrl: true } })
      return cfg?.faviconUrl || null
    } catch {
      return null
    }
  },
  ["site-favicon"],
  { revalidate: 300, tags: ["site-config"] }
)

export async function generateMetadata(): Promise<Metadata> {
  const favicon = await getFaviconUrl().catch(() => null)
  return {
    title: "E-Learning QU",
    description: "Platform E-Learning modern untuk Guru dan Siswa",
    keywords: ["e-learning", "pendidikan", "sekolah", "belajar", "online"],
    icons: { icon: favicon || "/favicon.svg" },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
