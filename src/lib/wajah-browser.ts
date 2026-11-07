"use client"

import { rataRataDeskriptor } from "@/lib/wajah-matematika"

// ─── MESIN DETEKSI WAJAH (BROWSER / WEBVIEW) ───────────────────────
// face-api (tfjs) dimuat dari /face/face-api.esm.js + model di /face/models,
// jadi tidak ada CDN dan tetap jalan saat perangkat offline setelah cache.
// Deteksi/descriptor dihitung DI PERANGKAT; server hanya mencocokkan angka.

const BUNDLE = "/face/face-api.esm.js"
const MODEL_URI = "/face/models"

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    faceapi?: any
  }
}

let mesin: Promise<any> | null = null

function tungguFaceApi(timeoutMs = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const mulai = Date.now()
    const cek = () => {
      if (window.faceapi) return resolve(window.faceapi)
      if (Date.now() - mulai > timeoutMs) return reject(new Error("Mesin deteksi wajah gagal dimuat"))
      setTimeout(cek, 120)
    }
    cek()
  })
}

/** Muat bundle + model sekali per halaman. */
export function muatMesinWajah(): Promise<any> {
  if (mesin) return mesin
  mesin = (async () => {
    if (!window.faceapi) {
      const ada = document.querySelector<HTMLScriptElement>(`script[data-face-api="1"]`)
      if (!ada) {
        const script = document.createElement("script")
        script.type = "module"
        script.dataset.faceApi = "1"
        script.textContent = `import * as faceapi from "${BUNDLE}"; window.faceapi = faceapi;`
        document.head.appendChild(script)
      }
    }
    const faceapi = await tungguFaceApi()

    if (faceapi.tf?.setBackend) {
      try {
        await faceapi.tf.setBackend("webgl")
        await faceapi.tf.ready()
      } catch {
        try {
          await faceapi.tf.setBackend("cpu")
          await faceapi.tf.ready()
        } catch {
          // biarkan face-api memilih backend sendiri
        }
      }
    }

    if (!faceapi.nets.tinyFaceDetector.isLoaded) await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI)
    if (!faceapi.nets.faceLandmark68Net.isLoaded) await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI)
    if (!faceapi.nets.faceRecognitionNet.isLoaded) await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
    return faceapi
  })().catch((e) => {
    mesin = null
    throw e
  })
  return mesin
}

export type KotakWajah = { x: number; y: number; width: number; height: number }

export type DeteksiWajah = {
  skor: number
  kotak: KotakWajah
  lebarFrame: number
  tinggiFrame: number
  deskriptor: number[] | null
}

type Frame = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

function dimensiFrame(frame: Frame, hasil: any): { lebar: number; tinggi: number } {
  const lebar = "videoWidth" in frame && frame.videoWidth ? frame.videoWidth : frame.width || 0
  const tinggi = "videoHeight" in frame && frame.videoHeight ? frame.videoHeight : frame.height || 0
  const input = hasil?.detection?.box
  return { lebar: lebar || Math.ceil((input?.x ?? 0) + (input?.width ?? 0)), tinggi: tinggi || 0 }
}

function baca(frame: Frame, hasil: any): DeteksiWajah {
  const box = hasil.detection.box
  const d = dimensiFrame(frame, hasil)
  return {
    skor: hasil.detection.score ?? 0,
    kotak: { x: box.x, y: box.y, width: box.width, height: box.height },
    lebarFrame: d.lebar,
    tinggiFrame: d.tinggi,
    deskriptor: hasil.descriptor ? Array.from(hasil.descriptor as Float32Array) : null,
  }
}

/** Deteksi satu wajah (tanpa descriptor) — untuk overlay kamera realtime. */
export async function deteksiWajah(frame: Frame): Promise<DeteksiWajah | null> {
  const faceapi = await muatMesinWajah()
  const opsi = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
  const hasil = await faceapi.detectSingleFace(frame, opsi)
  return hasil ? baca(frame, hasil) : null
}

/** Deteksi wajah + descriptor 128-d (satu sampel). */
export async function deteksiDeskriptor(frame: Frame): Promise<DeteksiWajah | null> {
  const faceapi = await muatMesinWajah()
  const opsi = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
  const hasil = await faceapi.detectSingleFace(frame, opsi).withFaceLandmarks().withFaceDescriptor()
  return hasil ? baca(frame, hasil) : null
}

/** Beberapa sampel descriptor video dirata-rata agar absensi lebih stabil. */
export async function deskriptorRataRataVideo(video: HTMLVideoElement, jumlah = 3, jedaMs = 220): Promise<number[]> {
  const sampel: number[][] = []
  for (let i = 0; i < jumlah; i++) {
    const d = await deteksiDeskriptor(video)
    if (d?.deskriptor) sampel.push(d.deskriptor)
    if (i < jumlah - 1) await new Promise((r) => setTimeout(r, jedaMs))
  }
  if (sampel.length === 0) throw new Error("Wajah tidak terdeteksi — hadapkan wajah ke kamera")
  return rataRataDeskriptor(sampel)
}

/** Descriptor dari file foto (upload admin), tanpa menyimpan file ke server. */
export async function deskriptorDariBerkas(file: File): Promise<{ deskriptor: number[]; skor: number; lebar: number; tinggi: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"))
      el.src = url
    })
    const hasil = await deteksiDeskriptor(img)
    if (!hasil?.deskriptor) throw new Error("Tidak ada wajah terdeteksi pada foto — gunakan foto wajah yang jelas")
    if (hasil.kotak.width < 60 || hasil.kotak.height < 60) {
      throw new Error("Wajah pada foto terlalu kecil — gunakan foto yang lebih dekat")
    }
    return {
      deskriptor: hasil.deskriptor,
      skor: hasil.skor,
      lebar: hasil.lebarFrame || img.naturalWidth,
      tinggi: hasil.tinggiFrame || img.naturalHeight,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Nyalakan kamera depan; video harus sudah ada di DOM. */
export async function bukaKamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Perangkat/browser ini tidak mendukung akses kamera (butuh HTTPS)")
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  return stream
}

export function hentikanKamera(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}

/** Ambil frame video jadi JPEG (bisa dipakai sebagai bukti / pratinjau). */
export async function potretFrame(video: HTMLVideoElement, kualitas = 0.8): Promise<Blob | null> {
  const lebar = video.videoWidth
  const tinggi = video.videoHeight
  if (!lebar || !tinggi) return null
  const canvas = document.createElement("canvas")
  canvas.width = lebar
  canvas.height = tinggi
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, lebar, tinggi)
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", kualitas))
}
