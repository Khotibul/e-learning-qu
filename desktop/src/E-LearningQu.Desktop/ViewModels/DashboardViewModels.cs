using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Dashboard;

namespace E_LearningQu.Desktop.ViewModels;

public sealed record StatCard(string Label, string Value);

public abstract partial class DashboardViewModelBase : ObservableObject
{
    public ObservableCollection<StatCard> Statistik { get; } = new();

    [ObservableProperty]
    private bool isLoading;

    [ObservableProperty]
    private string? errorMessage;

    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        if (IsLoading) return;
        IsLoading = true;
        try
        {
            await LoadCoreAsync(ct);
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.ServerMessage ?? ex.Message;
        }
        catch (Exception)
        {
            ErrorMessage = "Tidak dapat terhubung ke server.";
        }
        finally
        {
            IsLoading = false;
        }
    }

    protected abstract Task LoadCoreAsync(CancellationToken ct);
}

public sealed partial class SiswaDashboardViewModel : DashboardViewModelBase
{
    private readonly IDashboardService _dashboard;

    [ObservableProperty] private string nama = "";
    [ObservableProperty] private string kelas = "";
    [ObservableProperty] private string jurusan = "";
    [ObservableProperty] private string semester = "";
    [ObservableProperty] private string jabatan = "";
    [ObservableProperty] private double nilaiRataRata;
    [ObservableProperty] private int rataMastery;
    [ObservableProperty] private int ujianAktif;
    [ObservableProperty] private int tugasAktif;
    [ObservableProperty] private int streak;
    [ObservableProperty] private double jamBelajar;
    [ObservableProperty] private int progresBelajar;
    [ObservableProperty] private int persentaseAbsensi;
    [ObservableProperty] private string aiInsight = "";
    [ObservableProperty] private string nextUjianInfo = "";

    public ObservableCollection<PengumumanDto> Pengumuman { get; } = new();

    public SiswaDashboardViewModel(IDashboardService dashboard) => _dashboard = dashboard;

    [RelayCommand]
    private async Task RefreshAsync() => await LoadAsync();

    protected override async Task LoadCoreAsync(CancellationToken ct)
    {
        var d = await _dashboard.GetSiswaDashboardAsync(ct);
        Nama = d.Nama;
        Kelas = d.Kelas;
        Jurusan = d.Jurusan ?? "";
        Semester = d.Semester ?? "";
        Jabatan = d.Jabatan ?? "";
        NilaiRataRata = d.NilaiRataRata;
        RataMastery = d.RataMastery;
        UjianAktif = d.UjianAktif;
        TugasAktif = d.TugasAktif;
        Streak = d.Streak;
        JamBelajar = d.JamBelajar;
        ProgresBelajar = d.ProgresBelajar;
        PersentaseAbsensi = d.PersentaseAbsensi;
        AiInsight = d.AiInsight ?? "";
        NextUjianInfo = d.NextUjian is null
            ? "Tidak ada ujian aktif"
            : $"{d.NextUjian.Nama} ({d.NextUjian.Mapel ?? "-"})";

        Pengumuman.Clear();
        foreach (var p in d.Pengumuman)
            Pengumuman.Add(p);

        Statistik.Clear();
        Statistik.Add(new StatCard("Nilai rata-rata", d.NilaiRataRata.ToString("0.#")));
        Statistik.Add(new StatCard("Mastery", $"{d.RataMastery}%"));
        Statistik.Add(new StatCard("Ujian aktif", d.UjianAktif.ToString()));
        Statistik.Add(new StatCard("Latihan aktif", d.TugasAktif.ToString()));
        Statistik.Add(new StatCard("Streak belajar", $"{d.Streak} hari"));
        Statistik.Add(new StatCard("Jam belajar", d.JamBelajar.ToString("0.#")));
        Statistik.Add(new StatCard("Kehadiran", $"{d.PersentaseAbsensi}%"));
        Statistik.Add(new StatCard("Total materi", d.TotalMateri.ToString()));
    }
}

public sealed partial class GuruDashboardViewModel : DashboardViewModelBase
{
    private readonly IDashboardService _dashboard;

    [ObservableProperty] private int kelasCount;
    [ObservableProperty] private int mapelCount;
    [ObservableProperty] private int siswaCount;
    [ObservableProperty] private int ujianAktif;
    [ObservableProperty] private int latihanAktif;
    [ObservableProperty] private int totalSoal;
    [ObservableProperty] private int rataNilai;
    [ObservableProperty] private int rataMastery;

    public GuruDashboardViewModel(IDashboardService dashboard) => _dashboard = dashboard;

    [RelayCommand]
    private async Task RefreshAsync() => await LoadAsync();

    protected override async Task LoadCoreAsync(CancellationToken ct)
    {
        var d = await _dashboard.GetGuruDashboardAsync(ct);
        KelasCount = d.KelasCount;
        MapelCount = d.MapelCount;
        SiswaCount = d.SiswaCount;
        UjianAktif = d.UjianAktif;
        LatihanAktif = d.LatihanAktif;
        TotalSoal = d.TotalSoal;
        RataNilai = d.RataNilai;
        RataMastery = d.RataMastery;

        Statistik.Clear();
        Statistik.Add(new StatCard("Kelas", d.KelasCount.ToString()));
        Statistik.Add(new StatCard("Mata pelajaran", d.MapelCount.ToString()));
        Statistik.Add(new StatCard("Siswa", d.SiswaCount.ToString()));
        Statistik.Add(new StatCard("Ujian aktif", d.UjianAktif.ToString()));
        Statistik.Add(new StatCard("Latihan aktif", d.LatihanAktif.ToString()));
        Statistik.Add(new StatCard("Total soal", d.TotalSoal.ToString()));
        Statistik.Add(new StatCard("Rata-rata nilai", d.RataNilai.ToString()));
        Statistik.Add(new StatCard("Mastery siswa", $"{d.RataMastery}%"));
    }
}
