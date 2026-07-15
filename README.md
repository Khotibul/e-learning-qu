# E-Learning QU

Platform E-Learning modern untuk Guru dan Siswa. Dibangun dengan **Next.js 15**, **React 19**, **TypeScript**, **TailwindCSS**, dan **Prisma ORM**.

## Fitur Utama

### 👨‍🏫 Admin
- Dashboard statistik dengan grafik
- Kelola Guru, Murid, Kelas, Mata Pelajaran
- Tahun Ajaran & Semester
- Jadwal Ujian & Pengumuman
- Import/Export Excel & PDF
- Manajemen Nilai

### 👩‍🏫 Guru
- Dashboard personal
- Bank Soal dengan berbagai jenis soal
  - Pilihan Ganda, Essay, True/False, Matching, Isian Singkat
- OCR Soal (upload gambar/PDF, otomatis jadi soal)
- Buat & Kelola Ujian (Manual/Otomatis)
- Penilaian otomatis (PG) & manual (Essay)
- Analitik & Grafik Nilai
- Export Nilai (Excel, PDF, CSV)

### 🎓 Siswa
- Dashboard personal
- Kerjakan Ujian & Latihan
- Timer realtime, fullscreen mode
- Deteksi kecurangan (tab pindah, refresh, copy/paste)
- Auto-save & auto-submit
- Lihat Nilai & Ranking Kelas
- Grafik perkembangan nilai

## Teknologi

| Stack | Teknologi |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, TailwindCSS, Shadcn UI, Framer Motion |
| **Backend** | Next.js Server Actions, Route Handler API, Prisma ORM |
| **Database** | PostgreSQL |
| **Auth** | NextAuth/Auth.js v5, Google OAuth |
| **State** | Zustand |
| **Form** | React Hook Form + Zod |
| **Table** | Tanstack Table |
| **Storage** | Vercel Blob / Cloudinary |
| **Email** | Resend |
| **OCR** | Google Vision / Tesseract |
| **Logging** | Pino |

## Struktur Folder

```
src/
├── app/
│   ├── (auth)/           # Login & Register
│   ├── (dashboard)/      # Admin, Guru, Siswa dashboard
│   │   ├── admin/        # Admin features
│   │   ├── guru/         # Guru features
│   │   └── siswa/        # Siswa features
│   └── api/              # Route handlers
├── components/
│   ├── ui/               # Shadcn UI components
│   ├── layout/           # Sidebar, Navbar, DashboardLayout
│   └── forms/            # Shared form components
├── features/             # Feature-based modules
├── lib/                  # Auth, Prisma, Utils
├── store/                # Zustand stores
├── types/                # TypeScript types
├── validators/           # Zod schemas
└── constants/            # App constants
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Database seeder
```

## Memulai

### Prasyarat

- Node.js 20+
- PostgreSQL
- npm/pnpm

### Instalasi

```bash
# Clone repository
git clone <repository-url>
cd e-learning-qu

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup database
npx prisma generate
npx prisma db push
npx prisma db seed

# Run development server
npm run dev
```

### Environment Variables

Lihat `.env.example` untuk semua variabel yang diperlukan.

### Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Create migration
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

### Deployment ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables on Vercel dashboard
```

## Keamanan

- RBAC (Role Based Access Control)
- Middleware melindungi semua route
- JWT dengan NextAuth
- Rate limiting pada API routes
- Perlindungan XSS & CSRF
- Input validation (server + client)
- Soft delete untuk data sensitive
- Audit log semua aktivitas

## Lisensi

MIT
