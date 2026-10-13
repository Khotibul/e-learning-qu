using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Admin;

// ══════════════════ DASHBOARD ══════════════════

public sealed record AdminDashboardStatsDto
{
    [JsonPropertyName("totalGuru")] public int TotalGuru { get; init; }
    [JsonPropertyName("totalSiswa")] public int TotalSiswa { get; init; }
    [JsonPropertyName("totalSoal")] public int TotalSoal { get; init; }
    [JsonPropertyName("totalUjian")] public int TotalUjian { get; init; }
    [JsonPropertyName("totalKelas")] public int TotalKelas { get; init; }
    [JsonPropertyName("totalMapel")] public int TotalMapel { get; init; }
    [JsonPropertyName("totalNilai")] public int TotalNilai { get; init; }
}

// ══════════════════ USER (Guru / Murid) ══════════════════

public sealed record AdminUserDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
    [JsonPropertyName("nip")] public string? Nip { get; init; }
    [JsonPropertyName("nuptk")] public string? Nuptk { get; init; }
    [JsonPropertyName("alamat")] public string? Alamat { get; init; }
    [JsonPropertyName("noTelp")] public string? NoTelp { get; init; }
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("nisn")] public string? Nisn { get; init; }
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
    [JsonPropertyName("userId")] public string UserId { get; init; } = "";
    [JsonPropertyName("deletedAt")] public DateTimeOffset? DeletedAt { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("user")] public AdminUserAccountDto? User { get; init; }
    [JsonPropertyName("kelas")] public KelasNamaDto? Kelas { get; init; }
}

public sealed record AdminUserAccountDto
{
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("isActive")] public bool IsActive { get; init; }
}

public sealed record AdminCreateUserRequest
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("email")] public string Email { get; init; } = "";
    [JsonPropertyName("password")] public string? Password { get; init; }
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
    [JsonPropertyName("nip")] public string? Nip { get; init; }
    [JsonPropertyName("nuptk")] public string? Nuptk { get; init; }
    [JsonPropertyName("alamat")] public string? Alamat { get; init; }
    [JsonPropertyName("noTelp")] public string? NoTelp { get; init; }
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("nisn")] public string? Nisn { get; init; }
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
}

public sealed record AdminUpdateUserRequest
{
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
    [JsonPropertyName("nip")] public string? Nip { get; init; }
    [JsonPropertyName("nuptk")] public string? Nuptk { get; init; }
    [JsonPropertyName("alamat")] public string? Alamat { get; init; }
    [JsonPropertyName("noTelp")] public string? NoTelp { get; init; }
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("nisn")] public string? Nisn { get; init; }
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
}

// ══════════════════ KELAS ══════════════════

public sealed record KelasDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("guruId")] public string? GuruId { get; init; }
    [JsonPropertyName("guru")] public GuruNamaDto? Guru { get; init; }
    [JsonPropertyName("_count")] public KelasCountDto? Count { get; init; }
}

public sealed record KelasCountDto
{
    [JsonPropertyName("siswas")] public int Siswas { get; init; }
}

public sealed record KelasNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record GuruNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record KelasCreateRequest
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tingkat")] public int Tingkat { get; init; }
    [JsonPropertyName("guruId")] public string? GuruId { get; init; }
}

public sealed record KelasUpdateRequest
{
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("guruId")] public string? GuruId { get; init; }
}

// ══════════════════ MAPEL ══════════════════

public sealed record MapelDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("semesterId")] public string? SemesterId { get; init; }
    [JsonPropertyName("semester")] public SemesterNamaDto? Semester { get; init; }
    [JsonPropertyName("pengajaran")] public List<PengajaranDto> Pengajaran { get; init; } = new();
    [JsonPropertyName("_count")] public MapelCountDto? Count { get; init; }
}

public sealed record SemesterNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunAjaran")] public TahunAjaranNamaDto? TahunAjaran { get; init; }
}

public sealed record TahunAjaranNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record PengajaranDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("guru")] public GuruNamaDto? Guru { get; init; }
    [JsonPropertyName("kelas")] public KelasNamaDto? Kelas { get; init; }
}

public sealed record MapelCountDto
{
    [JsonPropertyName("pengajaran")] public int Pengajaran { get; init; }
}

public sealed record MapelCreateRequest
{
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("guruId")] public string GuruId { get; init; } = "";
    [JsonPropertyName("semesterId")] public string SemesterId { get; init; } = "";
    [JsonPropertyName("kelasIds")] public List<string> KelasIds { get; init; } = new();
}

public sealed record MapelUpdateRequest
{
    [JsonPropertyName("kode")] public string? Kode { get; init; }
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("semesterId")] public string? SemesterId { get; init; }
}

// ══════════════════ TAHUN AJARAN ══════════════════

public sealed record TahunAjaranDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunMulai")] public int TahunMulai { get; init; }
    [JsonPropertyName("tahunSelesai")] public int TahunSelesai { get; init; }
    [JsonPropertyName("isAktif")] public bool IsAktif { get; init; }
}

public sealed record TahunAjaranCreateRequest
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunMulai")] public int TahunMulai { get; init; }
    [JsonPropertyName("tahunSelesai")] public int TahunSelesai { get; init; }
    [JsonPropertyName("isAktif")] public bool IsAktif { get; init; }
}

public sealed record TahunAjaranUpdateRequest
{
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("tahunMulai")] public int? TahunMulai { get; init; }
    [JsonPropertyName("tahunSelesai")] public int? TahunSelesai { get; init; }
    [JsonPropertyName("isAktif")] public bool? IsAktif { get; init; }
}

// ══════════════════ SEMESTER ══════════════════

public sealed record SemesterDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunAjaranId")] public string? TahunAjaranId { get; init; }
    [JsonPropertyName("isAktif")] public bool IsAktif { get; init; }
    [JsonPropertyName("tahunAjaran")] public TahunAjaranNamaDto? TahunAjaran { get; init; }
}

public sealed record SemesterCreateRequest
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunAjaranId")] public string TahunAjaranId { get; init; } = "";
    [JsonPropertyName("isAktif")] public bool IsAktif { get; init; }
}

public sealed record SemesterUpdateRequest
{
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("tahunAjaranId")] public string? TahunAjaranId { get; init; }
    [JsonPropertyName("isAktif")] public bool? IsAktif { get; init; }
}

// ══════════════════ JURUSAN ══════════════════

public sealed record JurusanDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("_count")] public JurusanCountDto? Count { get; init; }
}

public sealed record JurusanCountDto
{
    [JsonPropertyName("siswas")] public int Siswas { get; init; }
}

public sealed record JurusanCreateRequest
{
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
}

public sealed record JurusanUpdateRequest
{
    [JsonPropertyName("kode")] public string? Kode { get; init; }
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
}

public sealed record JurusanSiswaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
}

// ══════════════════ KOMPETENSI ══════════════════

public sealed record KompetensiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("jurusanId")] public string? JurusanId { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("urutan")] public int? Urutan { get; init; }
    [JsonPropertyName("jurusan")] public JurusanNamaDto? Jurusan { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelNamaRefDto? MataPelajaran { get; init; }
    [JsonPropertyName("_count")] public KompetensiCountDto? Count { get; init; }
}

public sealed record JurusanNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record MapelNamaRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record KompetensiCountDto
{
    [JsonPropertyName("soals")] public int Soals { get; init; }
}

public sealed record KompetensiCreateRequest
{
    [JsonPropertyName("kode")] public string Kode { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("jurusanId")] public string JurusanId { get; init; } = "";
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("urutan")] public int? Urutan { get; init; }
}

public sealed record KompetensiUpdateRequest
{
    [JsonPropertyName("kode")] public string? Kode { get; init; }
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("jurusanId")] public string? JurusanId { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("urutan")] public int? Urutan { get; init; }
}

// ══════════════════ PENGUMUMAN ══════════════════

public sealed record PengumumanDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("isi")] public string Isi { get; init; } = "";
    [JsonPropertyName("gambar")] public string? Gambar { get; init; }
    [JsonPropertyName("lampiran")] public string? Lampiran { get; init; }
    [JsonPropertyName("tipe")] public string? Tipe { get; init; }
    [JsonPropertyName("userId")] public string? UserId { get; init; }
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
    [JsonPropertyName("user")] public PengumumanUserDto? User { get; init; }
    [JsonPropertyName("kelas")] public KelasNamaDto? Kelas { get; init; }
}

public sealed record PengumumanUserDto
{
    [JsonPropertyName("name")] public string? Name { get; init; }
}

public sealed record PengumumanCreateRequest
{
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("isi")] public string Isi { get; init; } = "";
    [JsonPropertyName("gambar")] public string? Gambar { get; init; }
    [JsonPropertyName("lampiran")] public string? Lampiran { get; init; }
    [JsonPropertyName("tipe")] public string? Tipe { get; init; }
    [JsonPropertyName("userId")] public string? UserId { get; init; }
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
}

// ══════════════════ NILAI (read-only) ══════════════════

public sealed record AdminNilaiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("ujianId")] public string? UjianId { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("semesterId")] public string? SemesterId { get; init; }
    [JsonPropertyName("nilai")] public double Nilai { get; init; }
    [JsonPropertyName("siswa")] public AdminNilaiSiswaDto? Siswa { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelNamaRefDto? MataPelajaran { get; init; }
    [JsonPropertyName("semester")] public SemesterNamaDto? Semester { get; init; }
}

public sealed record AdminNilaiSiswaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("kelas")] public KelasNamaDto? Kelas { get; init; }
}

// ══════════════════ STATISTIK ══════════════════

public sealed record StatistikGuruMuridDto
{
    [JsonPropertyName("guru")] public int Guru { get; init; }
    [JsonPropertyName("murid")] public int Murid { get; init; }
}

public sealed record StatistikBarDto
{
    [JsonPropertyName("label")] public string Label { get; init; } = "";
    [JsonPropertyName("nilai")] public int Nilai { get; init; }
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
    [JsonPropertyName("soalCount")] public int? SoalCount { get; init; }
}

// ══════════════════ REFS ══════════════════

public sealed record AdminRefsDto
{
    [JsonPropertyName("guru")] public List<RefItemDto> Guru { get; init; } = new();
    [JsonPropertyName("kelas")] public List<RefKelasDto> Kelas { get; init; } = new();
    [JsonPropertyName("semester")] public List<RefSemesterDto> Semester { get; init; } = new();
    [JsonPropertyName("tahunAjaran")] public List<RefItemDto> TahunAjaran { get; init; } = new();
    [JsonPropertyName("mapel")] public List<RefMapelDto> Mapel { get; init; } = new();
    [JsonPropertyName("jurusan")] public List<RefMapelDto> Jurusan { get; init; } = new();
}

public sealed record RefItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record RefKelasDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tingkat")] public int? Tingkat { get; init; }
}

public sealed record RefSemesterDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tahunAjaran")] public TahunAjaranNamaDto? TahunAjaran { get; init; }
}

public sealed record RefMapelDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kode")] public string? Kode { get; init; }
}
