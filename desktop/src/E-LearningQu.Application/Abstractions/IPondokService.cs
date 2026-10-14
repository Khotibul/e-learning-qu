using E_LearningQu.Contracts.Common;
using E_LearningQu.Contracts.Pondok;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// API pondok — semua lewat /api/mobile/pondok/* (guard pondok-rbac, scope-aware).
/// Pola tab mengikuti route handler: GET ?tab=... untuk read, POST {op} untuk mutasi.
/// </summary>
public interface IPondokService
{
    // ── Kepala Pondok ──
    Task<KepalaDashboardDto> GetKepalaDashboardAsync(CancellationToken ct = default);
    Task<PondokTabDto<KeberadaanSantriDto>> GetKeberadaanAsync(CancellationToken ct = default);
    Task<PondokTabDto<KegiatanDto>> GetKegiatanAsync(string? dari = null, string? sampai = null, CancellationToken ct = default);
    Task<PondokTabDto<IzinSantriDto>> GetIzinMenungguKepalaAsync(CancellationToken ct = default);
    Task<PagedResult<IzinSantriDto>> GetIzinRiwayatAsync(int page = 1, CancellationToken ct = default);
    Task<PondokTabDto<PengumumanDto>> GetPengumumanAsync(CancellationToken ct = default);
    Task<PondokTabDto<PembinaanDto>> GetPembinaanAsync(string? status = null, CancellationToken ct = default);
    Task<PondokTabDto<StatistikBarLaporanDto>> GetLaporanKepalaAsync(CancellationToken ct = default);
    Task<bool> PutuskanIzinAsync(string izinId, string aksi, string? catatan, CancellationToken ct = default);

    // ── Keuangan ──
    Task<KeuanganPondokDto> GetKeuanganAsync(int limit = 30, CancellationToken ct = default);

    // ── Gerbang ──
    Task<PagedResult<GerbangAntreanDto>> GetGerbangAntreanAsync(int page = 1, int limit = 20, CancellationToken ct = default);
    Task<GerbangSearchDto> CariGerbangAsync(string q, CancellationToken ct = default);
    Task<GerbangSearchDto> GetRiwayatGerbangAsync(string? dari = null, string? sampai = null, CancellationToken ct = default);
    Task<bool> CheckoutAsync(GerbangActionRequest request, CancellationToken ct = default);
    Task<bool> CheckinAsync(string izinId, CancellationToken ct = default);

    // ── Ustadz ──
    Task<UstadzDashboardDto> GetUstadzDashboardAsync(CancellationToken ct = default);
    Task<List<KelasDiniyahDto>> GetUstadzJadwalAsync(CancellationToken ct = default);
    Task<List<KelasDiniyahDto>> GetKelasDiniyahOptsAsync(CancellationToken ct = default);
    Task<PondokTabDto<AbsensiDiniyahRowDto>> GetAbsensiDiniyahAsync(string kelasId, string tanggal, CancellationToken ct = default);
    Task<List<HalaqahDto>> GetHalaqahOptsAsync(CancellationToken ct = default);
    Task<PagedResult<SetoranDto>> GetSetoranHalaqahAsync(string halaqahId, int page = 1, CancellationToken ct = default);
    Task<bool> CatatSetoranAsync(object request, CancellationToken ct = default);
    Task<PondokTabDto<IzinSantriDto>> GetIzinSantriBinaanAsync(CancellationToken ct = default);
    Task<bool> RekomendasiIzinAsync(string izinId, string rekomendasi, string catatan, CancellationToken ct = default);
    Task<UstadzTabDto<StatistikBarLaporanDto>> GetLaporanUstadzAsync(CancellationToken ct = default);

    // ── Pengurus ──
    Task<PengurusDashboardDto> GetPengurusDashboardAsync(CancellationToken ct = default);
    Task<PondokTabDto<SantriRingkasDto>> GetSantriBinaanAsync(string? q = null, CancellationToken ct = default);
    Task<PondokTabDto<IzinSantriDto>> GetAntreanIzinPengurusAsync(CancellationToken ct = default);
    Task<PondokTabDto<IzinSantriDto>> GetIzinPulangPengurusAsync(CancellationToken ct = default);
    Task<bool> SetujuiIzinPengurusAsync(string izinId, string? catatan, CancellationToken ct = default);
    Task<bool> TolakIzinPengurusAsync(string izinId, string alasan, CancellationToken ct = default);
    Task<List<KegiatanDto>> GetKegiatanPengurusAsync(string? tanggal = null, CancellationToken ct = default);
    Task<List<AsramaDto>> GetAsramaAsync(CancellationToken ct = default);
    Task<PondokTabDto<PembinaanDto>> GetPembinaanPengurusAsync(string? santriId = null, CancellationToken ct = default);
    Task<PondokTabDto<PengumumanDto>> GetPengumumanPengurusAsync(CancellationToken ct = default);
    Task<UstadzTabDto<StatistikBarLaporanDto>> GetLaporanPengurusAsync(CancellationToken ct = default);
}
