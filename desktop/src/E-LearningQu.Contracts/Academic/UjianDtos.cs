using System.Text.Json;
using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Academic;

public sealed record PilihanGandaDto
{
    [JsonPropertyName("label")] public string Label { get; init; } = "";
    [JsonPropertyName("text")] public string Text { get; init; } = "";
}

public sealed record UjianListItemDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string Mapel { get; init; } = "";
    [JsonPropertyName("kelas")] public string? Kelas { get; init; }
    [JsonPropertyName("tanggal")] public DateTimeOffset Tanggal { get; init; }
    [JsonPropertyName("durasi")] public int Durasi { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("sudahDikerjakan")] public bool SudahDikerjakan { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("nilaiMinimum")] public int NilaiMinimum { get; init; }
    [JsonPropertyName("bisaRetake")] public bool BisaRetake { get; init; }
}

public sealed record SoalDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nomor")] public int Nomor { get; init; }
    [JsonPropertyName("pertanyaan")] public string Pertanyaan { get; init; } = "";
    [JsonPropertyName("jenisSoal")] public string JenisSoal { get; init; } = "";
    [JsonPropertyName("tingkatKesulitan")] public string? TingkatKesulitan { get; init; }
    [JsonPropertyName("poin")] public int Poin { get; init; }
    [JsonPropertyName("pilihanGanda")] public List<PilihanGandaDto>? PilihanGanda { get; init; }
    [JsonPropertyName("trueFalse")] public bool? TrueFalse { get; init; }
    [JsonPropertyName("soalInduk")] public string? SoalInduk { get; init; }

    [JsonIgnore]
    public bool IsPilihanGanda => PilihanGanda is { Count: > 0 };

    [JsonIgnore]
    public bool IsEssay => !IsPilihanGanda && !string.Equals(JenisSoal, "TRUE_FALSE", StringComparison.OrdinalIgnoreCase)
                          && !string.Equals(JenisSoal, "PILIHAN_GANDA", StringComparison.OrdinalIgnoreCase);
}

public sealed record UjianDetailDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string Mapel { get; init; } = "";
    [JsonPropertyName("durasi")] public int Durasi { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("fullscreen")] public bool Fullscreen { get; init; }
    [JsonPropertyName("disableCopy")] public bool DisableCopy { get; init; }
    [JsonPropertyName("disablePaste")] public bool DisablePaste { get; init; }
    [JsonPropertyName("nilaiMinimum")] public int NilaiMinimum { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("bisaRetake")] public bool BisaRetake { get; init; }
    [JsonPropertyName("soal")] public List<SoalDto> Soal { get; init; } = new();
}

public sealed record UjianStartResponse
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("savedAnswers")] public Dictionary<string, string>? SavedAnswers { get; init; }
    [JsonPropertyName("savedRagu")] public List<string>? SavedRagu { get; init; }
    [JsonPropertyName("sessionId")] public string? SessionId { get; init; }
    [JsonPropertyName("serverTime")] public long? ServerTime { get; init; }
}

public sealed record SubmitUjianRequest
{
    [JsonPropertyName("answers")] public Dictionary<string, string> Answers { get; init; } = new();
    [JsonPropertyName("raguRagu")] public List<string> RaguRagu { get; init; } = new();
}

public sealed record HasilSoalDto
{
    [JsonPropertyName("soalId")] public string? SoalId { get; init; }
    [JsonPropertyName("isCorrect")] public bool IsCorrect { get; init; }
    [JsonPropertyName("jawaban")] public string? Jawaban { get; init; }
    [JsonPropertyName("kunci")] public string? Kunci { get; init; }
}

public sealed record SubmitUjianResponse
{
    [JsonPropertyName("nilai")] public int Nilai { get; init; }
    [JsonPropertyName("totalPoin")] public int TotalPoin { get; init; }
    [JsonPropertyName("perolehPoin")] public int PerolehPoin { get; init; }
    [JsonPropertyName("jumlahSoal")] public int JumlahSoal { get; init; }
    [JsonPropertyName("jumlahBenar")] public int JumlahBenar { get; init; }
    [JsonPropertyName("hasilSoal")] public List<HasilSoalDto> HasilSoal { get; init; } = new();
}
