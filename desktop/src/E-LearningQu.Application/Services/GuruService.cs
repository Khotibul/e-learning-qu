using System.Text.Json;
using System.Text.Json.Nodes;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Teacher;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Semua endpoint /api/mobile/guru/* — mengikuti pola pola respons dari audit route.ts:
/// GET kadang array polos, kadang object pembungkus; POST disiplin `op` pada body.
/// </summary>
public sealed class GuruService : IGuruService
{
    private const string Base = "/api/mobile/guru";
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public GuruService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    // ══════════════════ DASHBOARD ══════════════════

    public async Task<GuruDashboardDto> GetDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<GuruDashboardDto>($"{Base}/dashboard", ct) ?? new GuruDashboardDto();

    // ══════════════════ MURID ══════════════════

    public async Task<List<GuruMuridDto>> GetMuridAsync(string? search = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(search)
            ? $"{Base}/murid"
            : $"{Base}/murid?search={Uri.EscapeDataString(search)}";
        return await GetListAsync<GuruMuridDto>(path, ct);
    }

    // ══════════════════ SOAL ══════════════════

    public async Task<List<GuruSoalDto>> GetSoalAsync(string? search = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(search)
            ? $"{Base}/soal"
            : $"{Base}/soal?search={Uri.EscapeDataString(search)}";
        return await GetListAsync<GuruSoalDto>(path, ct);
    }

    public async Task<GuruSoalDto?> CreateSoalAsync(object payload, CancellationToken ct = default)
    {
        var body = ToJson(payload);
        body["op"] = "createSoal";
        var element = await PostRawAsync($"{Base}/soal", body, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<GuruSoalDto>(Opts)
            : null;
    }

    public async Task<bool> UpdateSoalAsync(object payload, CancellationToken ct = default)
    {
        var body = ToJson(payload);
        body["op"] = "updateSoal";
        return await PostSuccessAsync($"{Base}/soal", body, ct);
    }

    public Task<bool> DeleteSoalAsync(string id, CancellationToken ct = default) =>
        DeleteSuccessAsync($"{Base}/soal?id={Uri.EscapeDataString(id)}", ct);

    // ══════════════════ UJIAN ══════════════════

    public async Task<List<GuruUjianDto>> GetUjiansAsync(CancellationToken ct = default) =>
        await GetListAsync<GuruUjianDto>($"{Base}/ujian", ct);

    public Task<GuruUjianRefsDto?> GetUjianRefsAsync(CancellationToken ct = default) =>
        GetObjectAsync<GuruUjianRefsDto>($"{Base}/ujian?tab=refs", ct);

    public async Task<GuruUjianDto?> CreateUjianAsync(object payload, CancellationToken ct = default)
    {
        var body = ToJson(payload);
        body["op"] = "createUjian";
        var element = await PostRawAsync($"{Base}/ujian", body, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<GuruUjianDto>(Opts)
            : null;
    }

    public Task<bool> StartUjianAsync(string id, CancellationToken ct = default) => OpUjianAsync("startUjian", id, ct);
    public Task<bool> StopUjianAsync(string id, CancellationToken ct = default) => OpUjianAsync("stopUjian", id, ct);
    public Task<bool> ResetUjianAsync(string id, CancellationToken ct = default) => OpUjianAsync("resetUjian", id, ct);

    private async Task<bool> OpUjianAsync(string op, string id, CancellationToken ct)
    {
        var body = new JsonObject { ["op"] = op, ["id"] = id };
        return await PostSuccessAsync($"{Base}/ujian", body, ct);
    }

    public Task<bool> DeleteUjianAsync(string id, CancellationToken ct = default) =>
        DeleteSuccessAsync($"{Base}/ujian?id={Uri.EscapeDataString(id)}", ct);

    // ══════════════════ ANALITIK ══════════════════

    public async Task<GuruAnalitikDto> GetAnalitikAsync(CancellationToken ct = default) =>
        await GetObjectAsync<GuruAnalitikDto>($"{Base}/analitik", ct) ?? new GuruAnalitikDto();

    // ══════════════════ MATERI ══════════════════

    public async Task<List<GuruMateriDto>> GetMateriAsync(CancellationToken ct = default) =>
        await GetListAsync<GuruMateriDto>($"{Base}/materi", ct);

    public Task<bool> DeleteMateriAsync(string id, CancellationToken ct = default) =>
        DeleteSuccessAsync($"{Base}/materi?id={Uri.EscapeDataString(id)}", ct);

    // ══════════════════ NILAI ══════════════════

    public async Task<GuruNilaiResponseDto> GetNilaiAsync(CancellationToken ct = default) =>
        await GetObjectAsync<GuruNilaiResponseDto>($"{Base}/nilai", ct) ?? new GuruNilaiResponseDto();

    public async Task<List<GuruEssayDto>> GetEssaysAsync(string ujianId, CancellationToken ct = default) =>
        await GetListAsync<GuruEssayDto>($"{Base}/nilai?tab=essays&ujianId={Uri.EscapeDataString(ujianId)}", ct);

    public async Task<bool> GradeEssayAsync(string jawabanUjianId, double nilai, string? komentar, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["op"] = "gradeEssay",
            ["jawabanUjianId"] = jawabanUjianId,
            ["nilai"] = nilai,
        };
        if (!string.IsNullOrWhiteSpace(komentar)) body["komentar"] = komentar;
        return await PostSuccessAsync($"{Base}/nilai", body, ct);
    }

    // ══════════════════ ABSANSI GURU ══════════════════

    public async Task<AbsensiGuruDto> GetAbsensiAsync(string? tanggal = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(tanggal)
            ? $"{Base}/absensi"
            : $"{Base}/absensi?tanggal={Uri.EscapeDataString(tanggal)}";
        var element = await GetRawAsync(path, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<AbsensiGuruDto>(Opts) ?? new AbsensiGuruDto()
            : new AbsensiGuruDto();
    }

    public async Task<AbsensiGuruDto> SubmitAbsensiAsync(string? tanggal, string status, string? keterangan, CancellationToken ct = default)
    {
        var body = new JsonObject { ["status"] = status };
        if (!string.IsNullOrWhiteSpace(tanggal)) body["tanggal"] = tanggal;
        if (!string.IsNullOrWhiteSpace(keterangan)) body["keterangan"] = keterangan;
        var element = await PostRawAsync($"{Base}/absensi", body, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<AbsensiGuruDto>(Opts) ?? new AbsensiGuruDto()
            : new AbsensiGuruDto();
    }

    public async Task<AbsensiSiswaResponseDto> GetAbsensiSiswaAsync(string kelasId, string mataPelajaranId, string tanggal, CancellationToken ct = default)
    {
        var path = $"{Base}/absensi/siswa?kelasId={Uri.EscapeDataString(kelasId)}&mataPelajaranId={Uri.EscapeDataString(mataPelajaranId)}&tanggal={Uri.EscapeDataString(tanggal)}";
        var element = await GetRawAsync(path, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<AbsensiSiswaResponseDto>(Opts) ?? new AbsensiSiswaResponseDto()
            : new AbsensiSiswaResponseDto();
    }

    public async Task<bool> SubmitAbsensiSiswaAsync(string kelasId, string mataPelajaranId, string tanggal, List<(string siswaId, string status)> siswaStatus, CancellationToken ct = default)
    {
        var arr = new JsonArray();
        foreach (var (siswaId, status) in siswaStatus)
            arr.Add(new JsonObject { ["siswaId"] = siswaId, ["status"] = status });

        var body = new JsonObject
        {
            ["kelasId"] = kelasId,
            ["mataPelajaranId"] = mataPelajaranId,
            ["tanggal"] = tanggal,
            ["siswaStatus"] = arr,
        };
        return await PostSuccessAsync($"{Base}/absensi/siswa", body, ct);
    }

    // ══════════════════ PENGATURAN / PROFIL ══════════════════

    public Task<GuruProfilDto?> GetProfilAsync(CancellationToken ct = default) =>
        GetObjectAsync<GuruProfilDto>($"{Base}/pengaturan", ct);

    public async Task<bool> UpdateProfilAsync(object payload, CancellationToken ct = default)
    {
        var body = ToJson(payload);
        body["op"] = "updateProfile";
        return await PostSuccessAsync($"{Base}/pengaturan", body, ct);
    }

    public async Task<bool> UpdatePasswordAsync(string passwordLama, string passwordBaru, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["op"] = "updatePassword",
            ["passwordLama"] = passwordLama,
            ["passwordBaru"] = passwordBaru,
        };
        return await PostSuccessAsync($"{Base}/pengaturan", body, ct);
    }

    // ══════════════════ JADWAL & MAPEL ══════════════════

    public async Task<List<GuruJadwalDto>> GetJadwalAsync(string? tanggal = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(tanggal)
            ? $"{Base}/jadwal"
            : $"{Base}/jadwal?tanggal={Uri.EscapeDataString(tanggal)}";
        return await GetListAsync<GuruJadwalDto>(path, ct);
    }

    public async Task<List<MapelDto>> GetMapelAsync(CancellationToken ct = default) =>
        await GetListAsync<MapelDto>($"{Base}/mapel", ct);

    // ══════════════════ ANTI-CHEAT / INTERVENSI / PELANGGARAN ══════════════════

    public async Task<List<AntiCheatSessionDto>> GetAntiCheatAsync(CancellationToken ct = default) =>
        await GetListAsync<AntiCheatSessionDto>($"{Base}/anti-cheat", ct);

    public async Task<List<IntervensiDto>> GetIntervensiAsync(CancellationToken ct = default) =>
        await GetListAsync<IntervensiDto>($"{Base}/intervensi", ct);

    public async Task<List<PelanggaranDto>> GetPelanggaranAsync(CancellationToken ct = default) =>
        await GetListAsync<PelanggaranDto>($"{Base}/pelanggaran", ct);

    // ══════════════════ TEACHER ANALYTICS / AI ══════════════════

    public async Task<TeacherAnalyticsResponseDto> GetTeacherAnalyticsAsync(CancellationToken ct = default) =>
        await GetObjectAsync<TeacherAnalyticsResponseDto>($"{Base}/teacher-analytics", ct) ?? new TeacherAnalyticsResponseDto();

    public async Task<AiKnowledgeResponseDto> GetAiKnowledgeAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AiKnowledgeResponseDto>($"{Base}/ai-knowledge", ct) ?? new AiKnowledgeResponseDto();

    // ══════════════════ HELPERS ══════════════════

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        return TeacherJson.UnwrapList<T>(element);
    }

    private async Task<T?> GetObjectAsync<T>(string path, CancellationToken ct)
        where T : class
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private Task<JsonElement> GetRawAsync(string path, CancellationToken ct) =>
        _api.GetAsync<JsonElement>(path, Token(), ct);

    private Task<JsonElement> PostRawAsync(string path, object body, CancellationToken ct) =>
        _api.PostAsync<object, JsonElement>(path, body, Token(), ct);

    private async Task<bool> PostSuccessAsync(string path, object body, CancellationToken ct)
    {
        var element = await PostRawAsync(path, body, ct);
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty("success", out var s) &&
               s.ValueKind == JsonValueKind.True;
    }

    private async Task<bool> DeleteSuccessAsync(string path, CancellationToken ct)
    {
        await _api.DeleteAsync(path, Token(), ct);
        return true;
    }

    private static JsonObject ToJson(object payload)
    {
        var node = JsonSerializer.SerializeToNode(payload, payload.GetType(), Opts);
        return node as JsonObject ?? new JsonObject();
    }
}