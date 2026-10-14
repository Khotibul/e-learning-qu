using System.Text.Json;
using System.Text.Json.Nodes;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Contracts.Pondok;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Semua endpoint /api/mobile/pondok/* — guard pondok-rbac (scope-aware) di server.
/// Read lewat GET ?tab=..., mutasi lewat POST {op} (sudah map ke op gerbang/pengurus/ustadz).
/// </summary>
public sealed class PondokService : IPondokService
{
    private const string Base = "/api/mobile/pondok";
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public PondokService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    // ══════════════════ KEPALA PONDOK ══════════════════

    public async Task<KepalaDashboardDto> GetKepalaDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<KepalaDashboardDto>($"{Base}/kepala/dashboard", ct) ?? new KepalaDashboardDto();

    public async Task<PondokTabDto<KeberadaanSantriDto>> GetKeberadaanAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<KeberadaanSantriDto>>($"{Base}/kepala/data?tab=keberadaan", ct) ?? new();

    public async Task<PondokTabDto<KegiatanDto>> GetKegiatanAsync(string? dari = null, string? sampai = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "tab=kegiatan" };
        if (!string.IsNullOrWhiteSpace(dari)) qs.Add($"dari={Uri.EscapeDataString(dari)}");
        if (!string.IsNullOrWhiteSpace(sampai)) qs.Add($"sampai={Uri.EscapeDataString(sampai)}");
        return await GetObjectAsync<PondokTabDto<KegiatanDto>>($"{Base}/kepala/data?{string.Join("&", qs)}", ct) ?? new();
    }

    public async Task<PondokTabDto<IzinSantriDto>> GetIzinMenungguKepalaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<IzinSantriDto>>($"{Base}/kepala/data?tab=izin-menunggu", ct) ?? new();

    public async Task<PagedResult<IzinSantriDto>> GetIzinRiwayatAsync(int page = 1, CancellationToken ct = default) =>
        await GetPagedAsync<IzinSantriDto>($"{Base}/kepala/data?tab=izin-riwayat&page={page}", ct);

    public async Task<PondokTabDto<PengumumanDto>> GetPengumumanAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<PengumumanDto>>($"{Base}/kepala/data?tab=pengumuman", ct) ?? new();

    public async Task<PondokTabDto<PembinaanDto>> GetPembinaanAsync(string? status = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "tab=pembinaan" };
        if (!string.IsNullOrWhiteSpace(status)) qs.Add($"status={Uri.EscapeDataString(status)}");
        return await GetObjectAsync<PondokTabDto<PembinaanDto>>($"{Base}/kepala/data?{string.Join("&", qs)}", ct) ?? new();
    }

    public async Task<PondokTabDto<StatistikBarLaporanDto>> GetLaporanKepalaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<StatistikBarLaporanDto>>($"{Base}/kepala/data?tab=laporan", ct) ?? new();

    public async Task<bool> PutuskanIzinAsync(string izinId, string aksi, string? catatan, CancellationToken ct = default)
    {
        var element = await PostRawAsync($"{Base}/izin/{Uri.EscapeDataString(izinId)}/decision",
            new JsonObject { ["aksi"] = aksi, ["catatan"] = catatan }, ct);
        return IsSuccess(element);
    }

    // ══════════════════ KEUANGAN ══════════════════

    public async Task<KeuanganPondokDto> GetKeuanganAsync(int limit = 30, CancellationToken ct = default) =>
        await GetObjectAsync<KeuanganPondokDto>($"{Base}/keuangan?limit={limit}", ct) ?? new KeuanganPondokDto();

    // ══════════════════ GERBANG ══════════════════

    public async Task<PagedResult<GerbangAntreanDto>> GetGerbangAntreanAsync(int page = 1, int limit = 20, CancellationToken ct = default) =>
        await GetPagedAsync<GerbangAntreanDto>($"{Base}/gerbang?page={page}&limit={limit}", ct);

    public async Task<GerbangSearchDto> CariGerbangAsync(string q, CancellationToken ct = default) =>
        await GetObjectAsync<GerbangSearchDto>($"{Base}/gerbang?q={Uri.EscapeDataString(q)}", ct) ?? new GerbangSearchDto();

    public async Task<GerbangSearchDto> GetRiwayatGerbangAsync(string? dari = null, string? sampai = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "riwayat=1" };
        if (!string.IsNullOrWhiteSpace(dari)) qs.Add($"dari={Uri.EscapeDataString(dari)}");
        if (!string.IsNullOrWhiteSpace(sampai)) qs.Add($"sampai={Uri.EscapeDataString(sampai)}");
        return await GetObjectAsync<GerbangSearchDto>($"{Base}/gerbang?{string.Join("&", qs)}", ct) ?? new GerbangSearchDto();
    }

    public async Task<bool> CheckoutAsync(GerbangActionRequest request, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/gerbang", request, ct);

    public async Task<bool> CheckinAsync(string izinId, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/gerbang", new JsonObject { ["op"] = "checkin", ["izinId"] = izinId }, ct);

    // ══════════════════ USTADZ ══════════════════

    public async Task<UstadzDashboardDto> GetUstadzDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<UstadzDashboardDto>($"{Base}/ustadz?tab=dashboard", ct) ?? new UstadzDashboardDto();

    public async Task<List<KelasDiniyahDto>> GetUstadzJadwalAsync(CancellationToken ct = default) =>
        (await GetObjectAsync<UstadzJadwalDto>($"{Base}/ustadz?tab=jadwal", ct))?.Kelas ?? new List<KelasDiniyahDto>();

    public async Task<List<KelasDiniyahDto>> GetKelasDiniyahOptsAsync(CancellationToken ct = default) =>
        (await GetObjectAsync<PondokTabDto<KelasDiniyahDto>>($"{Base}/ustadz?tab=diniyah", ct))?.KelasOpt ?? new();

    public async Task<PondokTabDto<AbsensiDiniyahRowDto>> GetAbsensiDiniyahAsync(string kelasId, string tanggal, CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<AbsensiDiniyahRowDto>>($"{Base}/ustadz?tab=diniyah&kelasId={Uri.EscapeDataString(kelasId)}&tanggal={Uri.EscapeDataString(tanggal)}", ct) ?? new();

    public async Task<List<HalaqahDto>> GetHalaqahOptsAsync(CancellationToken ct = default) =>
        (await GetObjectAsync<PondokTabDto<HalaqahDto>>($"{Base}/ustadz?tab=halaqah", ct))?.HalaqahOpt ?? new();

    public async Task<PagedResult<SetoranDto>> GetSetoranHalaqahAsync(string halaqahId, int page = 1, CancellationToken ct = default) =>
        await GetPagedAsync<SetoranDto>($"{Base}/ustadz?tab=halaqah&halaqahId={Uri.EscapeDataString(halaqahId)}&page={page}", ct);

    public async Task<bool> CatatSetoranAsync(object request, CancellationToken ct = default) =>
        await PostObjectAsync<SetoranDto>($"{Base}/ustadz", WithOp("catatSetoran", request), ct) != null;

    public async Task<PondokTabDto<IzinSantriDto>> GetIzinSantriBinaanAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<IzinSantriDto>>($"{Base}/ustadz?tab=izin", ct) ?? new();

    public async Task<bool> RekomendasiIzinAsync(string izinId, string rekomendasi, string catatan, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/ustadz", new JsonObject
        {
            ["op"] = "rekomendasiIzin",
            ["izinId"] = izinId,
            ["rekomendasi"] = rekomendasi,
            ["catatan"] = catatan,
        }, ct);

    public async Task<UstadzTabDto<StatistikBarLaporanDto>> GetLaporanUstadzAsync(CancellationToken ct = default) =>
        await GetObjectAsync<UstadzTabDto<StatistikBarLaporanDto>>($"{Base}/ustadz?tab=laporan", ct) ?? new();

    // ══════════════════ PENGURUS ══════════════════

    public async Task<PengurusDashboardDto> GetPengurusDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PengurusDashboardDto>($"{Base}/pengurus?tab=dashboard", ct) ?? new PengurusDashboardDto();

    public async Task<PondokTabDto<SantriRingkasDto>> GetSantriBinaanAsync(string? q = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "tab=santri" };
        if (!string.IsNullOrWhiteSpace(q)) qs.Add($"q={Uri.EscapeDataString(q)}");
        return await GetObjectAsync<PondokTabDto<SantriRingkasDto>>($"{Base}/pengurus?{string.Join("&", qs)}", ct) ?? new();
    }

    public async Task<PondokTabDto<IzinSantriDto>> GetAntreanIzinPengurusAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<IzinSantriDto>>($"{Base}/pengurus?tab=izin&mode=antrean", ct) ?? new();

    public async Task<PondokTabDto<IzinSantriDto>> GetIzinPulangPengurusAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<IzinSantriDto>>($"{Base}/pengurus?tab=izin&mode=pulang", ct) ?? new();

    public async Task<bool> SetujuiIzinPengurusAsync(string izinId, string? catatan, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/pengurus", new JsonObject { ["op"] = "setujuiIzin", ["izinId"] = izinId, ["catatan"] = catatan }, ct);

    public async Task<bool> TolakIzinPengurusAsync(string izinId, string alasan, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/pengurus", new JsonObject { ["op"] = "tolakIzin", ["izinId"] = izinId, ["alasan"] = alasan }, ct);

    public async Task<List<KegiatanDto>> GetKegiatanPengurusAsync(string? tanggal = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "tab=kegiatan" };
        if (!string.IsNullOrWhiteSpace(tanggal)) qs.Add($"tanggal={Uri.EscapeDataString(tanggal)}");
        var tab = await GetObjectAsync<PondokTabDto<KegiatanDto>>($"{Base}/pengurus?{string.Join("&", qs)}", ct);
        return tab?.Rows ?? new List<KegiatanDto>();
    }

    public async Task<List<AsramaDto>> GetAsramaAsync(CancellationToken ct = default) =>
        (await GetObjectAsync<PondokTabDto<AsramaDto>>($"{Base}/pengurus?tab=asrama", ct))?.Rows ?? new();

    public async Task<PondokTabDto<PembinaanDto>> GetPembinaanPengurusAsync(string? santriId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "tab=pembinaan" };
        if (!string.IsNullOrWhiteSpace(santriId)) qs.Add($"santriId={Uri.EscapeDataString(santriId)}");
        return await GetObjectAsync<PondokTabDto<PembinaanDto>>($"{Base}/pengurus?{string.Join("&", qs)}", ct) ?? new();
    }

    public async Task<PondokTabDto<PengumumanDto>> GetPengumumanPengurusAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PondokTabDto<PengumumanDto>>($"{Base}/pengurus?tab=pengumuman", ct) ?? new();

    public async Task<UstadzTabDto<StatistikBarLaporanDto>> GetLaporanPengurusAsync(CancellationToken ct = default) =>
        await GetObjectAsync<UstadzTabDto<StatistikBarLaporanDto>>($"{Base}/pengurus?tab=laporan", ct) ?? new();

    // ══════════════════ HELPERS ══════════════════

    private sealed class UstadzJadwalDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("kelas")] public List<KelasDiniyahDto>? Kelas { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("halaqah")] public List<HalaqahDto>? Halaqah { get; set; }
    }

    /// <summary>Bungkus body mutasi dengan field `op` yang dibaca route handler pondok.</summary>
    private static object WithOp(string op, object body)
    {
        var node = JsonSerializer.SerializeToNode(body, Opts)?.AsObject() ?? new JsonObject();
        node["op"] = op;
        return node;
    }

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<PagedResult<T>> GetPagedAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return new PagedResult<T>();
        var result = element.Deserialize<PagedResult<T>>(Opts) ?? new PagedResult<T>();
        if (result.Data.Count == 0 && element.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array)
            result = result with { Data = rows.Deserialize<List<T>>(Opts) ?? new List<T>() };
        return result;
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

    private async Task<bool> PostSuccessAsync(string path, object body, CancellationToken ct)
    {
        var element = await PostRawAsync(path, body, ct);
        return IsSuccess(element);
    }

    private static bool IsSuccess(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;

    private Task<JsonElement> GetRawAsync(string path, CancellationToken ct) =>
        _api.GetAsync<JsonElement>(path, Token(), ct);

    private Task<JsonElement> PostRawAsync(string path, object body, CancellationToken ct) =>
        _api.PostAsync<object, JsonElement>(path, body, Token(), ct);
}
