using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Academic;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Backend mobile kadang membalas array polos atau object wrapper ({ujians:[]}/{data:[]}) —
/// GetListAsync mentolerir kedua bentuk seperti client Flutter.
/// </summary>
public sealed class AkademikService : IAkademikService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public AkademikService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    public Task<List<UjianListItemDto>> GetUjiansAsync(CancellationToken ct = default) =>
        GetListAsync<UjianListItemDto>("/api/mobile/siswa/ujian", ct);

    public async Task<UjianDetailDto> GetUjianDetailAsync(string ujianId, CancellationToken ct = default) =>
        await _api.GetAsync<UjianDetailDto>($"/api/mobile/siswa/ujian/{ujianId}", Token(), ct);

    public async Task<UjianStartResponse> StartUjianAsync(string ujianId, CancellationToken ct = default) =>
        await _api.PostAsync<UjianStartResponse>($"/api/mobile/siswa/ujian/{ujianId}/start", Token(), ct);

    public async Task AutoSaveAsync(string ujianId, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default)
    {
        await _api.PostAsync<object, JsonElement>(
            $"/api/mobile/siswa/ujian/{ujianId}/auto-save",
            new { answers, raguRagu },
            Token(), ct);
    }

    public async Task<SubmitUjianResponse> SubmitUjianAsync(string ujianId, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default) =>
        await _api.PostAsync<SubmitUjianRequest, SubmitUjianResponse>(
            $"/api/mobile/siswa/ujian/{ujianId}/submit",
            new SubmitUjianRequest { Answers = answers, RaguRagu = raguRagu },
            Token(), ct);

    public Task<List<NilaiDto>> GetNilaiAsync(CancellationToken ct = default) =>
        GetListAsync<NilaiDto>("/api/mobile/siswa/nilai", ct);

    public Task<List<JadwalPelajaranDto>> GetJadwalAsync(CancellationToken ct = default) =>
        GetListAsync<JadwalPelajaranDto>("/api/mobile/siswa/jadwal-pelajaran", ct);

    public Task<List<MateriDto>> GetMateriAsync(CancellationToken ct = default) =>
        GetListAsync<MateriDto>("/api/mobile/siswa/materi", ct);

    public async Task<KehadiranResponseDto> GetKehadiranAsync(string? bulan = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrEmpty(bulan) ? "/api/mobile/siswa/kehadiran" : $"/api/mobile/siswa/kehadiran?bulan={bulan}";
        return await _api.GetAsync<KehadiranResponseDto>(path, Token(), ct);
    }

    public async Task AjukanAbsensiAsync(string tanggal, string tipe, string alasan, CancellationToken ct = default)
    {
        await _api.PostAsync<AjukanAbsensiRequest, JsonElement>(
            "/api/mobile/siswa/kehadiran",
            new AjukanAbsensiRequest { Tanggal = tanggal, Tipe = tipe, Alasan = alasan },
            Token(), ct);
    }

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
    {
        var token = Token();
        using var request = new HttpRequestMessage(HttpMethod.Get, path.TrimStart('/'));
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var element = await _api.GetAsync<JsonElement>(path, token, ct);
        return element.ValueKind switch
        {
            JsonValueKind.Array => element.Deserialize<List<T>>(JsonOpts) ?? new List<T>(),
            JsonValueKind.Object => TryUnwrapList<T>(element),
            _ => new List<T>()
        };
    }

    private static List<T> TryUnwrapList<T>(JsonElement obj)
    {
        foreach (var prop in obj.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Array)
                return prop.Value.Deserialize<List<T>>(JsonOpts) ?? new List<T>();
        }
        return new List<T>();
    }
}
