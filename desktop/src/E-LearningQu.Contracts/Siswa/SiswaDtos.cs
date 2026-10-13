using System.Text.Json;
using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Siswa;

// ══════════════════ DASHBOARD ══════════════════

public sealed record SiswaDashboardDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kelas")] public string Kelas { get; init; } = "";
    [JsonPropertyName("jurusan")] public string? Jurusan { get; init; }
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
    [JsonPropertyName("semester")] public string? Semester { get; init; }
    [JsonPropertyName("nilaiRataRata")] public double NilaiRataRata { get; init; }
    [JsonPropertyName("rataMastery")] public double RataMastery { get; init; }
    [JsonPropertyName("ujianAktif")] public int UjianAktif { get; init; }
    [JsonPropertyName("tugasAktif")] public int TugasAktif { get; init; }
    [JsonPropertyName("streak")] public int Streak { get; init; }
    [JsonPropertyName("jamBelajar")] public double JamBelajar { get; init; }
    [JsonPropertyName("progresBelajar")] public double ProgresBelajar { get; init; }
    [JsonPropertyName("totalMateri")] public int TotalMateri { get; init; }
    [JsonPropertyName("kompetensiTerkuat")] public KompetensiRefDto? KompetensiTerkuat { get; init; }
    [JsonPropertyName("kompetensiTerlemah")] public KompetensiRefDto? KompetensiTerlemah { get; init; }
    [JsonPropertyName("nextUjian")] public NextUjianDto? NextUjian { get; init; }
    [JsonPropertyName("aiInsight")] public string? AiInsight { get; init; }
    [JsonPropertyName("persentaseAbsensi")] public double PersentaseAbsensi { get; init; }
    [JsonPropertyName("keaktifanMateri")] public double KeaktifanMateri { get; init; }
    [JsonPropertyName("keaktifanAI")] public double KeaktifanAI { get; init; }
    [JsonPropertyName("keaktifanAplikasi")] public double KeaktifanAplikasi { get; init; }
    [JsonPropertyName("hadirAbsensi")] public int HadirAbsensi { get; init; }
    [JsonPropertyName("totalAbsensi")] public int TotalAbsensi { get; init; }
    [JsonPropertyName("materiDiakses")] public int MateriDiakses { get; init; }
    [JsonPropertyName("aiChatCount")] public int AiChatCount { get; init; }
    [JsonPropertyName("totalAktivitas")] public int TotalAktivitas { get; init; }
    [JsonPropertyName("pengumuman")] public List<PengumumanDto> Pengumuman { get; init; } = new();
}

public sealed record KompetensiRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("skor")] public double Skor { get; init; }
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
}

public sealed record NextUjianDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
    [JsonPropertyName("berakhir")] public DateTimeOffset Berakhir { get; init; }
}

public sealed record PengumumanDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("isi")] public string? Isi { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("author")] public string? Author { get; init; }
}

// ══════════════════ UJIAN / LATIHAN ══════════════════

public sealed record SiswaUjianDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
    [JsonPropertyName("kelas")] public string? Kelas { get; init; }
    [JsonPropertyName("tanggal")] public DateTimeOffset? Tanggal { get; init; }
    [JsonPropertyName("durasi")] public int Durasi { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("sudahDikerjakan")] public bool SudahDikerjakan { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("nilaiMinimum")] public int NilaiMinimum { get; init; }
    [JsonPropertyName("bisaRetake")] public bool BisaRetake { get; init; }
}

public sealed record SiswaUjianDetailDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
    [JsonPropertyName("durasi")] public int Durasi { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("fullscreen")] public bool Fullscreen { get; init; }
    [JsonPropertyName("disableCopy")] public bool DisableCopy { get; init; }
    [JsonPropertyName("disablePaste")] public bool DisablePaste { get; init; }
    [JsonPropertyName("randomSoal")] public bool RandomSoal { get; init; }
    [JsonPropertyName("randomJawaban")] public bool RandomJawaban { get; init; }
    [JsonPropertyName("nilaiMinimum")] public int NilaiMinimum { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("bisaRetake")] public bool BisaRetake { get; init; }
    [JsonPropertyName("maxTabSwitch")] public int MaxTabSwitch { get; init; }
    [JsonPropertyName("maxCheatingScore")] public int MaxCheatingScore { get; init; }
    [JsonPropertyName("soal")] public List<SiswaSoalDto> Soal { get; init; } = new();
}

public sealed record SiswaSoalDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nomor")] public int Nomor { get; init; }
    [JsonPropertyName("pertanyaan")] public string Pertanyaan { get; init; } = "";
    [JsonPropertyName("jenisSoal")] public string JenisSoal { get; init; } = "";
    [JsonPropertyName("tingkatKesulitan")] public string? TingkatKesulitan { get; init; }
    [JsonPropertyName("poin")] public int Poin { get; init; }
    [JsonPropertyName("pilihanGanda")] public List<PilihanGandaDto>? PilihanGanda { get; init; }
    [JsonPropertyName("trueFalse")] public bool? TrueFalse { get; init; }
}

public sealed record PilihanGandaDto
{
    [JsonPropertyName("label")] public string Label { get; init; } = "";
    [JsonPropertyName("text")] public string Text { get; init; } = "";
}

public sealed record SiswaUjianStartDto
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("savedAnswers")] public Dictionary<string, string>? SavedAnswers { get; init; }
    [JsonPropertyName("savedRagu")] public List<string>? SavedRagu { get; init; }
    [JsonPropertyName("sessionId")] public string? SessionId { get; init; }
    [JsonPropertyName("serverTime")] public DateTimeOffset ServerTime { get; init; }
}

public sealed record SubmitUjianResponseDto
{
    [JsonPropertyName("nilai")] public double Nilai { get; init; }
    [JsonPropertyName("totalPoin")] public int TotalPoin { get; init; }
    [JsonPropertyName("perolehPoin")] public int PerolehPoin { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("jumlahBenar")] public int JumlahBenar { get; init; }
    [JsonPropertyName("hasilSoal")] public List<HasilSoalDto> HasilSoal { get; init; } = new();
}

public sealed record HasilSoalDto
{
    [JsonPropertyName("nomor")] public int Nomor { get; init; }
    [JsonPropertyName("jawaban")] public string? Jawaban { get; init; }
    [JsonPropertyName("jawabanBenar")] public string? JawabanBenar { get; init; }
    [JsonPropertyName("isCorrect")] public bool IsCorrect { get; init; }
    [JsonPropertyName("poin")] public int Poin { get; init; }
}

// ══════════════════ ABSENSI (per mapel) ══════════════════

public sealed record SiswaAbsensiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tanggal")] public DateTimeOffset Tanggal { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("mataPelajaran")] public string? MataPelajaran { get; init; }
}

// ══════════════════ MATERI ══════════════════

public sealed record SiswaMateriDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("fileUrl")] public string? FileUrl { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("mataPelajaran")] public MapelNamaDto? MataPelajaran { get; init; }
}

public sealed record MapelNamaDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

// ══════════════════ NILAI ══════════════════

public sealed record SiswaNilaiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("mapel")] public string Mapel { get; init; } = "";
    [JsonPropertyName("semester")] public string? Semester { get; init; }
    [JsonPropertyName("jenis")] public string? Jenis { get; init; }
    [JsonPropertyName("nilai")] public double Nilai { get; init; }
    [JsonPropertyName("keterangan")] public string? Keterangan { get; init; }
    [JsonPropertyName("tanggal")] public DateTimeOffset Tanggal { get; init; }
}

// ══════════════════ RANKING ══════════════════

public sealed record RankingResponseDto
{
    [JsonPropertyName("ranking")] public List<RankingItemDto> Ranking { get; init; } = new();
}

public sealed record RankingItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("rataRata")] public double RataRata { get; init; }
    [JsonPropertyName("isCurrentUser")] public bool IsCurrentUser { get; init; }
    [JsonPropertyName("peringkat")] public int Peringkat { get; init; }
}

// ══════════════════ KEHADIRAN (harian) ══════════════════

public sealed record KehadiranResponseDto2
{
    [JsonPropertyName("kebijakan")] public KebijakanDto? Kebijakan { get; init; }
    [JsonPropertyName("hariIni")] public AbsensiHarianDto? HariIni { get; init; }
    [JsonPropertyName("bulan")] public string Bulan { get; init; } = "";
    [JsonPropertyName("hariSekolah")] public int HariSekolah { get; init; }
    [JsonPropertyName("rekap")] public RekapKehadiranDto2 Rekap { get; init; } = new();
    [JsonPropertyName("rows")] public List<AbsensiHarianDto> Rows { get; init; } = new();
    [JsonPropertyName("permintaan")] public List<PermintaanAbsensiDto2> Permintaan { get; init; } = new();
}

public sealed record KebijakanDto
{
    [JsonPropertyName("jamMasuk")] public string? JamMasuk { get; init; }
    [JsonPropertyName("jamPulang")] public string? JamPulang { get; init; }
    [JsonPropertyName("toleransiMasukMenit")] public int? ToleransiMasukMenit { get; init; }
    [JsonPropertyName("toleransiPulangMenit")] public int? ToleransiPulangMenit { get; init; }
}

public sealed record AbsensiHarianDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tanggal")] public DateTimeOffset Tanggal { get; init; }
    [JsonPropertyName("jamMasuk")] public string? JamMasuk { get; init; }
    [JsonPropertyName("jamPulang")] public string? JamPulang { get; init; }
    [JsonPropertyName("statusMasuk")] public string? StatusMasuk { get; init; }
    [JsonPropertyName("statusPulang")] public string? StatusPulang { get; init; }
    [JsonPropertyName("terlambatMenit")] public int? TerlambatMenit { get; init; }
}

public sealed record RekapKehadiranDto2
{
    [JsonPropertyName("hariTercatat")] public int HariTercatat { get; init; }
    [JsonPropertyName("hadir")] public int Hadir { get; init; }
    [JsonPropertyName("terlambat")] public int Terlambat { get; init; }
    [JsonPropertyName("pulangAwal")] public int PulangAwal { get; init; }
    [JsonPropertyName("persenKehadiran")] public double PersenKehadiran { get; init; }
}

public sealed record PermintaanAbsensiDto2
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tanggal")] public string Tanggal { get; init; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; init; } = "";
    [JsonPropertyName("alasan")] public string? Alasan { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("catatanAdmin")] public string? CatatanAdmin { get; init; }
}

// ══════════════════ PROFIL BELAJAR ══════════════════

public sealed record ProfilBelajarDto
{
    [JsonPropertyName("model")] public StudentModelDto? Model { get; init; }
    [JsonPropertyName("penguasaan")] public PenguasaanOverviewDto? Penguasaan { get; init; }
    [JsonPropertyName("jalur")] public JalurBelajarDto? Jalur { get; init; }
    [JsonPropertyName("warnings")] public WarningsDto? Warnings { get; init; }
}

public sealed record StudentModelDto
{
    [JsonPropertyName("profile")] public StudentProfileDto? Profile { get; init; }
    [JsonPropertyName("isNew")] public bool IsNew { get; init; }
}

public sealed record StudentProfileDto
{
    [JsonPropertyName("gayaBelajar")] public string? GayaBelajar { get; init; }
    [JsonPropertyName("motivasi")] public string? Motivasi { get; init; }
    [JsonPropertyName("engagementScore")] public double EngagementScore { get; init; }
    [JsonPropertyName("konsistensi")] public double Konsistensi { get; init; }
    [JsonPropertyName("streak")] public int Streak { get; init; }
    [JsonPropertyName("totalSesi")] public int TotalSesi { get; init; }
    [JsonPropertyName("learningVelocity")] public double LearningVelocity { get; init; }
    [JsonPropertyName("trendNilai")] public string? TrendNilai { get; init; }
    [JsonPropertyName("rataNilai")] public double RataNilai { get; init; }
}

public sealed record PenguasaanOverviewDto
{
    [JsonPropertyName("penguasaan")] public List<PenguasaanItemDto> Items { get; init; } = new();
    [JsonPropertyName("distribusi")] public Dictionary<string, int>? Distribusi { get; init; }
    [JsonPropertyName("rataSkor")] public double RataSkor { get; init; }
    [JsonPropertyName("total")] public int Total { get; init; }
}

public sealed record PenguasaanItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kode")] public string? Kode { get; init; }
    [JsonPropertyName("kompetensi")] public string? Kompetensi { get; init; }
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
    [JsonPropertyName("skor")] public double Skor { get; init; }
    [JsonPropertyName("kategori")] public string? Kategori { get; init; }
}

public sealed record JalurBelajarDto
{
    [JsonPropertyName("id")] public string? Id { get; init; }
    [JsonPropertyName("progres")] public double Progres { get; init; }
    [JsonPropertyName("currentDifficulty")] public string? CurrentDifficulty { get; init; }
    [JsonPropertyName("isStuck")] public bool IsStuck { get; init; }
    [JsonPropertyName("stuckCount")] public int StuckCount { get; init; }
}

public sealed record WarningsDto
{
    [JsonPropertyName("total")] public int Total { get; init; }
    [JsonPropertyName("critical")] public int Critical { get; init; }
    [JsonPropertyName("high")] public int High { get; init; }
    [JsonPropertyName("warnings")] public List<WarningItemDto> Warnings { get; init; } = new();
}

public sealed record WarningItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; init; } = "";
    [JsonPropertyName("severity")] public string Severity { get; init; } = "";
    [JsonPropertyName("message")] public string Message { get; init; } = "";
    [JsonPropertyName("skor")] public double? Skor { get; init; }
    [JsonPropertyName("isResolved")] public bool IsResolved { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
}

// ══════════════════ JADWAL PIKET / STRUKTUR KELAS ══════════════════

public sealed record JadwalPiketDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("hari")] public string Hari { get; init; } = "";
    [JsonPropertyName("siswa")] public NamaRefDto2? Siswa { get; init; }
}

public sealed record NamaRefDto2
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record StrukturKelasDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("tingkat")] public string? Tingkat { get; init; }
    [JsonPropertyName("guru")] public NamaRefDto2? Guru { get; init; }
    [JsonPropertyName("siswas")] public List<SiswaKelasItemDto> Siswas { get; init; } = new();
}

public sealed record SiswaKelasItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
}

// ══════════════════ JADWAL PELAJARAN ══════════════════

public sealed record JadwalPelajaranSiswaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
    [JsonPropertyName("mataPelajaranId")] public string? MataPelajaranId { get; init; }
    [JsonPropertyName("hari")] public string Hari { get; init; } = "";
    [JsonPropertyName("jamMulai")] public string JamMulai { get; init; } = "";
    [JsonPropertyName("jamSelesai")] public string JamSelesai { get; init; } = "";
    [JsonPropertyName("mataPelajaran")] public MapelNamaDto? MataPelajaran { get; init; }
}

// ══════════════════ IURAN ══════════════════

public sealed record IuranSiswaDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("kelasId")] public string? KelasId { get; init; }
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("nominal")] public double Nominal { get; init; }
    [JsonPropertyName("tenggat")] public DateTime? Tenggat { get; init; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("pembayaran")] public List<PembayaranIuranDto> Pembayaran { get; init; } = new();
}

public sealed record PembayaranIuranDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("iuranId")] public string? IuranId { get; init; }
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("jumlah")] public double Jumlah { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("tanggalBayar")] public DateTime? TanggalBayar { get; init; }
}

// ══════════════════ BENDAHARA ══════════════════

public sealed record BendaharaSummaryDto
{
    [JsonPropertyName("pemasukanIuran")] public double PemasukanIuran { get; init; }
    [JsonPropertyName("pemasukanDenda")] public double PemasukanDenda { get; init; }
    [JsonPropertyName("totalPemasukan")] public double TotalPemasukan { get; init; }
    [JsonPropertyName("totalPengeluaran")] public double TotalPengeluaran { get; init; }
    [JsonPropertyName("sisaKas")] public double SisaKas { get; init; }
}

// ══════════════════ SEKRETARIS ══════════════════

public sealed record SekretarisPiketDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("siswaId")] public string? SiswaId { get; init; }
    [JsonPropertyName("hari")] public string Hari { get; init; } = "";
    [JsonPropertyName("siswa")] public NamaRefDto2? Siswa { get; init; }
}

// ══════════════════ SUS (Survei Kepuasan) ══════════════════

public sealed record SusResponseDto
{
    [JsonPropertyName("average")] public double Average { get; init; }
    [JsonPropertyName("total")] public int Total { get; init; }
    [JsonPropertyName("distribusi")] public Dictionary<string, int>? Distribusi { get; init; }
}

public sealed record SusSubmitResponseDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("skor")] public double Skor { get; init; }
}

// ══════════════════ AI ANALITIK ══════════════════

public sealed record AiAnalitikDto
{
    [JsonPropertyName("logs")] public List<AgentLogDto> Logs { get; init; } = new();
    [JsonPropertyName("perAgent")] public List<PerAgentDto> PerAgent { get; init; } = new();
    [JsonPropertyName("statistik")] public StatistikAgentDto? Statistik { get; init; }
    [JsonPropertyName("profile")] public StudentProfileDto? Profile { get; init; }
    [JsonPropertyName("penguasaan")] public PenguasaanOverviewDto? Penguasaan { get; init; }
}

public sealed record AgentLogDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("agent")] public string Agent { get; init; } = "";
    [JsonPropertyName("tipe")] public string? Tipe { get; init; }
    [JsonPropertyName("query")] public string? Query { get; init; }
    [JsonPropertyName("hasil")] public string? Hasil { get; init; }
    [JsonPropertyName("durasiMs")] public long DurasiMs { get; init; }
    [JsonPropertyName("model")] public string? Model { get; init; }
    [JsonPropertyName("sukses")] public bool Sukses { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
}

public sealed record PerAgentDto
{
    [JsonPropertyName("agent")] public string Agent { get; init; } = "";
    [JsonPropertyName("total")] public int Total { get; init; }
    [JsonPropertyName("rataDurasi")] public double RataDurasi { get; init; }
}

public sealed record StatistikAgentDto
{
    [JsonPropertyName("totalRuns")] public int TotalRuns { get; init; }
    [JsonPropertyName("sukses")] public int Sukses { get; init; }
    [JsonPropertyName("gagal")] public int Gagal { get; init; }
    [JsonPropertyName("rataDurasi")] public double RataDurasi { get; init; }
}

// ══════════════════ PENGATURAN ══════════════════

public sealed record SiswaProfilDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string? Nama { get; init; }
    [JsonPropertyName("nis")] public string? Nis { get; init; }
    [JsonPropertyName("nisn")] public string? Nisn { get; init; }
    [JsonPropertyName("alamat")] public string? Alamat { get; init; }
    [JsonPropertyName("noTelp")] public string? NoTelp { get; init; }
    [JsonPropertyName("user")] public SiswaUserDto? User { get; init; }
    [JsonPropertyName("kelas")] public MapelNamaDto? Kelas { get; init; }
}

public sealed record SiswaUserDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("image")] public string? Image { get; init; }
}

// ══════════════════ UTIL ══════════════════

public static class SiswaJson
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