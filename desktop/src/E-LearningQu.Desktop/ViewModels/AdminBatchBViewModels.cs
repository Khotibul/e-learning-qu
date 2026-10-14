using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;

namespace E_LearningQu.Desktop.ViewModels;

// ═══════════════════════════════════════════════════════════════════════
// VM batch B: admin-courses, admin-jadwal, admin-santri, admin-ppdb, admin-izin.
// ═══════════════════════════════════════════════════════════════════════

// ─── Courses ────────────────────────────────────────────────────────────

public sealed partial class AdminCoursesViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string searchText = "";

    public ObservableCollection<CourseAdminDto> Items { get; } = new();

    public AdminCoursesViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetCoursesAsync(SearchText, ct: ct);
            Items.Clear();
            foreach (var c in result.Data) Items.Add(c);
            StatusMessage = $"{result.Total} course";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task DeleteCourseAsync(CourseAdminDto? course, CancellationToken ct = default)
    {
        if (course is null) return;
        try
        {
            if (await _admin.DeleteCourseAsync(course.Id, ct))
            {
                Items.Remove(course);
                StatusMessage = "Course dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Jadwal Pelajaran ────────────────────────────────────────────────────

public sealed partial class AdminJadwalViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    [ObservableProperty] private string selectedHari = "";
    [ObservableProperty] private string? selectedKelasId;
    [ObservableProperty] private string selectedKelasNama = "";
    [ObservableProperty] private string selectedMapelId = "";
    [ObservableProperty] private string selectedMapelNama = "";
    [ObservableProperty] private string jamMulai = "07:00";
    [ObservableProperty] private string jamSelesai = "08:30";

    public ObservableCollection<JadwalPelajaranDto> Rows { get; } = new();
    public ObservableCollection<KelasOptionDto> KelasOptions { get; } = new();
    public ObservableCollection<MapelOptionDto> MapelOptions { get; } = new();
    public ObservableCollection<string> HariOptions { get; } = new();

    public AdminJadwalViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetJadwalAsync(ct: ct);
            Rows.Clear();
            foreach (var r in result.Rows) Rows.Add(r);
            KelasOptions.Clear();
            foreach (var k in result.Kelas) KelasOptions.Add(k);
            MapelOptions.Clear();
            foreach (var m in result.Mapel) MapelOptions.Add(m);
            HariOptions.Clear();
            foreach (var h in result.HariList) HariOptions.Add(h);
            StatusMessage = $"{result.Rows.Count} jadwal";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task SimpanAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(SelectedKelasId) || string.IsNullOrWhiteSpace(SelectedMapelId) || string.IsNullOrWhiteSpace(SelectedHari))
        {
            ErrorMessage = "Kelas, mapel, dan hari wajib dipilih";
            return;
        }
        IsLoading = true; ErrorMessage = null;
        try
        {
            var created = await _admin.CreateJadwalAsync(SelectedKelasId!, SelectedMapelId, SelectedHari, JamMulai, JamSelesai, ct);
            if (created is not null)
            {
                StatusMessage = "Jadwal ditambahkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task DeleteAsync(JadwalPelajaranDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            if (await _admin.DeleteJadwalAsync(item.Id, ct))
            {
                Rows.Remove(item);
                StatusMessage = "Jadwal dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Santri ─────────────────────────────────────────────────────────────

public sealed partial class AdminSantriViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string searchText = "";

    [ObservableProperty] private string nama = "";
    [ObservableProperty] private string email = "";
    [ObservableProperty] private string password = "";
    [ObservableProperty] private string nisNo = "";

    public ObservableCollection<SantriAdminDto> Items { get; } = new();

    public AdminSantriViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetSantrisAsync(SearchText, ct: ct);
            Items.Clear();
            foreach (var s in result.Data) Items.Add(s);
            StatusMessage = $"{result.Total} santri · {result.Statistik.Count} status keberadaan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task TambahAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Nama) || string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Nama, email, dan password wajib diisi";
            return;
        }
        IsLoading = true; ErrorMessage = null;
        try
        {
            var ok = await _admin.CreateSantriNonformalAsync(Nama.Trim(), Email.Trim(), Password, string.IsNullOrWhiteSpace(NisNo) ? null : NisNo.Trim(), null, ct);
            if (ok)
            {
                Nama = ""; Email = ""; Password = ""; NisNo = "";
                StatusMessage = "Santri ditambahkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task DeleteAsync(SantriAdminDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            if (await _admin.DeleteSantriAsync(item.Id, ct))
            {
                Items.Remove(item);
                StatusMessage = "Santri dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task UbahKeberadaanAsync((SantriAdminDto item, string keberadaan) arg, CancellationToken ct = default)
    {
        var (item, keberadaan) = arg;
        if (item is null || string.IsNullOrWhiteSpace(keberadaan)) return;
        try
        {
            if (await _admin.UpdateKeberadaanSantriAsync(item.Id, keberadaan, null, ct))
            {
                item.Keberadaan = keberadaan;
                StatusMessage = $"Keberadaan → {keberadaan}";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── PPDB ───────────────────────────────────────────────────────────────

public sealed partial class AdminPpdbViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    [ObservableProperty] private string nama = "";
    [ObservableProperty] private string? selectedTahunAjaranId;
    [ObservableProperty] private string tanggalBuka = "";
    [ObservableProperty] private string tanggalTutup = "";

    public ObservableCollection<GelombangPpdbDto> Items { get; } = new();
    public ObservableCollection<TahunAjaranBriefDto> TahunAjaranOptions { get; } = new();

    public AdminPpdbViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetGelombangsAsync(ct: ct);
            Items.Clear();
            foreach (var g in result.Data) Items.Add(g);
            TahunAjaranOptions.Clear();
            foreach (var t in result.TahunAjaran) TahunAjaranOptions.Add(t);
            StatusMessage = $"{result.Total} gelombang";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task TambahAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Nama) || string.IsNullOrWhiteSpace(SelectedTahunAjaranId) || string.IsNullOrWhiteSpace(TanggalBuka) || string.IsNullOrWhiteSpace(TanggalTutup))
        {
            ErrorMessage = "Nama, tahun ajaran, tanggal buka & tutup wajib diisi";
            return;
        }
        IsLoading = true; ErrorMessage = null;
        try
        {
            var created = await _admin.CreateGelombangAsync(new GelombangPpdbCreateRequest
            {
                TahunAjaranId = SelectedTahunAjaranId!,
                Nama = Nama.Trim(),
                TanggalBuka = TanggalBuka,
                TanggalTutup = TanggalTutup,
            }, ct);
            if (created is not null)
            {
                Nama = ""; TanggalBuka = ""; TanggalTutup = "";
                StatusMessage = "Gelombang dibuat";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task UbahStatusAsync((GelombangPpdbDto item, string status) arg, CancellationToken ct = default)
    {
        var (item, status) = arg;
        if (item is null || string.IsNullOrWhiteSpace(status)) return;
        try
        {
            if (await _admin.UpdateStatusGelombangAsync(item.Id, status, ct))
            {
                item.Status = status;
                StatusMessage = $"Status → {status}";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(GelombangPpdbDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            if (await _admin.DeleteGelombangAsync(item.Id, ct))
            {
                Items.Remove(item);
                StatusMessage = "Gelombang dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Izin (admin) ───────────────────────────────────────────────────────

public sealed partial class AdminIzinViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private IzinStatistikDto statistik = new();

    public ObservableCollection<IzinAntreanDto> Antrean { get; } = new();
    public ObservableCollection<PengaturanIzinDto> Pengaturan { get; } = new();
    public ObservableCollection<AsramaDto> Asrama { get; } = new();

    public AdminIzinViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var antreanTask = _admin.GetIzinAntreanAsync(ct);
            var statTask = _admin.GetIzinStatistikAsync(ct);
            var pengaturanTask = _admin.GetPengaturanIzinAsync(ct);
            var asramaTask = _admin.GetAsramaAsync(ct);
            await Task.WhenAll(antreanTask, statTask, pengaturanTask, asramaTask);

            Statistik = await statTask;
            Antrean.Clear();
            foreach (var i in (await antreanTask).Rows) Antrean.Add(i);
            Pengaturan.Clear();
            foreach (var p in (await pengaturanTask).Data) Pengaturan.Add(p);
            Asrama.Clear();
            foreach (var a in (await asramaTask).Rows) Asrama.Add(a);
            StatusMessage = $"{Antrean.Count} menunggu · {Statistik.Menunggu} total menunggu";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task SetujuiAsync(IzinAntreanDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            if (await _admin.SetujuiIzinAsync(item.Id, null, ct))
            {
                Antrean.Remove(item);
                StatusMessage = "Izin disetujui";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TolakAsync((IzinAntreanDto item, string alasan) arg, CancellationToken ct = default)
    {
        var (item, alasan) = arg;
        if (item is null || string.IsNullOrWhiteSpace(alasan) || alasan.Trim().Length < 5)
        {
            ErrorMessage = "Alasan penolakan minimal 5 karakter";
            return;
        }
        try
        {
            if (await _admin.TolakIzinAsync(item.Id, alasan.Trim(), ct))
            {
                Antrean.Remove(item);
                StatusMessage = "Izin ditolak";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}
