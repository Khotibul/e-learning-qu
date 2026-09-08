import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  logging: {
    fetches: { fullUrl: true },
  },
  // Preferensi region Singapura untuk latency DB terendah
  // Vercel: sin1 (Singapore), PandaStack: ap-southeast-1
  // Next.js 15: experimental atau config deployment; untuk Vercel set via vercel.json
}

export default nextConfig
