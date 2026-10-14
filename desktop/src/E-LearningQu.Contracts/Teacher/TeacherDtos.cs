using System.Text.Json;
using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Teacher;

// ══════════════════ DASHBOARD ══════════════════

public sealed record GuruDashboardDto
{
    [JsonPropertyName("kelasCount")] public int KelasCount { get; init; }
    [JsonPropertyName("mapelCount")] public int MapelCount { get; init; }
    [JsonPropertyName("siswaCount")] public int SiswaCount { get; init; }
    [JsonPropertyName("ujianAktif")] public int UjianAktif { get; init; }
    [JsonPropertyName("latihanAktif")] public int LatihanAktif { get; init; }
    [JsonPropertyName("totalSoal")] public int TotalSoal { get; init; }
    [JsonPropertyName("rataNilai")] public double RataNilai { get; init; }
    [JsonPropertyName("rataMastery")] public double RataMastery { get; init; }
}

// ══════════════════ MURID ══════════════════

public sealed record GuruMuridDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

public sealed record KelasRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

// ══════════════════ SOAL (Bank Soal) ══════════════════

public sealed record GuruSoalDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("pertanyaan")] public string Pertanyaan { get; init; } = "";
    [JsonPropertyName("jenisSoal")] public string JenisSoal { get; init; } = "";
    [JsonPropertyName("tingkatKesulitan")] public string? TingkatKesulitan { get; init; }
    [JsonPropertyName("poin")] public int Poin { get; init; }
    [JsonPropertyName("jawaban")] public string? Jawaban { get; init; }
    [JsonPropertyName("pilihanGanda")] public List<string>? PilihanGanda { get; init; }
    [JsonPropertyName("trueFalse")] public bool? TrueFalse { get; init; }
    [JsonPropertyName("bab")] public string? Bab { get; init; }
    [JsonPropertyName("tags")] public List<string>? Tags { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelRefDto? MataPelajaran { get; init; }
}

public sealed record MapelRefDto
{
    [JsonPropertyName("id")] public string? Id { get; init; }
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

// ══════════════════ UJIAN ══════════════════

public sealed record GuruUjianDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("durasi")] public int Durasi { get; init; }
    [JsonPropertyName("tanggal")] public DateTime? Tanggal { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelRefDto? MataPelajaran { get; init; }
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

// Referensi saat membuat ujian baru (tab=refs)
public sealed record GuruUjianRefsDto
{
    [JsonPropertyName("kelas")] public List<IdNamaDto> Kelas { get; init; } = new();
    [JsonPropertyName("mapels")] public List<IdNamaDto> Mapels { get; init; } = new();
    [JsonPropertyName("tahunAjaran")] public IdNamaDto? TahunAjaran { get; init; }
    [JsonPropertyName("semester")] public IdNamaDto? Semester { get; init; }
    [JsonPropertyName("soals")] public List<SoalRefDto> Soals { get; init; } = new();
}

public sealed record IdNamaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record SoalRefDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("pertanyaan")] public string Pertanyaan { get; init; } = "";
    [JsonPropertyName("jenisSoal")] public string JenisSoal { get; init; } = "";
    [JsonPropertyName("poin")] public int Poin { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
}

// ══════════════════ ANALITIK ══════════════════

public sealed record GuruAnalitikDto
{
    [JsonPropertyName("rataRata")] public double RataRata { get; init; }
    [JsonPropertyName("tertinggi")] public double Tertinggi { get; init; }
    [JsonPropertyName("terendah")] public double Terendah { get; init; }
    [JsonPropertyName("lulus")] public int Lulus { get; init; }
    [JsonPropertyName("tidakLulus")] public int TidakLulus { get; init; }
    [JsonPropertyName("totalSiswaDinilai")] public int TotalSiswaDinilai { get; init; }
    [JsonPropertyName("grafikKelas")] public List<GrafikPointDto> GrafikKelas { get; init; } = new();
    [JsonPropertyName("grafikMapel")] public List<GrafikPointDto> GrafikMapel { get; init; } = new();
    [JsonPropertyName("essayCount")] public int EssayCount { get; init; }
    [JsonPropertyName("pgCount")] public int PgCount { get; init; }
    [JsonPropertyName("totalKelas")] public int TotalKelas { get; init; }
    [JsonPropertyName("totalMapel")] public int TotalMapel { get; init; }
}

public sealed record GrafikPointDto
{
    [JsonPropertyName("label")] public string Label { get; init; } = "";
    [JsonPropertyName("nilai")] public double Nilai { get; init; }
}

// ══════════════════ MATERI ══════════════════

public sealed record GuruMateriDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("fileUrl")] public string? FileUrl { get; init; }
    [JsonPropertyName("fileType")] public string? FileType { get; init; }
    [JsonPropertyName("fileSize")] public long? FileSize { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelRefDto? MataPelajaran { get; init; }
}

// ══════════════════ NILAI ══════════════════

public sealed record GuruNilaiResponseDto
{
    [JsonPropertyName("ujians")] public List<GuruNilaiUjianDto> Ujians { get; init; } = new();
    [JsonPropertyName("nilais")] public List<GuruNilaiRowDto> Nilais { get; init; } = new();
}

public sealed record GuruNilaiUjianDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelRefDto? MataPelajaran { get; init; }
}

public sealed record GuruNilaiRowDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nilai")] public double Nilai { get; init; }
    [JsonPropertyName("ujianId")] public string? UjianId { get; init; }
    [JsonPropertyName("siswa")] public NamaRefDto? Siswa { get; init; }
    [JsonPropertyName("ujian")] public NamaRefDto? Ujian { get; init; }
}

public sealed record NamaRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

// Essay grading
public sealed record GuruEssayDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("esaiJawaban")] public string? EsaiJawaban { get; init; }
    [JsonPropertyName("jawaban")] public string? Jawaban { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("siswa")] public NamaRefDto? Siswa { get; init; }
    [JsonPropertyName("soal")] public SoalPertanyaanDto? Soal { get; init; }
    [JsonPropertyName("penilaianEssay")] public PenilaianEssayDto? PenilaianEssay { get; init; }
}

public sealed record SoalPertanyaanDto
{
    [JsonPropertyName("pertanyaan")] public string Pertanyaan { get; init; } = "";
}

public sealed record PenilaianEssayDto
{
    [JsonPropertyName("nilai")] public double? Nilai { get; init; }
    [JsonPropertyName("komentar")] public string? Komentar { get; init; }
}

// ══════════════════ ABSANSI GURU ══════════════════

public sealed record AbsensiGuruDto
{
    [JsonPropertyName("id")] public string? Id { get; init; }
    [JsonPropertyName("tanggal")] public DateTime? Tanggal { get; init; }
    [JsonPropertyName("status")] public string? Status { get; init; }
    [JsonPropertyName("jamMasuk")] public string? JamMasuk { get; init; }
    [JsonPropertyName("jamPulang")] public string? JamPulang { get; init; }
    [JsonPropertyName("keterangan")] public string? Keterangan { get; init; }
}

// Absensi murid per sesi
public sealed record AbsensiSiswaResponseDto
{
    [JsonPropertyName("absensi")] public AbsensiSiswaHeaderDto? Absensi { get; init; }
    [JsonPropertyName("siswas")] public List<AbsensiSiswaRowDto> Siswas { get; init; } = new();
}

public sealed record AbsensiSiswaHeaderDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tanggal")] public DateTime? Tanggal { get; init; }
}

public sealed record AbsensiSiswaRowDto
{
    [JsonPropertyName("siswaId")] public string SiswaId { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "HADIR";
}

// ══════════════════ PENGATURAN GURU ══════════════════

public sealed record GuruProfilDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("nip")] public string? Nip { get; init; }
    [JsonPropertyName("nuptk")] public string? Nuptk { get; init; }
    [JsonPropertyName("alamat")] public string? Alamat { get; init; }
    [JsonPropertyName("noTelp")] public string? NoTelp { get; init; }
    [JsonPropertyName("user")] public GuruUserDto? User { get; init; }
}

public sealed record GuruUserDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("image")] public string? Image { get; init; }
}

// ══════════════════ JADWAL ══════════════════

public sealed record GuruJadwalDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("hari")] public string Hari { get; init; } = "";
    [JsonPropertyName("jamMulai")] public string JamMulai { get; init; } = "";
    [JsonPropertyName("jamSelesai")] public string JamSelesai { get; init; } = "";
    [JsonPropertyName("mataPelajaran")] public MapelRefDto? MataPelajaran { get; init; }
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

// ══════════════════ MAPEL ══════════════════

public sealed record MapelDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

// ══════════════════ ANTI-CHEAT ══════════════════

public sealed record AntiCheatSessionDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("ujianId")] public string? UjianId { get; init; }
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("startedAt")] public DateTimeOffset? StartedAt { get; init; }
    [JsonPropertyName("submittedAt")] public DateTimeOffset? SubmittedAt { get; init; }
    [JsonPropertyName("ipAddress")] public string? IpAddress { get; init; }
    [JsonPropertyName("userAgent")] public string? UserAgent { get; init; }
    [JsonPropertyName("tabSwitchCount")] public int TabSwitchCount { get; init; }
    [JsonPropertyName("totalBlurMs")] public long TotalBlurMs { get; init; }
    [JsonPropertyName("cheatingScore")] public int CheatingScore { get; init; }
    [JsonPropertyName("isFlagged")] public bool IsFlagged { get; init; }
    [JsonPropertyName("flagReason")] public string? FlagReason { get; init; }
    [JsonPropertyName("status")] public string? Status { get; init; }
    [JsonPropertyName("siswa")] public NamaRefDto? Siswa { get; init; }
    [JsonPropertyName("ujian")] public NamaRefDto? Ujian { get; init; }
}

// ══════════════════ INTERVENSI ══════════════════

public sealed record IntervensiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("tipe")] public string Tipe { get; init; } = "";
    [JsonPropertyName("reason")] public string? Reason { get; init; }
    [JsonPropertyName("action")] public string? Action { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("deadline")] public DateTime? Deadline { get; init; }
    [JsonPropertyName("notes")] public string? Notes { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("siswa")] public SiswaKelasRefDto? Siswa { get; init; }
}

public sealed record SiswaKelasRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

// ══════════════════ PELANGGARAN ══════════════════

public sealed record PelanggaranDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("jenis")] public string Jenis { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("poin")] public int? Poin { get; init; }
    [JsonPropertyName("tindakan")] public string? Tindakan { get; init; }
    [JsonPropertyName("tanggal")] public DateTime? Tanggal { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("siswa")] public SiswaKelasRefDto? Siswa { get; init; }
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

// ══════════════════ TEACHER ANALYTICS ══════════════════

public sealed record TeacherAnalyticsResponseDto
{
    [JsonPropertyName("analytics")] public TeacherAnalyticsDto? Analytics { get; init; }
    [JsonPropertyName("atRisk")] public List<AtRiskDto> AtRisk { get; init; } = new();
    [JsonPropertyName("insights")] public List<InsightDto> Insights { get; init; } = new();
}

public sealed record TeacherAnalyticsDto
{
    [JsonPropertyName("overview")] public OverviewDto? Overview { get; init; }
    [JsonPropertyName("perMapel")] public List<PerMapelDto> PerMapel { get; init; } = new();
    [JsonPropertyName("perKelas")] public List<PerKelasDto> PerKelas { get; init; } = new();
    [JsonPropertyName("topAtRisk")] public List<TopAtRiskDto> TopAtRisk { get; init; } = new();
    [JsonPropertyName("recentActivity")] public List<RecentActivityDto> RecentActivity { get; init; } = new();
}

public sealed record OverviewDto
{
    [JsonPropertyName("totalSiswa")] public int TotalSiswa { get; init; }
    [JsonPropertyName("totalKelas")] public int TotalKelas { get; init; }
    [JsonPropertyName("totalMapel")] public int TotalMapel { get; init; }
    [JsonPropertyName("totalUjian")] public int TotalUjian { get; init; }
    [JsonPropertyName("rataRataGlobal")] public double RataRataGlobal { get; init; }
}

public sealed record PerMapelDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("rataRata")] public double RataRata { get; init; }
    [JsonPropertyName("jumlahSiswa")] public int JumlahSiswa { get; init; }
    [JsonPropertyName("lulusRate")] public double LulusRate { get; init; }
}

public sealed record PerKelasDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("rataRata")] public double RataRata { get; init; }
    [JsonPropertyName("jumlahSiswa")] public int JumlahSiswa { get; init; }
}

public sealed record TopAtRiskDto
{
    [JsonPropertyName("siswaId")] public string SiswaId { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kelas")] public string? Kelas { get; init; }
    [JsonPropertyName("rataNilai")] public double RataNilai { get; init; }
    [JsonPropertyName("warnings")] public int Warnings { get; init; }
}

public sealed record RecentActivityDto
{
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; init; }
    [JsonPropertyName("aktivitas")] public string Aktivitas { get; init; } = "";
    [JsonPropertyName("detail")] public string? Detail { get; init; }
}

public sealed record AtRiskDto
{
    [JsonPropertyName("siswa")] public AtRiskSiswaDto? Siswa { get; init; }
    [JsonPropertyName("warningCount")] public int WarningCount { get; init; }
    [JsonPropertyName("maxSeverity")] public string? MaxSeverity { get; init; }
}

public sealed record AtRiskSiswaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("kelas")] public KelasRefDto? Kelas { get; init; }
}

public sealed record InsightDto
{
    [JsonPropertyName("studentId")] public string? StudentId { get; init; }
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kelas")] public string? Kelas { get; init; }
    [JsonPropertyName("progress")] public double? Progress { get; init; }
    [JsonPropertyName("averageScore")] public double? AverageScore { get; init; }
    [JsonPropertyName("riskLevel")] public string? RiskLevel { get; init; }
}

// ══════════════════ WALI KELAS ══════════════════

public sealed record WaliKelasDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tingkat")] public string? Tingkat { get; init; }
    [JsonPropertyName("guruId")] public string? GuruId { get; init; }
    [JsonPropertyName("siswas")] public List<WaliKelasSiswaDto> Siswas { get; init; } = new();
    [JsonPropertyName("_count")] public WaliKelasCountDto? Count { get; init; }
}

public sealed record WaliKelasCountDto
{
    [JsonPropertyName("siswas")] public int Siswas { get; init; }
}

public sealed record WaliKelasSiswaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
}

// ══════════════════ AI KNOWLEDGE ══════════════════

public sealed record AiKnowledgeResponseDto
{
    [JsonPropertyName("materis")] public List<AiMateriDto> Materis { get; init; } = new();
    [JsonPropertyName("totalChunks")] public int TotalChunks { get; init; }
    [JsonPropertyName("geminiEnabled")] public bool GeminiEnabled { get; init; }
}

public sealed record AiMateriDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("_count")] public ChunkCountDto? Count { get; init; }
}

public sealed record ChunkCountDto
{
    [JsonPropertyName("chunks")] public int Chunks { get; init; }
}

// ══════════════════ SUCCESS ENVELOPE (opsional) ══════════════════

public sealed record SuccessDto
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("message")] public string? Message { get; init; }
}

// Untuk respons yang bisa berupa array polos ATAU object pembungkus.
public static class TeacherJson
{
    public static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    public static List<T> UnwrapList<T>(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Array => element.Deserialize<List<T>>(Opts) ?? new List<T>(),
            JsonValueKind.Object => TryUnwrap<T>(element),
            _ => new List<T>()
        };
    }

    public static T? UnwrapObject<T>(JsonElement element)
        where T : class
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        // Jika object adalah pembungkus array tunggal, ambil properti pertama yang object/array.
        return element.Deserialize<T>(Opts);
    }

    private static List<T> TryUnwrap<T>(JsonElement obj)
    {
        foreach (var prop in obj.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Array)
                return prop.Value.Deserialize<List<T>>(Opts) ?? new List<T>();
        }
        return new List<T>();
    }
}