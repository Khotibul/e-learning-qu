using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;

namespace E_LearningQu.Desktop.ViewModels;

// ═══════════════════════════════════════════════════════════════════════
// VM batch gap: admin-absensi-guru, admin-fingerprint, bendahara
// (Keuangan). Semua data via mobile API admin yang sama dengan website.
// ═══════════════════════════════════════════════════════════════════════

// ─── Absensi Guru ─────────────────────────────────────────────────────

public sealed partial class AdminAbsensiGuruViewModel : ObservableObject
{
    private readonly IAdminService _admin;
    private CancellationTokenSource? _loadCts;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private int selectedTabIndex;
    [ObservableProperty] private string selectedTanggal = DateTime.Now.ToString("yyyy-MM-dd");
    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private AbsensiGuruRingkasanDto ringkasan = new();
    [ObservableProperty] private RekapPerGuruDto rekapTotal = new();

    public ObservableCollection<AbsensiGuruBarisDto> Monitoring { get; } = new();
    public ObservableCollection<RekapPerGuruDto> RekapPerGuru { get; } = new();
    public ObservableCollection<PenggantiDto> Pengganti { get; } = new();

    public AdminAbsensiGuruViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public void PilihTab(string? index) => SelectedTabIndex = int.TryParse(index, out var i) ? i : 0;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        if (IsBusy) return;
        IsBusy = true; IsLoading = true; ErrorMessage = null;
        try
        {
            if (SelectedTabIndex == 1)
            {
                var rekap = await _admin.GetAbsensiGuruRekapAsync(SelectedTanggal, SelectedTanggal, ct);
                RekapTotal = rekap.Total;
                RekapPerGuru.Clear();
                foreach (var r in rekap.RekapPerGuru) RekapPerGuru.Add(r);
                StatusMessage = $"Rekap {SelectedTanggal} • {RekapPerGuru.Count} guru";
            }
            else if (SelectedTabIndex == 2)
            {
                var list = await _admin.GetPenggantiListAsync(null, ct);
                Pengganti.Clear();
                foreach (var p in list) Pengganti.Add(p);
                StatusMessage = $"{Pengganti.Count} pengganti guru";
            }
            else
            {
                var m = await _admin.GetAbsensiGuruMonitoringAsync(SelectedTanggal, SearchText, ct);
                Ringkasan = m.Summary;
                Monitoring.Clear();
                foreach (var r in m.Rows) Monitoring.Add(r);
                StatusMessage = $"{m.Rows.Count} jadwal • Hadir {m.Summary.Hadir} • Belum {m.Summary.BelumAbsen}";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; IsBusy = false; }
    }

    partial void OnSelectedTabIndexChanged(int value) => _ = LoadAsync();

    partial void OnSelectedTanggalChanged(string value)
    {
        // Tanggal diketik karakter demi karakter — debounce agar tidak menembak API per ketikan.
        _loadCts?.Cancel();
        _loadCts = new CancellationTokenSource();
        var ct = _loadCts.Token;
        _ = Task.Run(async () =>
        {
            await Task.Delay(400, ct);
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() => LoadAsync(ct));
        }, ct);
    }

    [RelayCommand]
    public async Task CariAsync(CancellationToken ct = default) => await LoadAsync(ct);

    [RelayCommand]
    public async Task HapusPenggantiAsync(PenggantiDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.HapusPenggantiAsync(item.Id, ct))
            {
                Pengganti.Remove(item);
                StatusMessage = "Pengganti dihapus";
            }
            else ErrorMessage = "Gagal menghapus pengganti";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── Fingerprint ───────────────────────────────────────────────────────

public sealed partial class AdminFingerprintViewModel : ObservableObject
{
    private readonly IAdminService _admin;
    private CancellationTokenSource? _loadCts;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private int selectedTabIndex;
    [ObservableProperty] private string monitoringTanggal = DateTime.Now.ToString("yyyy-MM-dd");
    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private PerangkatFpDto? selectedPerangkat;
    [ObservableProperty] private MonitoringHarianRingkasanDto ringkasan = new();
    [ObservableProperty] private string tambahNama = "";
    [ObservableProperty] private string tambahLokasi = "";
    [ObservableProperty] private string uidBaru = "";
    [ObservableProperty] private SiswaCariDto? siswaTerpilih;
    [ObservableProperty] private string apiKeyBaru = "";

    public ObservableCollection<PerangkatFpDto> Perangkat { get; } = new();
    public ObservableCollection<PemetaanFpDto> Pemetaan { get; } = new();
    public ObservableCollection<SiswaCariDto> HasilCari { get; } = new();
    public ObservableCollection<MonitoringHarianBarisDto> Monitoring { get; } = new();
    public ObservableCollection<EventFpDto> Events { get; } = new();
    public ObservableCollection<PermintaanManualFpDto> Permintaan { get; } = new();

    public AdminFingerprintViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public void PilihTab(string? index) => SelectedTabIndex = int.TryParse(index, out var i) ? i : 0;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        if (IsBusy) return;
        IsBusy = true; IsLoading = true; ErrorMessage = null;
        try
        {
            if (SelectedTabIndex == 1)
            {
                var m = await _admin.GetMonitoringHarianAsync(MonitoringTanggal, SearchText, ct);
                Ringkasan = m.Summary;
                Monitoring.Clear();
                foreach (var r in m.Rows) Monitoring.Add(r);
                StatusMessage = $"{m.Rows.Count} siswa • Masuk {m.Summary.Masuk} • Belum {m.Summary.BelumMasuk}";
            }
            else if (SelectedTabIndex == 2)
            {
                var list = await _admin.GetFpEventsAsync(MonitoringTanggal, ct);
                Events.Clear();
                foreach (var e in list) Events.Add(e);
                StatusMessage = $"{Events.Count} event hari ini";
            }
            else if (SelectedTabIndex == 3)
            {
                var list = await _admin.GetPermintaanManualAsync(ct);
                Permintaan.Clear();
                foreach (var p in list) Permintaan.Add(p);
                StatusMessage = $"{Permintaan.Count} permintaan manual";
            }
            else
            {
                var list = await _admin.GetPerangkatFpAsync(ct);
                Perangkat.Clear();
                foreach (var p in list) Perangkat.Add(p);
                StatusMessage = $"{Perangkat.Count} perangkat";
                if (SelectedPerangkat is not null)
                    await MuatPemetaanAsync(SelectedPerangkat.Id, ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; IsBusy = false; }
    }

    partial void OnSelectedTabIndexChanged(int value) => _ = LoadAsync();

    partial void OnMonitoringTanggalChanged(string value)
    {
        // Tanggal diketik karakter demi karakter — debounce agar tidak menembak API per ketikan.
        if (SelectedTabIndex is not (1 or 2)) return;
        _loadCts?.Cancel();
        _loadCts = new CancellationTokenSource();
        var ct = _loadCts.Token;
        _ = Task.Run(async () =>
        {
            await Task.Delay(400, ct);
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() => LoadAsync(ct));
        }, ct);
    }

    [RelayCommand]
    public async Task PilihPerangkatAsync(PerangkatFpDto? item, CancellationToken ct = default)
    {
        SelectedPerangkat = item;
        if (item is not null) await MuatPemetaanAsync(item.Id, ct);
    }

    private async Task MuatPemetaanAsync(string perangkatId, CancellationToken ct)
    {
        try
        {
            var list = await _admin.GetPemetaanFpAsync(perangkatId, ct);
            Pemetaan.Clear();
            foreach (var p in list) Pemetaan.Add(p);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TambahPerangkatAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(TambahNama)) { ErrorMessage = "Nama perangkat wajib diisi"; return; }
        IsLoading = true; ErrorMessage = null;
        try
        {
            var baru = await _admin.BuatPerangkatFpAsync(TambahNama, string.IsNullOrWhiteSpace(TambahLokasi) ? null : TambahLokasi, ct);
            if (baru is null) { ErrorMessage = "Gagal membuat perangkat"; return; }
            ApiKeyBaru = baru.ApiKey;
            TambahNama = ""; TambahLokasi = "";
            StatusMessage = $"Perangkat {baru.Kode} dibuat — API key tampil sekali, salin sekarang";
            await MuatPerangkatAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    private async Task MuatPerangkatAsync(CancellationToken ct)
    {
        var list = await _admin.GetPerangkatFpAsync(ct);
        Perangkat.Clear();
        foreach (var p in list) Perangkat.Add(p);
    }

    [RelayCommand]
    public async Task ToggleStatusAsync(PerangkatFpDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        var baru = item.Status == "AKTIF" ? "NONAKTIF" : "AKTIF";
        if (await _admin.UbahPerangkatFpAsync(item.Id, null, null, baru, ct))
        {
            item.Status = baru;
            StatusMessage = $"{item.Nama} → {baru}";
        }
    }

    [RelayCommand]
    public async Task HapusPerangkatAsync(PerangkatFpDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.HapusPerangkatFpAsync(item.Id, ct))
            {
                Perangkat.Remove(item);
                StatusMessage = "Perangkat dihapus";
            }
            else ErrorMessage = "Gagal menghapus perangkat";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task RotasiKeyAsync(PerangkatFpDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        var key = await _admin.RotasiApiKeyFpAsync(item.Id, ct);
        if (key is null) ErrorMessage = "Gagal merotasi API key";
        else { ApiKeyBaru = key; StatusMessage = $"API key {item.Kode} dirotasi — tampil sekali"; }
    }

    [RelayCommand]
    public async Task CariSiswaAsync(CancellationToken ct = default)
    {
        HasilCari.Clear();
        if (string.IsNullOrWhiteSpace(SearchText) || SearchText.Trim().Length < 2) return;
        try
        {
            foreach (var s in await _admin.CariSiswaFpAsync(SearchText.Trim(), ct)) HasilCari.Add(s);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TambahPemetaanAsync(CancellationToken ct = default)
    {
        if (SelectedPerangkat is null) { ErrorMessage = "Pilih perangkat dulu"; return; }
        if (SiswaTerpilih is null) { ErrorMessage = "Pilih siswa dari hasil pencarian"; return; }
        if (string.IsNullOrWhiteSpace(UidBaru)) { ErrorMessage = "UID sidik jari wajib diisi"; return; }
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.TambahPemetaanFpAsync(SelectedPerangkat.Id, SiswaTerpilih.Id, UidBaru.Trim(), ct))
            {
                UidBaru = ""; SiswaTerpilih = null; HasilCari.Clear();
                StatusMessage = "Pemetaan ditambahkan";
                await MuatPemetaanAsync(SelectedPerangkat.Id, ct);
            }
            else ErrorMessage = "Gagal menambah pemetaan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task HapusPemetaanAsync(PemetaanFpDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        if (await _admin.HapusPemetaanFpAsync(item.Id, ct))
        {
            Pemetaan.Remove(item);
            StatusMessage = "Pemetaan dihapus";
        }
    }

    [RelayCommand]
    public async Task SetujuiPermintaanAsync(string? id, CancellationToken ct = default) => await PutuskanPermintaanAsync(id, "DISETUJUI", ct);

    [RelayCommand]
    public async Task TolakPermintaanAsync(string? id, CancellationToken ct = default) => await PutuskanPermintaanAsync(id, "DITOLAK", ct);

    private async Task PutuskanPermintaanAsync(string? id, string putusan, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.PutuskanPermintaanManualAsync(id, putusan, null, ct))
            {
                StatusMessage = $"Permintaan {putusan.ToLowerInvariant()}";
                var list = await _admin.GetPermintaanManualAsync(ct);
                Permintaan.Clear();
                foreach (var p in list) Permintaan.Add(p);
            }
            else ErrorMessage = "Gagal memutuskan permintaan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── Keuangan (Bendahara) ──────────────────────────────────────────────

public sealed partial class AdminKeuanganViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private KeuanganDashboardDto dashboard = new();

    public ObservableCollection<TopupRequestDto> AntreanTopup { get; } = new();
    public ObservableCollection<PembayaranPendingDto> AntreanPembayaran { get; } = new();
    public ObservableCollection<AkunLaporanDto> Akun { get; } = new();
    public ObservableCollection<JurnalUmumDto> Jurnal { get; } = new();

    public AdminKeuanganViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Dashboard = await _admin.GetKeuanganDashboardAsync(ct);
            var antrean = await _admin.GetAntreanKeuanganAsync(ct);
            AntreanTopup.Clear();
            foreach (var t in antrean.Topups) AntreanTopup.Add(t);
            AntreanPembayaran.Clear();
            foreach (var p in antrean.Pembayaran) AntreanPembayaran.Add(p);
            Akun.Clear();
            foreach (var a in await _admin.GetAkunLaporanAsync(ct)) Akun.Add(a);
            Jurnal.Clear();
            foreach (var j in await _admin.GetJurnalUmumAsync(50, ct)) Jurnal.Add(j);
            StatusMessage = $"Topup menunggu {Dashboard.TopupMenunggu} • Tagihan pending {Dashboard.TagihanPending} • {Jurnal.Count} jurnal";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task SetujuiTopupAsync(string? id, CancellationToken ct = default) => await VerifikasiTopupAsync(id, true, ct);

    [RelayCommand]
    public async Task TolakTopupAsync(string? id, CancellationToken ct = default) => await VerifikasiTopupAsync(id, false, ct);

    [RelayCommand]
    public async Task SetujuiPembayaranAsync(string? id, CancellationToken ct = default) => await VerifikasiPembayaranAsync(id, true, ct);

    [RelayCommand]
    public async Task TolakPembayaranAsync(string? id, CancellationToken ct = default) => await VerifikasiPembayaranAsync(id, false, ct);

    private async Task VerifikasiTopupAsync(string? id, bool setujui, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.VerifikasiTopupAsync(id, setujui, null, ct))
            {
                StatusMessage = setujui ? "Topup disetujui" : "Topup ditolak";
                await MuatAntreanAsync(ct);
            }
            else ErrorMessage = "Gagal memverifikasi topup";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    private async Task VerifikasiPembayaranAsync(string? id, bool setujui, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        IsLoading = true; ErrorMessage = null;
        try
        {
            if (await _admin.VerifikasiPembayaranTagihanAsync(id, setujui, null, ct))
            {
                StatusMessage = setujui ? "Pembayaran disetujui" : "Pembayaran ditolak";
                await MuatAntreanAsync(ct);
            }
            else ErrorMessage = "Gagal memverifikasi pembayaran";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    private async Task MuatAntreanAsync(CancellationToken ct)
    {
        var antrean = await _admin.GetAntreanKeuanganAsync(ct);
        AntreanTopup.Clear();
        foreach (var t in antrean.Topups) AntreanTopup.Add(t);
        AntreanPembayaran.Clear();
        foreach (var p in antrean.Pembayaran) AntreanPembayaran.Add(p);
    }
}
