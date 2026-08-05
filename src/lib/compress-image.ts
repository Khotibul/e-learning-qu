export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  if (file.size <= 800 * 1024) return file

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Gagal membaca file"))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Gambar tidak valid"))
    image.src = dataUrl
  })

  const MAX_DIM = 1280
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas tidak didukung")
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Kompresi gambar gagal"))), "image/jpeg", 0.82)
  })
  return new File([blob], "foto.jpg", { type: "image/jpeg" })
}
