function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash
}

function seededRandom(seed: string): () => number {
  return mulberry32(hashString(seed))
}

export function randomizeQuestions<T>(items: T[], seed: string): T[] {
  const arr = [...items]
  const rng = seededRandom(seed)

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }

  return arr
}

export function randomizeAnswers<T>(
  options: T[],
  seed: string,
  questionIndex: number
): T[] {
  const arr = [...options]
  const rng = seededRandom(seed + `_q${questionIndex}`)

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }

  return arr
}

export async function getStudentSoalOrder(
  ujianId: string,
  siswaId: string
): Promise<string[]> {
  const ujian = await import("@/lib/prisma").then((m) =>
    m.prisma.ujian.findUnique({
      where: { id: ujianId },
      select: {
        randomSoal: true,
        randomJawaban: true,
      },
    })
  )

  if (!ujian) throw new Error("Ujian not found")

  const ujianSoal = await import("@/lib/prisma").then((m) =>
    m.prisma.ujianSoal.findMany({
      where: { ujianId },
      orderBy: { nomor: "asc" },
      select: { soalId: true, nomor: true },
    })
  )

  let soalIds = ujianSoal.map((s) => s.soalId)

  if (ujian.randomSoal) {
    soalIds = randomizeQuestions(soalIds, ujianId + siswaId)
  }

  return soalIds
}
