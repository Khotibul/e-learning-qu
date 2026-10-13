using System.Collections.ObjectModel;
using System.Windows.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Academic;

namespace E_LearningQu.Desktop.ViewModels;

public sealed record JadwalItem(string Hari, string Jam, string MataPelajaran);

public sealed partial class UjianListViewModel : ObservableObject
{
    private readonly IAkademikService _akademik;
    private readonly ISessionManager _session;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;

    public ObservableCollection<UjianListItemDto> Ujians { get; } = new();

    public event EventHandler<UjianListItemDto>? BukaUjian;

    public UjianListViewModel(IAkademikService akademik, ISessionManager session)
    {
        _akademik = akademik;
        _session = session;
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        IsLoading = true;
        try
        {
            var list = await _akademik.GetUjiansAsync(ct);
            Ujians.Clear();
            foreach (var u in list) Ujians.Add(u);
        }
        catch (ApiException ex) { ErrorMessage = ex.ServerMessage ?? ex.Message; }
        catch (Exception) { ErrorMessage = "Tidak dapat terhubung ke server."; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private void Buka(UjianListItemDto? item)
    {
        if (item is not null) BukaUjian?.Invoke(this, item);
    }
}

public sealed partial class KerjakanUjianViewModel : ObservableObject
{
    private static readonly TimeSpan AutosaveInterval = TimeSpan.FromSeconds(30);

    private readonly IAkademikService _akademik;
    private readonly Dictionary<string, string> _answers = new();
    private readonly HashSet<string> _ragu = new();
    private readonly DispatcherTimer _tickTimer;
    private readonly DispatcherTimer _autosaveTimer;
    private DateTime _deadlineUtc;

    public UjianDetailDto Detail { get; private set; } = new();

    private readonly ObservableCollection<SoalDto> _soalCollection = new();
    public ObservableCollection<SoalDto> Soal => _soalCollection;

    [ObservableProperty] private int currentIndex;
    [ObservableProperty] private string sisaWaktuText = "--:--";
    [ObservableProperty] private string autosaveText = "";
    [ObservableProperty] private bool isLoading = true;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private SubmitUjianResponse? hasil;
    [ObservableProperty] private bool selesai;

    public event EventHandler? SelesaiDiSubmit;

    public SoalDto? SoalAktif => Detail.Soal.Count == 0 ? null : Detail.Soal[Math.Clamp(CurrentIndex, 0, Detail.Soal.Count - 1)];

    public string JawabanAktif
    {
        get
        {
            var soal = SoalAktif;
            if (soal is null) return "";
            return _answers.TryGetValue(soal.Id, out var v) ? v : "";
        }
        set
        {
            var soal = SoalAktif;
            if (soal is null || value is null) return;
            _answers[soal.Id] = value;
            OnPropertyChanged();
        }
    }

    public bool RaguAktif
    {
        get
        {
            var soal = SoalAktif;
            return soal is not null && _ragu.Contains(soal.Id);
        }
        set
        {
            var soal = SoalAktif;
            if (soal is null) return;
            if (value) _ragu.Add(soal.Id); else _ragu.Remove(soal.Id);
            OnPropertyChanged();
        }
    }

    public bool BisaNavigasi => !Selesai && Detail.Soal.Count > 0;

    public PilihanGandaDto? PilihanTerpilih
    {
        get => SoalAktif?.PilihanGanda?.FirstOrDefault(p => p.Label == JawabanAktif);
        set
        {
            if (value is not null)
                JawabanAktif = value.Label;
            OnPropertyChanged();
        }
    }

    [RelayCommand]
    private void PilihJawaban(string? label)
    {
        if (label is not null)
            JawabanAktif = label;
    }

    public KerjakanUjianViewModel(IAkademikService akademik)
    {
        _akademik = akademik;
        _tickTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _tickTimer.Tick += (_, _) => OnTick();
        _autosaveTimer = new DispatcherTimer { Interval = AutosaveInterval };
        _autosaveTimer.Tick += (_, _) => _ = AutosaveAsync();
    }

    public async Task MulaiAsync(string ujianId, CancellationToken ct = default)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            Detail = await _akademik.GetUjianDetailAsync(ujianId, ct);
            _soalCollection.Clear();
            foreach (var s in Detail.Soal) _soalCollection.Add(s);
            OnPropertyChanged(nameof(Soal));
            OnPropertyChanged(nameof(BisaNavigasi));

            var start = await _akademik.StartUjianAsync(ujianId, ct);
            if (start.SavedAnswers is not null)
                foreach (var kv in start.SavedAnswers)
                    _answers[kv.Key] = kv.Value;
            if (start.SavedRagu is not null)
                foreach (var id in start.SavedRagu)
                    _ragu.Add(id);

            var durasiMenit = Math.Max(1, Detail.Durasi);
            _deadlineUtc = DateTime.UtcNow.AddMinutes(durasiMenit);
            CurrentIndex = 0;
            OnPropertyChanged(nameof(JawabanAktif));
            OnPropertyChanged(nameof(RaguAktif));

            IsLoading = false;
            _tickTimer.Start();
            _autosaveTimer.Start();
            UpdateSisaWaktu();
        }
        catch (ApiException ex)
        {
            IsLoading = false;
            ErrorMessage = ex.ServerMessage ?? ex.Message;
        }
        catch (Exception)
        {
            IsLoading = false;
            ErrorMessage = "Tidak dapat memulai ujian.";
        }
    }

    [RelayCommand]
    private void NextSoal()
    {
        if (CurrentIndex < Detail.Soal.Count - 1) CurrentIndex++;
        NotifySoalChanged();
    }

    [RelayCommand]
    private void PrevSoal()
    {
        if (CurrentIndex > 0) CurrentIndex--;
        NotifySoalChanged();
    }

    [RelayCommand]
    private void PilihNomor(int nomor)
    {
        CurrentIndex = Math.Clamp(nomor - 1, 0, Detail.Soal.Count - 1);
        NotifySoalChanged();
    }

    [RelayCommand]
    private async Task SubmitAsync()
    {
        if (Selesai) return;
        _tickTimer.Stop();
        _autosaveTimer.Stop();
        try
        {
            var hasil = await _akademik.SubmitUjianAsync(Detail.Id, SnapshotAnswers(), SnapshotRagu());
            Hasil = hasil;
            Selesai = true;
            OnPropertyChanged(nameof(BisaNavigasi));
            SelesaiDiSubmit?.Invoke(this, EventArgs.Empty);
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.ServerMessage ?? ex.Message;
            _tickTimer.Start();
            _autosaveTimer.Start();
        }
        catch (Exception)
        {
            ErrorMessage = "Gagal submit ujian.";
            _tickTimer.Start();
            _autosaveTimer.Start();
        }
    }

    private void NotifySoalChanged()
    {
        OnPropertyChanged(nameof(SoalAktif));
        OnPropertyChanged(nameof(JawabanAktif));
        OnPropertyChanged(nameof(RaguAktif));
        OnPropertyChanged(nameof(PilihanTerpilih));
    }

    private void OnTick()
    {
        UpdateSisaWaktu();
        if (DateTime.UtcNow >= _deadlineUtc && !Selesai)
            _ = SubmitAsync();
    }

    private void UpdateSisaWaktu()
    {
        var sisa = _deadlineUtc - DateTime.UtcNow;
        if (sisa < TimeSpan.Zero) sisa = TimeSpan.Zero;
        SisaWaktuText = sisa.TotalHours >= 1
            ? $"{(int)sisa.TotalHours:00}:{sisa.Minutes:00}:{sisa.Seconds:00}"
            : $"{sisa.Minutes:00}:{sisa.Seconds:00}";
    }

    private async Task AutosaveAsync()
    {
        if (Selesai) return;
        try
        {
            await _akademik.AutoSaveAsync(Detail.Id, SnapshotAnswers(), SnapshotRagu());
            AutosaveText = $"Tersimpan {DateTime.Now:HH:mm:ss}";
        }
        catch
        {
            AutosaveText = "Auto-save gagal — coba lagi";
        }
    }

    private Dictionary<string, string> SnapshotAnswers() => new(_answers);
    private List<string> SnapshotRagu() => _ragu.ToList();
}

public sealed partial class NilaiViewModel : ObservableObject
{
    private readonly IAkademikService _akademik;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;

    public ObservableCollection<NilaiDto> Nilais { get; } = new();

    public NilaiViewModel(IAkademikService akademik) => _akademik = akademik;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        IsLoading = true;
        try
        {
            var list = await _akademik.GetNilaiAsync(ct);
            Nilais.Clear();
            foreach (var n in list) Nilais.Add(n);
        }
        catch (ApiException ex) { ErrorMessage = ex.ServerMessage ?? ex.Message; }
        catch (Exception) { ErrorMessage = "Tidak dapat terhubung ke server."; }
        finally { IsLoading = false; }
    }
}

public sealed partial class JadwalViewModel : ObservableObject
{
    private readonly IAkademikService _akademik;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;

    public ObservableCollection<JadwalItem> Items { get; } = new();

    public JadwalViewModel(IAkademikService akademik) => _akademik = akademik;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        IsLoading = true;
        try
        {
            var list = await _akademik.GetJadwalAsync(ct);
            Items.Clear();
            foreach (var j in list.OrderBy(x => x.Hari, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.JamMulai))
                Items.Add(new JadwalItem(j.Hari, $"{j.JamMulai}–{j.JamSelesai}", j.MataPelajaran?.Nama ?? "-"));
        }
        catch (ApiException ex) { ErrorMessage = ex.ServerMessage ?? ex.Message; }
        catch (Exception) { ErrorMessage = "Tidak dapat terhubung ke server."; }
        finally { IsLoading = false; }
    }
}

public sealed partial class MateriViewModel : ObservableObject
{
    private readonly IAkademikService _akademik;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;

    public ObservableCollection<MateriDto> Materis { get; } = new();

    public MateriViewModel(IAkademikService akademik) => _akademik = akademik;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        IsLoading = true;
        try
        {
            var list = await _akademik.GetMateriAsync(ct);
            Materis.Clear();
            foreach (var m in list) Materis.Add(m);
        }
        catch (ApiException ex) { ErrorMessage = ex.ServerMessage ?? ex.Message; }
        catch (Exception) { ErrorMessage = "Tidak dapat terhubung ke server."; }
        finally { IsLoading = false; }
    }
}

public sealed partial class KehadiranViewModel : ObservableObject
{
    private readonly IAkademikService _akademik;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string rekapText = "";
    [ObservableProperty] private string hariIniText = "Belum tercatat";
    [ObservableProperty] private string tanggalAjukan = "";
    [ObservableProperty] private string tipeAjukan = "MASUK";
    [ObservableProperty] private string alasanAjukan = "";
    [ObservableProperty] private string infoAjukan = "";

    public ObservableCollection<AbsensiHarianRowDto> Rows { get; } = new();
    public ObservableCollection<PermintaanAbsensiDto> Permintaan { get; } = new();
    public IReadOnlyList<string> TipeOptions { get; } = new[] { "MASUK", "PULANG" };

    public KehadiranViewModel(IAkademikService akademik) => _akademik = akademik;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        ErrorMessage = null;
        IsLoading = true;
        try
        {
            var d = await _akademik.GetKehadiranAsync(null, ct);
            RekapText = $"Hadir {d.Rekap.Hadir} • Terlambat {d.Rekap.Terlambat} • Kehadiran {d.Rekap.PersenKehadiran}% (bulan {d.Bulan})";
            HariIniText = d.HariIni is null || (d.HariIni.JamMasuk is null && d.HariIni.StatusMasuk is null)
                ? "Belum tercatat"
                : $"Masuk {d.HariIni.JamMasuk ?? "-"} ({d.HariIni.StatusMasuk ?? "-"}) • Pulang {d.HariIni.JamPulang ?? "-"}";

            Rows.Clear();
            foreach (var r in d.Rows) Rows.Add(r);
            Permintaan.Clear();
            foreach (var p in d.Permintaan) Permintaan.Add(p);

            if (string.IsNullOrEmpty(TanggalAjukan))
                TanggalAjukan = DateTime.Today.ToString("yyyy-MM-dd");
        }
        catch (ApiException ex) { ErrorMessage = ex.ServerMessage ?? ex.Message; }
        catch (Exception) { ErrorMessage = "Tidak dapat terhubung ke server."; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task AjukanAsync()
    {
        InfoAjukan = "";
        if (string.IsNullOrWhiteSpace(TanggalAjukan) || string.IsNullOrWhiteSpace(AlasanAjukan))
        {
            InfoAjukan = "Tanggal dan alasan wajib diisi.";
            return;
        }
        try
        {
            await _akademik.AjukanAbsensiAsync(TanggalAjukan, TipeAjukan, AlasanAjukan);
            InfoAjukan = "Pengajuan terkirim — menunggu verifikasi admin.";
            AlasanAjukan = "";
            await LoadAsync();
        }
        catch (ApiException ex)
        {
            InfoAjukan = ex.ServerMessage ?? ex.Message;
        }
        catch (Exception)
        {
            InfoAjukan = "Gagal mengajukan.";
        }
    }
}
