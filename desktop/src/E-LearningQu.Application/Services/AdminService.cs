using System.Text.Json;
using System.Text.Json.Nodes;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Semua endpoint /api/mobile/admin/* — guard ADMIN di server. Mengikuti pola respons audit route.ts:
/// envelope paginasi {data,total,page,limit,totalPages}, objek tunggal, atau array mentah.
/// </summary>
public sealed class AdminService : IAdminService
{
    private const string Base = "/api/mobile/admin";
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public AdminService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    // ══════════════════ DASHBOARD ══════════════════

    public async Task<AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AdminDashboardStatsDto>($"{Base}/dashboard", ct) ?? new AdminDashboardStatsDto();

    // ══════════════════ GURU ══════════════════

    public async Task<PagedResult<AdminUserDto>> GetGurusAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (includeDeleted) qs.Add("includeDeleted=true");
        return await GetPagedAsync<AdminUserDto>($"{Base}/guru?{string.Join("&", qs)}", ct);
    }

    public Task<AdminUserDto?> GetGuruAsync(string id, CancellationToken ct = default) =>
        GetObjectAsync<AdminUserDto>($"{Base}/guru/{Uri.EscapeDataString(id)}", ct);

    public Task<AdminUserDto?> CreateGuruAsync(AdminCreateUserRequest request, CancellationToken ct = default) =>
        PostObjectAsync<AdminUserDto>($"{Base}/guru", request, ct);

    public Task<AdminUserDto?> UpdateGuruAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<AdminUserDto>($"{Base}/guru/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteGuruAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> RestoreGuruAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "restore" }, ct);

    public async Task<bool> ResetGuruPasswordAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "resetPassword" }, ct);

    // ══════════════════ MURID ══════════════════

    public async Task<PagedResult<AdminUserDto>> GetMuridsAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, string? kelasId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (includeDeleted) qs.Add("includeDeleted=true");
        if (!string.IsNullOrWhiteSpace(kelasId)) qs.Add($"kelasId={Uri.EscapeDataString(kelasId)}");
        return await GetPagedAsync<AdminUserDto>($"{Base}/murid?{string.Join("&", qs)}", ct);
    }

    public Task<AdminUserDto?> GetMuridAsync(string id, CancellationToken ct = default) =>
        GetObjectAsync<AdminUserDto>($"{Base}/murid/{Uri.EscapeDataString(id)}", ct);

    public Task<AdminUserDto?> CreateMuridAsync(AdminCreateUserRequest request, CancellationToken ct = default) =>
        PostObjectAsync<AdminUserDto>($"{Base}/murid", request, ct);

    public Task<AdminUserDto?> UpdateMuridAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<AdminUserDto>($"{Base}/murid/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteMuridAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> RestoreMuridAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "restore" }, ct);

    public async Task<bool> ResetMuridPasswordAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "resetPassword" }, ct);

    // ══════════════════ KELAS ══════════════════

    public async Task<PagedResult<KelasDto>> GetKelassAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<KelasDto>($"{Base}/kelas?{string.Join("&", qs)}", ct);
    }

    public Task<KelasDto?> CreateKelasAsync(KelasCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<KelasDto>($"{Base}/kelas", request, ct);

    public Task<KelasDto?> UpdateKelasAsync(string id, KelasUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<KelasDto>($"{Base}/kelas/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteKelasAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/kelas/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    // ══════════════════ MAPEL ══════════════════

    public async Task<PagedResult<MapelDto>> GetMapelsAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<MapelDto>($"{Base}/mapel?{string.Join("&", qs)}", ct);
    }

    public Task<MapelDto?> CreateMapelAsync(MapelCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<MapelDto>($"{Base}/mapel", request, ct);

    public Task<MapelDto?> UpdateMapelAsync(string id, MapelUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<MapelDto>($"{Base}/mapel/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteMapelAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> AddPengajaranAsync(string mapelId, string guruId, string kelasId, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(mapelId)}", new JsonObject
        {
            ["op"] = "addPengajaran",
            ["guruId"] = guruId,
            ["kelasId"] = kelasId,
        }, ct);

    public async Task<bool> RemovePengajaranAsync(string mapelId, string pengajaranId, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(mapelId)}", new JsonObject
        {
            ["op"] = "removePengajaran",
            ["pengajaranId"] = pengajaranId,
        }, ct);

    // ══════════════════ TAHUN AJARAN ══════════════════

    public async Task<PagedResult<TahunAjaranDto>> GetTahunAjaransAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<TahunAjaranDto>($"{Base}/tahun-ajaran?{string.Join("&", qs)}", ct);
    }

    public Task<TahunAjaranDto?> CreateTahunAjaranAsync(TahunAjaranCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<TahunAjaranDto>($"{Base}/tahun-ajaran", request, ct);

    public Task<TahunAjaranDto?> UpdateTahunAjaranAsync(string id, TahunAjaranUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<TahunAjaranDto>($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteTahunAjaranAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> SetActiveTahunAjaranAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "setActive" }, ct);

    // ══════════════════ SEMESTER ══════════════════

    public async Task<PagedResult<SemesterDto>> GetSemestersAsync(string? search = null, int page = 1, int limit = 10, string? tahunAjaranId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(tahunAjaranId)) qs.Add($"tahunAjaranId={Uri.EscapeDataString(tahunAjaranId)}");
        return await GetPagedAsync<SemesterDto>($"{Base}/semester?{string.Join("&", qs)}", ct);
    }

    public Task<SemesterDto?> CreateSemesterAsync(SemesterCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<SemesterDto>($"{Base}/semester", request, ct);

    public Task<SemesterDto?> UpdateSemesterAsync(string id, SemesterUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<SemesterDto>($"{Base}/semester/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteSemesterAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/semester/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> SetActiveSemesterAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/semester/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "setActive" }, ct);

    // ══════════════════ JURUSAN ══════════════════

    public async Task<PagedResult<JurusanDto>> GetJurussansAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<JurusanDto>($"{Base}/jurusan?{string.Join("&", qs)}", ct);
    }

    public Task<JurusanDto?> CreateJurusanAsync(JurusanCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<JurusanDto>($"{Base}/jurusan", request, ct);

    public Task<JurusanDto?> UpdateJurusanAsync(string id, JurusanUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<JurusanDto>($"{Base}/jurusan/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteJurusanAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/jurusan/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<List<JurusanSiswaDto>> GetJurusanSiswaAsync(string jurusanId, CancellationToken ct = default)
    {
        var element = await GetRawAsync($"{Base}/jurusan/{Uri.EscapeDataString(jurusanId)}", ct);
        return element.ValueKind == JsonValueKind.Array
            ? element.Deserialize<List<JurusanSiswaDto>>(Opts) ?? new List<JurusanSiswaDto>()
            : new List<JurusanSiswaDto>();
    }

    public async Task<bool> AssignSiswaToJurusanAsync(string jurusanId, List<string> siswaIds, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/jurusan/{Uri.EscapeDataString(jurusanId)}", new JsonObject
        {
            ["op"] = "assignSiswa",
            ["siswaIds"] = JsonSerializer.SerializeToNode(siswaIds, Opts)!,
        }, ct);

    // ══════════════════ KOMPETENSI ══════════════════

    public async Task<PagedResult<KompetensiDto>> GetKompetensisAsync(string? search = null, int page = 1, int limit = 10, string? jurusanId = null, string? mapelId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(jurusanId)) qs.Add($"jurusanId={Uri.EscapeDataString(jurusanId)}");
        if (!string.IsNullOrWhiteSpace(mapelId)) qs.Add($"mapelId={Uri.EscapeDataString(mapelId)}");
        return await GetPagedAsync<KompetensiDto>($"{Base}/kompetensi?{string.Join("&", qs)}", ct);
    }

    public Task<KompetensiDto?> CreateKompetensiAsync(KompetensiCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<KompetensiDto>($"{Base}/kompetensi", request, ct);

    public Task<KompetensiDto?> UpdateKompetensiAsync(string id, KompetensiUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<KompetensiDto>($"{Base}/kompetensi/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteKompetensiAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/kompetensi/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    // ══════════════════ PENGUMUMAN ══════════════════

    public async Task<PagedResult<PengumumanDto>> GetPengumumenAsync(int page = 1, int limit = 10, CancellationToken ct = default) =>
        await GetPagedAsync<PengumumanDto>($"{Base}/pengumuman?page={page}&limit={limit}", ct);

    public Task<PengumumanDto?> CreatePengumumanAsync(PengumumanCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<PengumumanDto>($"{Base}/pengumuman", request, ct);

    public async Task<bool> DeletePengumumanAsync(string id, CancellationToken ct = default)
    {
        var element = await PatchRawAsync($"{Base}/pengumuman/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);
        return IsSuccess(element);
    }

    // ══════════════════ NILAI ══════════════════

    public async Task<PagedResult<AdminNilaiDto>> GetNilaisAsync(string? kelasId = null, string? mapelId = null, string? semesterId = null, int page = 1, int limit = 20, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(kelasId)) qs.Add($"kelasId={Uri.EscapeDataString(kelasId)}");
        if (!string.IsNullOrWhiteSpace(mapelId)) qs.Add($"mapelId={Uri.EscapeDataString(mapelId)}");
        if (!string.IsNullOrWhiteSpace(semesterId)) qs.Add($"semesterId={Uri.EscapeDataString(semesterId)}");
        return await GetPagedAsync<AdminNilaiDto>($"{Base}/nilai?{string.Join("&", qs)}", ct);
    }

    // ══════════════════ STATISTIK ══════════════════

    public async Task<StatistikGuruMuridDto> GetStatistikGuruMuridAsync(CancellationToken ct = default) =>
        await GetObjectAsync<StatistikGuruMuridDto>($"{Base}/statistik", ct) ?? new StatistikGuruMuridDto();

    public async Task<List<StatistikBarDto>> GetStatistikPerKelasAsync(CancellationToken ct = default) =>
        await GetListAsync<StatistikBarDto>($"{Base}/statistik/per-kelas", ct);

    public async Task<List<StatistikBarDto>> GetStatistikPerMapelAsync(CancellationToken ct = default) =>
        await GetListAsync<StatistikBarDto>($"{Base}/statistik/per-mapel", ct);

    // ══════════════════ REFS ══════════════════

    public async Task<AdminRefsDto> GetRefsAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AdminRefsDto>($"{Base}/refs", ct) ?? new AdminRefsDto();

    // ══════════════════ HELPERS ══════════════════

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<PagedResult<T>> GetPagedAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        return element.ValueKind == JsonValueKind.Object && !element.TryGetProperty("error", out _)
            ? element.Deserialize<PagedResult<T>>(Opts) ?? new PagedResult<T>()
            : new PagedResult<T>();
    }

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        return element.ValueKind == JsonValueKind.Array
            ? element.Deserialize<List<T>>(Opts) ?? new List<T>()
            : new List<T>();
    }

    private async Task<T?> GetObjectAsync<T>(string path, CancellationToken ct)
        where T : class
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<T?> PostObjectAsync<T>(string path, object body, CancellationToken ct)
        where T : class
    {
        var element = await PostRawAsync(path, body, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<T?> PatchObjectAsync<T>(string path, object body, CancellationToken ct)
        where T : class
    {
        var element = await PatchRawAsync(path, body, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<bool> PatchSuccessAsync(string path, object body, CancellationToken ct)
    {
        var element = await PatchRawAsync(path, body, ct);
        return IsSuccess(element);
    }

    private static bool IsSuccess(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;

    private Task<JsonElement> GetRawAsync(string path, CancellationToken ct) =>
        _api.GetAsync<JsonElement>(path, Token(), ct);

    private Task<JsonElement> PostRawAsync(string path, object body, CancellationToken ct) =>
        _api.PostAsync<object, JsonElement>(path, body, Token(), ct);

    private Task<JsonElement> PatchRawAsync(string path, object body, CancellationToken ct) =>
        _api.PatchAsync<object, JsonElement>(path, body, Token(), ct);
}
