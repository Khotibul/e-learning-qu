"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BiodataInput } from "@/lib/biodata"

/** Nilai form biodata keluarga — semua string agar cocok dengan input HTML. */
export type BiodataForm = {
  jenisKelamin: string
  agama: string
  tempatLahir: string
  tanggalLahir: string
  anakKe: string
  statusKeluarga: string
  namaAyah: string
  namaIbu: string
  pekerjaanAyah: string
  pekerjaanIbu: string
  asalSekolah: string
  noTelpWali: string
  alamat: string
}

export const BIODATA_FORM_KOSONG: BiodataForm = {
  jenisKelamin: "",
  agama: "",
  tempatLahir: "",
  tanggalLahir: "",
  anakKe: "",
  statusKeluarga: "",
  namaAyah: "",
  namaIbu: "",
  pekerjaanAyah: "",
  pekerjaanIbu: "",
  asalSekolah: "",
  noTelpWali: "",
  alamat: "",
}

export const AGAMA_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]

type BiodataRecord = Partial<{
  jenisKelamin: string | null
  agama: string | null
  tempatLahir: string | null
  tanggalLahir: string | Date | null
  anakKe: number | null
  statusKeluarga: string | null
  namaAyah: string | null
  namaIbu: string | null
  pekerjaanAyah: string | null
  pekerjaanIbu: string | null
  asalSekolah: string | null
  noTelpWali: string | null
  alamat: string | null
}>

/** Biodata dari server (Date ISO/Date) → nilai form. */
export function biodataKeForm(b?: BiodataRecord | null): BiodataForm {
  if (!b) return { ...BIODATA_FORM_KOSONG }
  const rawTgl = b.tanggalLahir
  const tgl = rawTgl
    ? (typeof rawTgl === "string" ? rawTgl : rawTgl.toISOString()).slice(0, 10)
    : ""
  return {
    jenisKelamin: b.jenisKelamin ?? "",
    agama: b.agama ?? "",
    tempatLahir: b.tempatLahir ?? "",
    tanggalLahir: tgl,
    anakKe: b.anakKe != null ? String(b.anakKe) : "",
    statusKeluarga: b.statusKeluarga ?? "",
    namaAyah: b.namaAyah ?? "",
    namaIbu: b.namaIbu ?? "",
    pekerjaanAyah: b.pekerjaanAyah ?? "",
    pekerjaanIbu: b.pekerjaanIbu ?? "",
    asalSekolah: b.asalSekolah ?? "",
    noTelpWali: b.noTelpWali ?? "",
    alamat: b.alamat ?? "",
  }
}

/** Nilai form → payload upsertBiodata (string kosong jadi null). */
export function formKeBiodata(f: BiodataForm): BiodataInput {
  return {
    jenisKelamin: (f.jenisKelamin || null) as BiodataInput["jenisKelamin"],
    agama: f.agama || null,
    tempatLahir: f.tempatLahir || null,
    tanggalLahir: f.tanggalLahir || null,
    anakKe: f.anakKe || null,
    statusKeluarga: f.statusKeluarga || null,
    namaAyah: f.namaAyah || null,
    namaIbu: f.namaIbu || null,
    pekerjaanAyah: f.pekerjaanAyah || null,
    pekerjaanIbu: f.pekerjaanIbu || null,
    asalSekolah: f.asalSekolah || null,
    noTelpWali: f.noTelpWali || null,
    alamat: f.alamat || null,
  }
}

const JENIS_KELAMIN_LABEL: Record<string, string> = {
  LAKI_LAKI: "Laki-laki",
  PEREMPUAN: "Perempuan",
}

function formatTanggal(v?: string | Date | null): string {
  if (!v) return "-"
  const d = typeof v === "string" ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
}

/** Tampilan baca-saja biodata untuk dialog detail Admin. */
export function BiodataRingkas({ biodata }: { biodata?: BiodataRecord | null }) {
  const b = biodata
  const item = (label: string, value: string | number | null | undefined) => (
    <div key={label} className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value === null || value === undefined || value === "" ? "-" : value}</dd>
    </div>
  )

  if (!b) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Data diri belum diisi. Lengkapi lewat tombol Edit.
      </p>
    )
  }

  return (
    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {item("Jenis Kelamin", b.jenisKelamin ? JENIS_KELAMIN_LABEL[b.jenisKelamin] || b.jenisKelamin : null)}
      {item("Agama", b.agama)}
      {item("Tempat Lahir", b.tempatLahir)}
      {item("Tanggal Lahir", formatTanggal(b.tanggalLahir))}
      {item("Anak Ke", b.anakKe ?? null)}
      {item("Status dalam Keluarga", b.statusKeluarga)}
      {item("Nama Ayah", b.namaAyah)}
      {item("Nama Ibu", b.namaIbu)}
      {item("Pekerjaan Ayah", b.pekerjaanAyah)}
      {item("Pekerjaan Ibu", b.pekerjaanIbu)}
      {item("Asal Sekolah", b.asalSekolah)}
      {item("No. Telepon Wali", b.noTelpWali)}
      <div className="space-y-0.5 sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Alamat (biodata)</dt>
        <dd className="text-sm">{b.alamat || "-"}</dd>
      </div>
    </dl>
  )
}

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"

type Props = {
  value: BiodataForm
  onChange: (next: BiodataForm) => void
  /** Awalan id agar unik bila dua form tampil bersamaan. */
  idPrefix?: string
  /** Tampilkan input alamat di sini (untuk entitas yang belum punya kolom alamat). */
  tampilkanAlamat?: boolean
}

/** Field biodata pribadi + keluarga (jenis kelamin s.d. no. telepon wali). */
export function BiodataFields({ value, onChange, idPrefix = "bio", tampilkanAlamat = false }: Props) {
  const set = (k: keyof BiodataForm, v: string) => onChange({ ...value, [k]: v })
  const id = (k: string) => `${idPrefix}-${k}`

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={id("jenisKelamin")}>Jenis Kelamin</Label>
        <select
          id={id("jenisKelamin")}
          className={selectClass}
          value={value.jenisKelamin}
          onChange={(e) => set("jenisKelamin", e.target.value)}
        >
          <option value="">Belum diisi</option>
          <option value="LAKI_LAKI">Laki-laki</option>
          <option value="PEREMPUAN">Perempuan</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("agama")}>Agama</Label>
        <select
          id={id("agama")}
          className={selectClass}
          value={value.agama}
          onChange={(e) => set("agama", e.target.value)}
        >
          <option value="">Belum diisi</option>
          {AGAMA_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("tempatLahir")}>Tempat Lahir</Label>
        <Input
          id={id("tempatLahir")}
          value={value.tempatLahir}
          onChange={(e) => set("tempatLahir", e.target.value)}
          placeholder="Kota/kabupaten lahir"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("tanggalLahir")}>Tanggal Lahir</Label>
        <Input
          id={id("tanggalLahir")}
          type="date"
          value={value.tanggalLahir}
          onChange={(e) => set("tanggalLahir", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("anakKe")}>Anak Ke</Label>
        <Input
          id={id("anakKe")}
          type="number"
          min={1}
          value={value.anakKe}
          onChange={(e) => set("anakKe", e.target.value)}
          placeholder="Misal: 2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("statusKeluarga")}>Status dalam Keluarga</Label>
        <Input
          id={id("statusKeluarga")}
          value={value.statusKeluarga}
          onChange={(e) => set("statusKeluarga", e.target.value)}
          placeholder="Anak kandung / angkat / yatim piatu"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("namaAyah")}>Nama Ayah</Label>
        <Input
          id={id("namaAyah")}
          value={value.namaAyah}
          onChange={(e) => set("namaAyah", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("namaIbu")}>Nama Ibu</Label>
        <Input
          id={id("namaIbu")}
          value={value.namaIbu}
          onChange={(e) => set("namaIbu", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("pekerjaanAyah")}>Pekerjaan Ayah</Label>
        <Input
          id={id("pekerjaanAyah")}
          value={value.pekerjaanAyah}
          onChange={(e) => set("pekerjaanAyah", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("pekerjaanIbu")}>Pekerjaan Ibu</Label>
        <Input
          id={id("pekerjaanIbu")}
          value={value.pekerjaanIbu}
          onChange={(e) => set("pekerjaanIbu", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("asalSekolah")}>Asal Sekolah</Label>
        <Input
          id={id("asalSekolah")}
          value={value.asalSekolah}
          onChange={(e) => set("asalSekolah", e.target.value)}
          placeholder="Sekolah asal / sebelumnya"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("noTelpWali")}>No. Telepon Wali</Label>
        <Input
          id={id("noTelpWali")}
          value={value.noTelpWali}
          onChange={(e) => set("noTelpWali", e.target.value)}
          placeholder="08xxxxxxxxxx"
        />
      </div>

      {tampilkanAlamat && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id("alamat")}>Alamat</Label>
          <Input
            id={id("alamat")}
            value={value.alamat}
            onChange={(e) => set("alamat", e.target.value)}
            placeholder="Alamat lengkap"
          />
        </div>
      )}
    </div>
  )
}
