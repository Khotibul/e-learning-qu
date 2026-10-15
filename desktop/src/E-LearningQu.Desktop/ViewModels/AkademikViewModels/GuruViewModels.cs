using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Teacher;
using E_LearningQu.Desktop;

namespace E_LearningQu.Desktop.ViewModels;

// ─── GURU UJIAN ──────────────────────────────────────────────────────────────
public partial class GuruUjianViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<GuruUjianDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruUjianViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetUjiansAsync(ct);
            Items.Clear();
            foreach (var u in list) Items.Add(u);
            StatusMessage = $"{Items.Count} ujian";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task TambahAsync(CancellationToken ct = default)
    {
        if (IsLoading) return;
        try
        {
            var refs = await _guru.GetUjianRefsAsync(ct);
            var fields = new[]
            {
                new FormFieldDef { Key = "nama", Label = "Nama Ujian", Kind = FormFieldKind.Text, Required = true },
                new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo },
                new FormFieldDef { Key = "mataPelajaranId", Label = "Mata Pelajaran", Kind = FormFieldKind.Combo, Required = true,
                    Options = refs?.Mapels.Select(m => new ComboOption(m.Id, m.Nama)).ToList() ?? new List<ComboOption>() },
                new FormFieldDef { Key = "kelasId", Label = "Kelas", Kind = FormFieldKind.Combo, Required = true,
                    Options = refs?.Kelas.Select(k => new ComboOption(k.Id, k.Nama)).ToList() ?? new List<ComboOption>() },
                new FormFieldDef { Key = "tanggal", Label = "Tanggal (YYYY-MM-DD)", Kind = FormFieldKind.Date,
                    Value = DateTime.Now.ToString("yyyy-MM-dd") },
                new FormFieldDef { Key = "jamMulai", Label = "Jam Mulai (HH:mm)", Kind = FormFieldKind.Text, Value = "07:00" },
                new FormFieldDef { Key = "jamSelesai", Label = "Jam Selesai (HH:mm)", Kind = FormFieldKind.Text, Value = "09:00" },
                new FormFieldDef { Key = "durasi", Label = "Durasi (menit)", Kind = FormFieldKind.Int, Required = true, Value = "60" },
                new FormFieldDef { Key = "nilaiMinimum", Label = "Nilai Minimum", Kind = FormFieldKind.Int, Value = "70" },
            };
            var values = await DialogService.FormAsync("Tambah Ujian", fields, subtitle: "Susun ujian baru lalu simpan.", saveText: "Simpan");
            if (values is null) return;
            var payload = new Dictionary<string, object?>
            {
                ["op"] = "createUjian",
                ["nama"] = values.GetValueOrDefault("nama") ?? "",
                ["deskripsi"] = values.GetValueOrDefault("deskripsi"),
                ["mataPelajaranId"] = values.GetValueOrDefault("mataPelajaranId") ?? "",
                ["kelasId"] = values.GetValueOrDefault("kelasId") ?? "",
                ["tanggal"] = values.GetValueOrDefault("tanggal") ?? DateTime.Now.ToString("yyyy-MM-dd"),
                ["jamMulai"] = values.GetValueOrDefault("jamMulai") ?? "07:00",
                ["jamSelesai"] = values.GetValueOrDefault("jamSelesai") ?? "09:00",
                ["durasi"] = int.TryParse(values.GetValueOrDefault("durasi"), out var d) ? d : 60,
                ["nilaiMinimum"] = int.TryParse(values.GetValueOrDefault("nilaiMinimum"), out var n) ? n : 70,
            };
            if (await _guru.CreateUjianAsync(payload, ct) is not null)
            {
                StatusMessage = "Ujian ditambahkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task StartAsync(GuruUjianDto ujian, CancellationToken ct)
    {
        try { if (await _guru.StartUjianAsync(ujian.Id, ct)) await LoadAsync(ct); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task StopAsync(GuruUjianDto ujian, CancellationToken ct)
    {
        try { if (await _guru.StopUjianAsync(ujian.Id, ct)) await LoadAsync(ct); }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    private async Task DeleteAsync(GuruUjianDto ujian, CancellationToken ct)
    {
        try
        {
            if (await _guru.DeleteUjianAsync(ujian.Id, ct))
            {
                Items.Remove(ujian);
                StatusMessage = "Ujian dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── GURU ANALITIK ───────────────────────────────────────────────────────────
public partial class GuruAnalitikViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<GrafikPointDto> GrafikKelas { get; } = new();
    public ObservableCollection<GrafikPointDto> GrafikMapel { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private GuruAnalitikDto? data;

    public GuruAnalitikViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _guru.GetAnalitikAsync(ct);
            GrafikKelas.Clear();
            foreach (var g in Data.GrafikKelas) GrafikKelas.Add(g);
            GrafikMapel.Clear();
            foreach (var g in Data.GrafikMapel) GrafikMapel.Add(g);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── GURU MATERI ─────────────────────────────────────────────────────────────
public partial class GuruMateriViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<GuruMateriDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruMateriViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetMateriAsync(ct);
            Items.Clear();
            foreach (var m in list) Items.Add(m);
            StatusMessage = $"{Items.Count} materi";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task DeleteAsync(GuruMateriDto materi, CancellationToken ct)
    {
        try
        {
            if (await _guru.DeleteMateriAsync(materi.Id, ct))
            {
                Items.Remove(materi);
                StatusMessage = "Materi dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── GURU NILAI ──────────────────────────────────────────────────────────────
public partial class GuruNilaiViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<GuruNilaiUjianDto> Ujians { get; } = new();
    public ObservableCollection<GuruNilaiRowDto> Nilais { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruNilaiViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var d = await _guru.GetNilaiAsync(ct);
            Ujians.Clear();
            foreach (var u in d.Ujians) Ujians.Add(u);
            Nilais.Clear();
            foreach (var n in d.Nilais) Nilais.Add(n);
            StatusMessage = $"{Ujians.Count} ujian, {Nilais.Count} nilai";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── GURU ABSANSI ────────────────────────────────────────────────────────────
public partial class GuruAbsensiViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private AbsensiGuruDto? data;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string selectedStatus = "HADIR";
    [ObservableProperty] private string keterangan = "";

    public GuruAbsensiViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _guru.GetAbsensiAsync(null, ct);
            SelectedStatus = Data?.Status ?? "HADIR";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task SubmitAsync(CancellationToken ct)
    {
        try
        {
            Data = await _guru.SubmitAbsensiAsync(null, SelectedStatus, Keterangan, ct);
            StatusMessage = "Absensi tersimpan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── GURU PROFIL ─────────────────────────────────────────────────────────────
public partial class GuruProfilViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string nama = "";
    [ObservableProperty] private string nip = "";
    [ObservableProperty] private string nuptk = "";
    [ObservableProperty] private string alamat = "";
    [ObservableProperty] private string noTelp = "";
    [ObservableProperty] private string email = "";

    public GuruProfilViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var p = await _guru.GetProfilAsync(ct);
            if (p is null) return;
            Nama = p.Nama ?? ""; Nip = p.Nip ?? ""; Nuptk = p.Nuptk ?? "";
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
            await _guru.UpdateProfilAsync(new { nama = Nama, nip = Nip, nuptk = Nuptk, alamat = Alamat, noTelp = NoTelp }, ct);
            StatusMessage = "Profil tersimpan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}