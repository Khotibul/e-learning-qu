using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;

namespace E_LearningQu.Desktop.ViewModels;

// ─── BASE: daftar paginasi + search ──────────────────────────────────────────
public abstract partial class AdminPagedViewModel<TDto> : ObservableObject
{
    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private int page = 1;
    [ObservableProperty] private int totalPages = 1;
    [ObservableProperty] private int total;
    [ObservableProperty] private bool includeDeleted;
    [ObservableProperty] private bool isBusy;

    public ObservableCollection<TDto> Items { get; } = new();

    protected CancellationTokenSource? SearchCts;

    protected abstract Task<PagedResult<TDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct);

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        if (IsBusy) return;
        IsBusy = true; IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await FetchAsync(null, Page, IncludeDeleted, ct);
            Items.Clear();
            foreach (var item in result.Data) Items.Add(item);
            Total = result.Total; TotalPages = Math.Max(1, result.TotalPages);
            StatusMessage = $"{result.Total} data";
            DesktopLog.Log($"Load {GetType().Name}: total={result.Total} data={result.Data.Count} items={Items.Count} page={Page}");
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
            DesktopLog.Log($"Load FAIL {GetType().Name}: {ex}");
        }
        finally { IsLoading = false; IsBusy = false; }
    }

    [RelayCommand]
    public async Task SearchAsync(CancellationToken ct = default)
    {
        SearchCts?.Cancel();
        SearchCts = new CancellationTokenSource();
        try
        {
            await Task.Delay(300, SearchCts.Token);
            Page = 1;
            await LoadAsync(SearchCts.Token);
        }
        catch (OperationCanceledException) { }
    }

    [RelayCommand]
    public async Task NextPageAsync(CancellationToken ct = default)
    {
        if (Page >= TotalPages) return;
        Page++; await LoadAsync(ct);
    }

    [RelayCommand]
    public async Task PrevPageAsync(CancellationToken ct = default)
    {
        if (Page <= 1) return;
        Page--; await LoadAsync(ct);
    }

    [RelayCommand]
    public async Task HapusAsync(TDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        try
        {
            // Confirm before delete — subclass can override
            if (await ConfirmDeleteAsync(item, ct))
            {
                IsBusy = true;
                await DeleteCoreAsync(item, ct);
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    public async Task PulihkanAsync(TDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        try
        {
            IsBusy = true;
            await RestoreCoreAsync(item, ct);
            await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    protected virtual Task<bool> ConfirmDeleteAsync(TDto item, CancellationToken ct) => Task.FromResult(true);
    protected virtual Task DeleteCoreAsync(TDto item, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task RestoreCoreAsync(TDto item, CancellationToken ct) => Task.CompletedTask;

    partial void OnSearchTextChanged(string value) => _ = SearchAsync();
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
public partial class AdminDashboardViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private AdminDashboardStatsDto stats = new();
    [ObservableProperty] private string statusMessage = "";

    public AdminDashboardViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Stats = await _admin.GetDashboardStatsAsync(ct);
            StatusMessage = "Statistik sistem";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── GURU ────────────────────────────────────────────────────────────────────
public partial class AdminGuruViewModel : AdminPagedViewModel<AdminUserDto>
{
    private readonly IAdminService _admin;

    public AdminGuruViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminUserDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetGurusAsync(search, page, 10, includeDeleted, ct);

    protected override async Task<bool> ConfirmDeleteAsync(AdminUserDto item, CancellationToken ct) =>
        await DialogService.ConfirmAsync("Hapus Guru", $"Yakin hapus guru \"{item.Nama}\"? Data dapat dipulihkan.");

    protected override async Task DeleteCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.DeleteGuruAsync(item.Id, ct);

    protected override async Task RestoreCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.RestoreGuruAsync(item.Id, ct);

    [RelayCommand]
    public async Task ResetPasswordAsync(AdminUserDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        if (!await DialogService.ConfirmAsync("Reset Password", $"Reset password {item.Nama} ke default?")) return;
        try
        {
            IsBusy = true;
            if (await _admin.ResetGuruPasswordAsync(item.Id, ct))
                StatusMessage = $"Password {item.Nama} direset ke default";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }
}

// ─── MURID ───────────────────────────────────────────────────────────────────
public partial class AdminMuridViewModel : AdminPagedViewModel<AdminUserDto>
{
    private readonly IAdminService _admin;

    public AdminMuridViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminUserDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetMuridsAsync(search, page, 10, includeDeleted, null, ct);

    protected override async Task<bool> ConfirmDeleteAsync(AdminUserDto item, CancellationToken ct) =>
        await DialogService.ConfirmAsync("Hapus Murid", $"Yakin hapus murid \"{item.Nama}\"? Data dapat dipulihkan.");

    protected override async Task DeleteCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.DeleteMuridAsync(item.Id, ct);

    protected override async Task RestoreCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.RestoreMuridAsync(item.Id, ct);

    [RelayCommand]
    public async Task ResetPasswordAsync(AdminUserDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        if (!await DialogService.ConfirmAsync("Reset Password", $"Reset password {item.Nama} ke default?")) return;
        try
        {
            IsBusy = true;
            if (await _admin.ResetMuridPasswordAsync(item.Id, ct))
                StatusMessage = $"Password {item.Nama} direset ke default";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }
}

// ─── KELAS ───────────────────────────────────────────────────────────────────
public partial class AdminKelasViewModel : AdminPagedViewModel<KelasDto>
{
    private readonly IAdminService _admin;

    [ObservableProperty] private AdminRefsDto refs = new();

    public AdminKelasViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<KelasDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetKelassAsync(search, page, 10, ct);

    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { /* refs opsional */ }
    }

    [RelayCommand]
    public async Task DeleteAsync(KelasDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteKelasAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── MAPEL ───────────────────────────────────────────────────────────────────
public partial class AdminMapelViewModel : AdminPagedViewModel<MapelDto>
{
    private readonly IAdminService _admin;

    public AdminMapelViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<MapelDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetMapelsAsync(search, page, 10, ct);

    [RelayCommand]
    public async Task DeleteAsync(MapelDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteMapelAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── TAHUN AJARAN ────────────────────────────────────────────────────────────
public partial class AdminTahunAjaranViewModel : AdminPagedViewModel<TahunAjaranDto>
{
    private readonly IAdminService _admin;

    public AdminTahunAjaranViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<TahunAjaranDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetTahunAjaransAsync(search, page, 10, ct);

    [RelayCommand]
    public async Task SetActiveAsync(TahunAjaranDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.SetActiveTahunAjaranAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(TahunAjaranDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteTahunAjaranAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── SEMESTER ────────────────────────────────────────────────────────────────
public partial class AdminSemesterViewModel : AdminPagedViewModel<SemesterDto>
{
    private readonly IAdminService _admin;

    public AdminSemesterViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<SemesterDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetSemestersAsync(search, page, 10, null, ct);

    [RelayCommand]
    public async Task SetActiveAsync(SemesterDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.SetActiveSemesterAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(SemesterDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteSemesterAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── JURUSAN ─────────────────────────────────────────────────────────────────
public partial class AdminJurusanViewModel : AdminPagedViewModel<JurusanDto>
{
    private readonly IAdminService _admin;

    public AdminJurusanViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<JurusanDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetJurussansAsync(search, page, 10, ct);

    [RelayCommand]
    public async Task DeleteAsync(JurusanDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteJurusanAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── KOMPETENSI ──────────────────────────────────────────────────────────────
public partial class AdminKompetensiViewModel : AdminPagedViewModel<KompetensiDto>
{
    private readonly IAdminService _admin;

    public AdminKompetensiViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<KompetensiDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetKompetensisAsync(search, page, 10, null, null, ct);

    [RelayCommand]
    public async Task DeleteAsync(KompetensiDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteKompetensiAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── PENGUMUMAN ──────────────────────────────────────────────────────────────
public partial class AdminPengumumanViewModel : AdminPagedViewModel<PengumumanDto>
{
    private readonly IAdminService _admin;

    public AdminPengumumanViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<PengumumanDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetPengumumenAsync(page, 10, ct);

    [RelayCommand]
    public async Task DeleteAsync(PengumumanDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeletePengumumanAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── NILAI ───────────────────────────────────────────────────────────────────
public partial class AdminNilaiViewModel : AdminPagedViewModel<AdminNilaiDto>
{
    private readonly IAdminService _admin;

    public AdminNilaiViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminNilaiDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetNilaisAsync(null, null, null, page, 20, ct);
}

// ─── STATISTIK ───────────────────────────────────────────────────────────────
public partial class AdminStatistikViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private StatistikGuruMuridDto guruMurid = new();
    [ObservableProperty] private string statusMessage = "";

    public ObservableCollection<StatistikBarDto> PerKelas { get; } = new();
    public ObservableCollection<StatistikBarDto> PerMapel { get; } = new();

    public AdminStatistikViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            GuruMurid = await _admin.GetStatistikGuruMuridAsync(ct);
            var perKelas = await _admin.GetStatistikPerKelasAsync(ct);
            var perMapel = await _admin.GetStatistikPerMapelAsync(ct);
            PerKelas.Clear(); foreach (var k in perKelas) PerKelas.Add(k);
            PerMapel.Clear(); foreach (var m in perMapel) PerMapel.Add(m);
            StatusMessage = "Statistik akademik";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
