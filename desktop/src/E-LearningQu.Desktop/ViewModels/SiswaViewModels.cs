using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Siswa;

namespace E_LearningQu.Desktop.ViewModels;

// ─── SISWA UJIAN ─────────────────────────────────────────────────────────────
public partial class SiswaUjianViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaUjianDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaUjianViewModel(ISiswaService siswa) => _siswa = siswa;

    public event EventHandler<SiswaUjianDto>? BukaUjian;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetUjiansAsync(ct);
            Items.Clear();
            foreach (var u in list) Items.Add(u);
            StatusMessage = $"{Items.Count} ujian";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private void Buka(SiswaUjianDto ujian) => BukaUjian?.Invoke(this, ujian);
}

// ─── SISWA LATIHAN ───────────────────────────────────────────────────────────
public partial class SiswaLatihanViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaUjianDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaLatihanViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetLatihanAsync(ct);
            Items.Clear();
            foreach (var l in list) Items.Add(l);
            StatusMessage = $"{Items.Count} latihan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA MATERI ────────────────────────────────────────────────────────────
public partial class SiswaMateriViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaMateriDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaMateriViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetMateriAsync(ct);
            Items.Clear();
            foreach (var m in list) Items.Add(m);
            StatusMessage = $"{Items.Count} materi";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA NILAI ─────────────────────────────────────────────────────────────
public partial class SiswaNilaiViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaNilaiDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaNilaiViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetNilaiAsync(ct);
            Items.Clear();
            foreach (var n in list) Items.Add(n);
            StatusMessage = $"{Items.Count} nilai";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA RANKING ───────────────────────────────────────────────────────────
public partial class SiswaRankingViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<RankingItemDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaRankingViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var resp = await _siswa.GetRankingAsync(ct);
            Items.Clear();
            foreach (var r in resp.Ranking) Items.Add(r);
            StatusMessage = $"{Items.Count} siswa";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA ABSENSI ───────────────────────────────────────────────────────────
public partial class SiswaAbsensiViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaAbsensiDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaAbsensiViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetAbsensiAsync(null, null, ct);
            Items.Clear();
            foreach (var a in list) Items.Add(a);
            StatusMessage = $"{Items.Count} absensi";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA KEHADIRAN ─────────────────────────────────────────────────────────
public partial class SiswaKehadiranViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private KehadiranResponseDto2? data;
    [ObservableProperty] private string statusMessage = "";

    public SiswaKehadiranViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _siswa.GetKehadiranAsync(null, ct);
            StatusMessage = $"Rekap bulan {Data?.Bulan ?? "-"}";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA JADWAL PELAJARAN ──────────────────────────────────────────────────
public partial class SiswaJadwalViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<JadwalPelajaranSiswaDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaJadwalViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetJadwalPelajaranAsync(ct);
            Items.Clear();
            foreach (var j in list) Items.Add(j);
            StatusMessage = $"{Items.Count} jadwal";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA JADWAL PIKET ──────────────────────────────────────────────────────
public partial class SiswaJadwalPiketViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<JadwalPiketDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaJadwalPiketViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetJadwalPiketAsync(ct);
            Items.Clear();
            foreach (var p in list) Items.Add(p);
            StatusMessage = $"{Items.Count} piket";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA STRUKTUR KELAS ────────────────────────────────────────────────────
public partial class SiswaStrukturKelasViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SiswaKelasItemDto> Siswas { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string namaKelas = "";
    [ObservableProperty] private string? waliKelas;
    [ObservableProperty] private string statusMessage = "";

    public SiswaStrukturKelasViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var kelas = await _siswa.GetStrukturKelasAsync(ct);
            if (kelas is null) { StatusMessage = "Kelas tidak ditemukan"; return; }
            NamaKelas = kelas.Nama;
            WaliKelas = kelas.Guru?.Nama;
            Siswas.Clear();
            foreach (var s in kelas.Siswas) Siswas.Add(s);
            StatusMessage = $"{Siswas.Count} siswa";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA IURAN ─────────────────────────────────────────────────────────────
public partial class SiswaIuranViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<IuranSiswaDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaIuranViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetIuranAsync(ct);
            Items.Clear();
            foreach (var i in list) Items.Add(i);
            StatusMessage = $"{Items.Count} iuran";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA PROFIL BELAJAR ────────────────────────────────────────────────────
public partial class SiswaProfilBelajarViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private ProfilBelajarDto? data;
    [ObservableProperty] private string statusMessage = "";

    public SiswaProfilBelajarViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _siswa.GetProfilBelajarAsync(ct);
            StatusMessage = Data?.Model?.Profile is { } p
                ? $"Gaya belajar: {p.GayaBelajar ?? "-"}"
                : "Profil belajar";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA AI ANALITIK ───────────────────────────────────────────────────────
public partial class SiswaAiAnalitikViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private AiAnalitikDto? data;
    [ObservableProperty] private string statusMessage = "";

    public SiswaAiAnalitikViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _siswa.GetAiAnalitikAsync(ct);
            StatusMessage = Data?.Statistik is { } s
                ? $"{s.TotalRuns} run, {s.Sukses} sukses"
                : "AI Analitik";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SISWA PENGATURAN ────────────────────────────────────────────────────────
public partial class SiswaPengaturanViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string nama = "";
    [ObservableProperty] private string nis = "";
    [ObservableProperty] private string nisn = "";
    [ObservableProperty] private string alamat = "";
    [ObservableProperty] private string noTelp = "";
    [ObservableProperty] private string email = "";
    [ObservableProperty] private string statusMessage = "";

    public SiswaPengaturanViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var p = await _siswa.GetProfilAsync(ct);
            if (p is null) { StatusMessage = "Profil tidak ditemukan"; return; }
            Nama = p.Nama ?? ""; Nis = p.Nis ?? ""; Nisn = p.Nisn ?? "";
            Alamat = p.Alamat ?? ""; NoTelp = p.NoTelp ?? "";
            Email = p.User?.Email ?? "";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task SaveAsync(CancellationToken ct)
    {
        try
        {
            var updated = await _siswa.UpdateProfilAsync(new { nama = Nama, nis = Nis, nisn = Nisn, alamat = Alamat, noTelp = NoTelp }, ct);
            if (updated is not null) StatusMessage = "Profil tersimpan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}