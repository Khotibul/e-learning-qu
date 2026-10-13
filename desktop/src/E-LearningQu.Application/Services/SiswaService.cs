using System.Text.Json;
using System.Text.Json.Nodes;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Siswa;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Semua endpoint /api/mobile/siswa/* — mengikuti pola respons audit route.ts:
/// array mentah, objek dibungkus, atau default [] bila tanpa kelas.
/// </summary>
public sealed class SiswaService : ISiswaService
{
    private const string Base = "/api/mobile/siswa";
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public SiswaService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    // ══════════════════ DASHBOARD ══════════════════

    public async Task<SiswaDashboardDto> GetDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<SiswaDashboardDto>($"{Base}/dashboard", ct) ?? new SiswaDashboardDto();

    // ══════════════════ UJIAN ══════════════════

    public async Task<List<SiswaUjianDto>> GetUjiansAsync(CancellationToken ct = default) =>
        await GetListAsync<SiswaUjianDto>($"{Base}/ujian", ct);

    public Task<SiswaUjianDetailDto?> GetUjianDetailAsync(string id, CancellationToken ct = default) =>
        GetObjectAsync<SiswaUjianDetailDto>($"{Base}/ujian/{Uri.EscapeDataString(id)}", ct);

    public Task<SiswaUjianStartDto?> StartUjianAsync(string id, CancellationToken ct = default) =>
        PostObjectAsync<SiswaUjianStartDto>($"{Base}/ujian/{Uri.EscapeDataString(id)}/start", new JsonObject(), ct);

    public async Task<SubmitUjianResponseDto?> SubmitUjianAsync(string id, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["answers"] = JsonSerializer.SerializeToNode(answers, Opts)!,
            ["raguRagu"] = JsonSerializer.SerializeToNode(raguRagu, Opts)!,
        };
        return await PostObjectAsync<SubmitUjianResponseDto>($"{Base}/ujian/{Uri.EscapeDataString(id)}/submit", body, ct);
    }

    public async Task<bool> AutoSaveAsync(string id, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["answers"] = JsonSerializer.SerializeToNode(answers, Opts)!,
            ["raguRagu"] = JsonSerializer.SerializeToNode(raguRagu, Opts)!,
        };
        var element = await PostRawAsync($"{Base}/ujian/{Uri.EscapeDataString(id)}/auto-save", body, ct);
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
    }

    // ══════════════════ LATIHAN ══════════════════

    public async Task<List<SiswaUjianDto>> GetLatihanAsync(CancellationToken ct = default) =>
        await GetListAsync<SiswaUjianDto>($"{Base}/latihan", ct);

    // ══════════════════ ABSENSI ══════════════════

    public async Task<List<SiswaAbsensiDto>> GetAbsensiAsync(string? start = null, string? end = null, CancellationToken ct = default)
    {
        var path = $"{Base}/absensi";
        var qs = new List<string>();
        if (!string.IsNullOrWhiteSpace(start)) qs.Add($"start={Uri.EscapeDataString(start)}");
        if (!string.IsNullOrWhiteSpace(end)) qs.Add($"end={Uri.EscapeDataString(end)}");
        if (qs.Count > 0) path += "?" + string.Join("&", qs);
        return await GetListAsync<SiswaAbsensiDto>(path, ct);
    }

    // ══════════════════ MATERI / NILAI ══════════════════

    public async Task<List<SiswaMateriDto>> GetMateriAsync(CancellationToken ct = default) =>
        await GetListAsync<SiswaMateriDto>($"{Base}/materi", ct);

    public async Task<List<SiswaNilaiDto>> GetNilaiAsync(CancellationToken ct = default) =>
        await GetListAsync<SiswaNilaiDto>($"{Base}/nilai", ct);

    // ══════════════════ RANKING ══════════════════

    public async Task<RankingResponseDto> GetRankingAsync(CancellationToken ct = default) =>
        await GetObjectAsync<RankingResponseDto>($"{Base}/ranking", ct) ?? new RankingResponseDto();

    // ══════════════════ KEHADIRAN ══════════════════

    public async Task<KehadiranResponseDto2> GetKehadiranAsync(string? bulan = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(bulan)
            ? $"{Base}/kehadiran"
            : $"{Base}/kehadiran?bulan={Uri.EscapeDataString(bulan)}";
        return await GetObjectAsync<KehadiranResponseDto2>(path, ct) ?? new KehadiranResponseDto2();
    }

    public async Task<bool> AjukanAbsensiAsync(string tanggal, string tipe, string alasan, CancellationToken ct = default)
    {
        var body = new JsonObject { ["tanggal"] = tanggal, ["tipe"] = tipe, ["alasan"] = alasan };
        var element = await PostRawAsync($"{Base}/kehadiran", body, ct);
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
    }

    // ══════════════════ PROFIL BELAJAR ══════════════════

    public Task<ProfilBelajarDto?> GetProfilBelajarAsync(CancellationToken ct = default) =>
        GetObjectAsync<ProfilBelajarDto>($"{Base}/profil-belajar", ct);

    public async Task<WarningsDto?> RefreshWarningsAsync(CancellationToken ct = default)
    {
        var element = await PostRawAsync($"{Base}/profil-belajar", new JsonObject(), ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _)) return null;
        if (!element.TryGetProperty("warnings", out var w)) return null;
        return w.Deserialize<WarningsDto>(Opts);
    }

    // ══════════════════ JADWAL PIKET / STRUKTUR KELAS / JADWAL PELAJARAN ══════════════════

    public async Task<List<JadwalPiketDto>> GetJadwalPiketAsync(CancellationToken ct = default) =>
        await GetListAsync<JadwalPiketDto>($"{Base}/jadwal-piket", ct);

    public Task<StrukturKelasDto?> GetStrukturKelasAsync(CancellationToken ct = default) =>
        GetObjectAsync<StrukturKelasDto>($"{Base}/struktur-kelas", ct);

    public async Task<List<JadwalPelajaranSiswaDto>> GetJadwalPelajaranAsync(CancellationToken ct = default) =>
        await GetListAsync<JadwalPelajaranSiswaDto>($"{Base}/jadwal-pelajaran", ct);

    // ══════════════════ IURAN ══════════════════

    public async Task<List<IuranSiswaDto>> GetIuranAsync(CancellationToken ct = default) =>
        await GetListAsync<IuranSiswaDto>($"{Base}/iuran", ct);

    public async Task<bool> BayarIuranAsync(string iuranId, double? nominal = null, string? keterangan = null, CancellationToken ct = default)
    {
        var body = new JsonObject { ["iuranId"] = iuranId };
        if (nominal.HasValue) body["nominal"] = nominal.Value;
        if (!string.IsNullOrWhiteSpace(keterangan)) body["keterangan"] = keterangan;
        var element = await PostRawAsync($"{Base}/iuran", body, ct);
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
    }

    // ══════════════════ BENDAHARA / SEKRETARIS ══════════════════

    public Task<BendaharaSummaryDto?> GetBendaharaSummaryAsync(CancellationToken ct = default) =>
        GetObjectAsync<BendaharaSummaryDto>($"{Base}/bendahara?tab=summary", ct);

    public async Task<SekretarisPiketDto[]> GetSekretarisPiketAsync(CancellationToken ct = default)
    {
        var list = await GetListAsync<SekretarisPiketDto>($"{Base}/sekretaris?tab=piket", ct);
        return list.ToArray();
    }

    // ══════════════════ SUS ══════════════════

    public Task<SusResponseDto?> GetSusAsync(CancellationToken ct = default) =>
        GetObjectAsync<SusResponseDto>($"{Base}/sus", ct);

    public async Task<SusSubmitResponseDto?> SubmitSusAsync(double[] jawaban, string? komentar, CancellationToken ct = default)
    {
        var body = new JsonObject { ["jawaban"] = JsonSerializer.SerializeToNode(jawaban, Opts)! };
        if (!string.IsNullOrWhiteSpace(komentar)) body["komentar"] = komentar;
        return await PostObjectAsync<SusSubmitResponseDto>($"{Base}/sus", body, ct);
    }

    // ══════════════════ AI ANALITIK ══════════════════

    public Task<AiAnalitikDto?> GetAiAnalitikAsync(CancellationToken ct = default) =>
        GetObjectAsync<AiAnalitikDto>($"{Base}/ai-analitik", ct);

    // ══════════════════ PENGATURAN / PROFIL ══════════════════

    public Task<SiswaProfilDto?> GetProfilAsync(CancellationToken ct = default) =>
        GetObjectAsync<SiswaProfilDto>($"{Base}/pengaturan", ct);

    public async Task<SiswaProfilDto?> UpdateProfilAsync(object payload, CancellationToken ct = default)
    {
        var body = ToJson(payload);
        body["op"] = "updateProfile";
        return await PostObjectAsync<SiswaProfilDto>($"{Base}/pengaturan", body, ct);
    }

    public async Task<bool> UpdatePasswordAsync(string passwordLama, string passwordBaru, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["op"] = "updatePassword",
            ["passwordLama"] = passwordLama,
            ["passwordBaru"] = passwordBaru,
        };
        var element = await PostRawAsync($"{Base}/pengaturan", body, ct);
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
    }

    // ══════════════════ HELPERS ══════════════════

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        return SiswaJson.UnwrapList<T>(element);
    }

    private async Task<T?> GetObjectAsync<T>(string path, CancellationToken ct)
        where T : class
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("error", out _))
            return null;
        return element.ValueKind == JsonValueKind.Object ? element.Deserialize<T>(Opts) : null;
    }

    private async Task<T?> PostObjectAsync<T>(string path, object body, CancellationToken ct)
        where T : class
    {
        var element = await PostRawAsync(path, body, ct);
        if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("error", out _))
            return null;
        return element.ValueKind == JsonValueKind.Object ? element.Deserialize<T>(Opts) : null;
    }

    private Task<JsonElement> GetRawAsync(string path, CancellationToken ct) =>
        _api.GetAsync<JsonElement>(path, Token(), ct);

    private Task<JsonElement> PostRawAsync(string path, object body, CancellationToken ct) =>
        _api.PostAsync<object, JsonElement>(path, body, Token(), ct);

    private static JsonObject ToJson(object payload)
    {
        var node = JsonSerializer.SerializeToNode(payload, payload.GetType(), Opts);
        return node as JsonObject ?? new JsonObject();
    }
}