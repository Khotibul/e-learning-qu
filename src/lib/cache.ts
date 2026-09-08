import { unstable_cache } from "next/cache"

// Cache khusus Singapura: simpan hasil query berat 60 detik per user
// Menu → menu tidak hit DB lagi, hanya hit cache di edge (Vercel sin1 / PandaStack ap-southeast-1)
// Invalidate manual via revalidateTag("dashboard") atau tunggu 60s

export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keyPrefix: string[],
  revalidate = 60
) {
  return unstable_cache(fn as never, keyPrefix, {
    revalidate,
    tags: keyPrefix,
  }) as T
}

// Helper untuk cache per-user (guruId/siswaId sebagai bagian key)
export function cachedByUser<T extends (id: string, ...rest: never[]) => Promise<unknown>>(
  fn: T,
  keyPrefix: string,
  revalidate = 60
) {
  return ((id: string, ...rest: never[]) =>
    unstable_cache(() => fn(id, ...rest), [keyPrefix, id, ...rest.map(String)], {
      revalidate,
      tags: [keyPrefix, `${keyPrefix}:${id}`],
    })()) as T
}
