using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;

namespace E_LearningQu.Desktop.ViewModels;

// ═══════════════════════════════════════════════════════════════════════
// VM batch 2: admin-pengaturan, admin-jadwal-ujian, admin-researcher.
// ═══════════════════════════════════════════════════════════════════════

// ─── Pengaturan (site-config + landing features) ────────────────────────

public sealed partial class AdminPengaturanViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private SiteConfigDto config = new();

    [ObservableProperty] private string siteName = "";
    [ObservableProperty] private string tagline = "";
    [ObservableProperty] private string description = "";
    [ObservableProperty] private string? logoUrl;
    [ObservableProperty] private string? faviconUrl;
    [ObservableProperty] private string aboutTitle = "";
    [ObservableProperty] private string aboutText = "";

    public ObservableCollection<LandingFeatureDto> Features { get; } = new();

    [ObservableProperty] private string featureTitle = "";
    [ObservableProperty] private string featureDescription = "";
    [ObservableProperty] private string featureIcon = "FileText";

    public AdminPengaturanViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Config = await _admin.GetSiteConfigAsync(ct);
            SiteName = Config.SiteName;
            Tagline = Config.Tagline;
            Description = Config.Description;
            LogoUrl = Config.LogoUrl;
            FaviconUrl = Config.FaviconUrl;
            AboutTitle = Config.AboutTitle ?? "";
            AboutText = Config.AboutText ?? "";
            var features = await _admin.GetFeaturesAsync(ct);
            Features.Clear();
            foreach (var f in features) Features.Add(f);
            StatusMessage = $"{Features.Count} fitur landing";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task SimpanConfigAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var saved = await _admin.SaveSiteConfigAsync(new SiteConfigUpdateRequest
            {
                SiteName = SiteName,
                Tagline = Tagline,
                Description = Description,
                LogoUrl = LogoUrl,
                FaviconUrl = FaviconUrl,
                AboutTitle = AboutTitle,
                AboutText = AboutText,
            }, ct);
            if (saved is null) ErrorMessage = "Gagal menyimpan konfigurasi";
            else { Config = saved; StatusMessage = "Konfigurasi tersimpan"; }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task TambahFiturAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(FeatureTitle) || string.IsNullOrWhiteSpace(FeatureDescription))
        {
            ErrorMessage = "Title dan description wajib diisi";
            return;
        }
        try
        {
            var created = await _admin.SaveFeatureAsync(new LandingFeatureRequest
            {
                Title = FeatureTitle.Trim(),
                Description = FeatureDescription.Trim(),
                Icon = string.IsNullOrWhiteSpace(FeatureIcon) ? "FileText" : FeatureIcon.Trim(),
                Order = Features.Count,
                IsActive = true,
            }, ct);
            if (created is not null)
            {
                Features.Add(created);
                FeatureTitle = ""; FeatureDescription = ""; FeatureIcon = "FileText";
                StatusMessage = "Fitur ditambahkan";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task HapusFiturAsync(LandingFeatureDto? feature, CancellationToken ct = default)
    {
        if (feature is null) return;
        try
        {
            var ok = await _admin.DeleteFeatureAsync(feature.Id, ct);
            if (ok) { Features.Remove(feature); StatusMessage = "Fitur dihapus"; }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Jadwal Ujian (read-only) ───────────────────────────────────────────

public sealed partial class AdminJadwalUjianViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private UjianStatsDto stats = new();

    public ObservableCollection<UjianAdminDto> Items { get; } = new();

    public AdminJadwalUjianViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetJadwalUjianAsync(ct);
            Stats = result.Stats ?? new UjianStatsDto();
            Items.Clear();
            foreach (var u in result.Rows) Items.Add(u);
            StatusMessage = $"{result.Rows.Count} ujian";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── Researcher analytics (read-only) ───────────────────────────────────

public sealed partial class AdminResearcherViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private ResearcherOverviewDto data = new();

    public ObservableCollection<DistribusiNilaiDto> Distribusi { get; } = new();
    public ObservableCollection<MasteryDto> Mastery { get; } = new();
    public ObservableCollection<AgentPerformanceDto> Agents { get; } = new();
    public ObservableCollection<DropoutRiskDto> DropoutRisk { get; } = new();
    public ObservableCollection<TrenAktivitasDto> Tren { get; } = new();

    public AdminResearcherViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _admin.GetResearcherOverviewAsync(ct);
            Distribusi.Clear();
            foreach (var d in Data.DistribusiNilai) Distribusi.Add(d);
            Mastery.Clear();
            foreach (var m in Data.Mastery.Take(30)) Mastery.Add(m);
            Agents.Clear();
            foreach (var a in Data.AgentPerformance) Agents.Add(a);
            DropoutRisk.Clear();
            foreach (var d in Data.DropoutRisk.Take(20)) DropoutRisk.Add(d);
            Tren.Clear();
            foreach (var t in Data.TrenAktivitas) Tren.Add(t);
            StatusMessage = Data.Overview is null
                ? ""
                : $"{Data.Overview.TotalSiswa} siswa · {Data.Overview.TotalUjian} ujian · rata-rata {Data.Overview.RataNilai?.ToString("0.0") ?? "-"}";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
