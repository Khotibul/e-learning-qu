using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Contracts.Pondok;

namespace E_LearningQu.Desktop.ViewModels;

// ═══════════════════════════════════════════════════════════════════════
// VM untuk modul pondok (kepala-pondok / pengurus / ustadz / gerbang).
// Semua baca lewat IPondokService → /api/mobile/pondok/* (scope-aware).
// ═══════════════════════════════════════════════════════════════════════

// ─── Kepala Pondok: dashboard ───────────────────────────────────────────

public sealed partial class KepalaPondokDashboardViewModel : ObservableObject
{
    private readonly IPondokService _pondok;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private KepalaDashboardDto stats = new();

    public ObservableCollection<KeberadaanSantriDto> Keberadaan { get; } = new();
    public ObservableCollection<KegiatanDto> KegiatanMendatang { get; } = new();
    public ObservableCollection<IzinSantriDto> IzinMenunggu { get; } = new();
    public ObservableCollection<PengumumanDto> Pengumuman { get; } = new();
    public ObservableCollection<PembinaanDto> PembinaanMenunggu { get; } = new();
    public ObservableCollection<StatistikBarLaporanDto> Laporan { get; } = new();

    [ObservableProperty] private bool keberadaanAktif;
    [ObservableProperty] private bool izinAktif;
    [ObservableProperty] private bool laporanAktif;

    public KepalaPondokDashboardViewModel(IPondokService pondok) => _pondok = pondok;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Stats = await _pondok.GetKepalaDashboardAsync(ct);
            KegiatanMendatang.Clear();
            foreach (var k in Stats.KegiatanMendatang) KegiatanMendatang.Add(k);
            StatusMessage = $"{Stats.TotalSantri} santri · {Stats.DiPondok} di pondok";
            KeberadaanAktif = true;
            await BukaKeberadaanAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task BukaKeberadaanAsync(CancellationToken ct = default)
    {
        try
        {
            var tab = await _pondok.GetKeberadaanAsync(ct);
            Keberadaan.Clear();
            foreach (var r in tab.Rows) Keberadaan.Add(r);
            KeberadaanAktif = true; IzinAktif = false; LaporanAktif = false;
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaIzinAsync(CancellationToken ct = default)
    {
        try
        {
            var tab = await _pondok.GetIzinMenungguKepalaAsync(ct);
            IzinMenunggu.Clear();
            foreach (var r in tab.Rows) IzinMenunggu.Add(r);
            KeberadaanAktif = false; IzinAktif = true; LaporanAktif = false;
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaLaporanAsync(CancellationToken ct = default)
    {
        try
        {
            var tab = await _pondok.GetLaporanKepalaAsync(ct);
            Laporan.Clear();
            foreach (var r in tab.Rows) Laporan.Add(r);
            KeberadaanAktif = false; IzinAktif = false; LaporanAktif = true;
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task PutuskanIzinAsync(IzinSantriDto? izin, CancellationToken ct = default)
    {
        if (izin is null) return;
        try
        {
            var ok = await _pondok.PutuskanIzinAsync(izin.Id, "SETUJUI", null, ct);
            StatusMessage = ok ? $"Izin {izin.SuratNomor ?? izin.Id} disetujui" : "Gagal memutuskan izin";
            if (ok) await BukaIzinAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TolakIzinAsync(IzinSantriDto? izin, CancellationToken ct = default)
    {
        if (izin is null) return;
        try
        {
            var ok = await _pondok.PutuskanIzinAsync(izin.Id, "TOLAK", "Ditolak via desktop", ct);
            StatusMessage = ok ? $"Izin {izin.SuratNomor ?? izin.Id} ditolak" : "Gagal menolak izin";
            if (ok) await BukaIzinAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Kepala Pondok: keuangan ────────────────────────────────────────────

public sealed partial class KepalaPondokKeuanganViewModel : ObservableObject
{
    private readonly IPondokService _pondok;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private KeuanganPondokDto data = new();

    public ObservableCollection<RekapTagihanDto> Rekap { get; } = new();
    public ObservableCollection<TunggakanDto> Tunggakan { get; } = new();

    public KepalaPondokKeuanganViewModel(IPondokService pondok) => _pondok = pondok;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Data = await _pondok.GetKeuanganAsync(ct: ct);
            Rekap.Clear();
            foreach (var r in Data.RekapTagihanPondok) Rekap.Add(r);
            Tunggakan.Clear();
            foreach (var t in Data.Tunggakan) Tunggakan.Add(t);
            StatusMessage = $"{Data.Tunggakan.Count} tunggakan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── Pengurus: dashboard ────────────────────────────────────────────────

public sealed partial class PengurusDashboardViewModel : ObservableObject
{
    private readonly IPondokService _pondok;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private PengurusDashboardDto stats = new();
    [ObservableProperty] private string cariSantri = "";

    public ObservableCollection<SantriRingkasDto> Santri { get; } = new();
    public ObservableCollection<IzinSantriDto> AntreanIzin { get; } = new();
    public ObservableCollection<IzinSantriDto> IzinPulang { get; } = new();
    public ObservableCollection<KegiatanDto> Kegiatan { get; } = new();
    public ObservableCollection<AsramaDto> Asrama { get; } = new();
    public ObservableCollection<PengumumanDto> Pengumuman { get; } = new();

    [ObservableProperty] private bool dashboardAktif;
    [ObservableProperty] private bool santriAktif;
    [ObservableProperty] private bool izinAktif;
    [ObservableProperty] private bool kegiatanAktif;
    [ObservableProperty] private bool asramaAktif;

    public PengurusDashboardViewModel(IPondokService pondok) => _pondok = pondok;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Stats = await _pondok.GetPengurusDashboardAsync(ct);
            StatusMessage = $"{Stats.TanggungJawab} santri binaan";
            DashboardAktif = true;
            await BukaSantriAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task BukaSantriAsync(CancellationToken ct = default)
    {
        try
        {
            var tab = await _pondok.GetSantriBinaanAsync(string.IsNullOrWhiteSpace(CariSantri) ? null : CariSantri, ct);
            Santri.Clear();
            foreach (var r in tab.Rows) Santri.Add(r);
            SetTab(santri: true);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaIzinAsync(CancellationToken ct = default)
    {
        try
        {
            var antrean = await _pondok.GetAntreanIzinPengurusAsync(ct);
            AntreanIzin.Clear();
            foreach (var r in antrean.Rows) AntreanIzin.Add(r);
            var pulang = await _pondok.GetIzinPulangPengurusAsync(ct);
            IzinPulang.Clear();
            foreach (var r in pulang.Rows) IzinPulang.Add(r);
            SetTab(izin: true);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task SetujuiIzinAsync(IzinSantriDto? izin, CancellationToken ct = default)
    {
        if (izin is null) return;
        try
        {
            var ok = await _pondok.SetujuiIzinPengurusAsync(izin.Id, null, ct);
            StatusMessage = ok ? "Izin lolos tahap pengurus" : "Gagal menyetujui";
            if (ok) await BukaIzinAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TolakIzinAsync(IzinSantriDto? izin, CancellationToken ct = default)
    {
        if (izin is null) return;
        try
        {
            var ok = await _pondok.TolakIzinPengurusAsync(izin.Id, "Data tidak lengkap", ct);
            StatusMessage = ok ? "Izin ditolak" : "Gagal menolak";
            if (ok) await BukaIzinAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaKegiatanAsync(CancellationToken ct = default)
    {
        try
        {
            var rows = await _pondok.GetKegiatanPengurusAsync(ct: ct);
            Kegiatan.Clear();
            foreach (var k in rows) Kegiatan.Add(k);
            SetTab(kegiatan: true);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaAsramaAsync(CancellationToken ct = default)
    {
        try
        {
            var rows = await _pondok.GetAsramaAsync(ct);
            Asrama.Clear();
            foreach (var a in rows) Asrama.Add(a);
            SetTab(asrama: true);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaPengumumanAsync(CancellationToken ct = default)
    {
        try
        {
            var tab = await _pondok.GetPengumumanPengurusAsync(ct);
            Pengumuman.Clear();
            foreach (var r in tab.Rows) Pengumuman.Add(r);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    private void SetTab(bool dashboard = false, bool santri = false, bool izin = false, bool kegiatan = false, bool asrama = false)
    {
        DashboardAktif = dashboard; SantriAktif = santri; IzinAktif = izin;
        KegiatanAktif = kegiatan; AsramaAktif = asrama;
    }
}

// ─── Ustadz: dashboard ──────────────────────────────────────────────────

public sealed partial class UstadzDashboardViewModel : ObservableObject
{
    private readonly IPondokService _pondok;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private UstadzDashboardDto stats = new();
    [ObservableProperty] private UstadzTabDto<StatistikBarLaporanDto> laporan = new();

    public ObservableCollection<KelasDiniyahDto> KelasSaya { get; } = new();
    public ObservableCollection<HalaqahDto> HalaqahSaya { get; } = new();
    public ObservableCollection<SetoranDto> SetoranTerbaru { get; } = new();
    public ObservableCollection<IzinRingkasDto> IzinTerkait { get; } = new();
    public ObservableCollection<StatistikBarLaporanDto> LaporanBar { get; } = new();

    public UstadzDashboardViewModel(IPondokService pondok) => _pondok = pondok;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Stats = await _pondok.GetUstadzDashboardAsync(ct);
            KelasSaya.Clear();
            foreach (var k in Stats.KelasSaya) KelasSaya.Add(k);
            HalaqahSaya.Clear();
            foreach (var h in Stats.HalaqahSaya) HalaqahSaya.Add(h);
            SetoranTerbaru.Clear();
            foreach (var s in Stats.SetoranTerbaru) SetoranTerbaru.Add(s);
            IzinTerkait.Clear();
            foreach (var i in Stats.IzinTerkait) IzinTerkait.Add(i);
            StatusMessage = $"{Stats.SantriBinaan} santri binaan · {Stats.KelasSaya.Count} kelas · {Stats.HalaqahSaya.Count} halaqah";
            await BukaLaporanAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task BukaLaporanAsync(CancellationToken ct = default)
    {
        try
        {
            Laporan = await _pondok.GetLaporanUstadzAsync(ct);
            LaporanBar.Clear();
            foreach (var b in (Laporan.KehadiranDiniyah ?? new()).Concat(Laporan.Setoran ?? new()))
            {
                if (string.IsNullOrEmpty(b.Label) && !string.IsNullOrEmpty(b.Status)) b.Label = b.Status;
                LaporanBar.Add(b);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Gerbang ────────────────────────────────────────────────────────────

public sealed partial class GerbangViewModel : ObservableObject
{
    private readonly IPondokService _pondok;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string pencarian = "";
    [ObservableProperty] private TokenVerifDto? hasilToken;

    public ObservableCollection<GerbangAntreanDto> Antrean { get; } = new();
    public ObservableCollection<GerbangSantriDto> HasilCari { get; } = new();
    public ObservableCollection<GerbangAntreanDto> Riwayat { get; } = new();

    public GerbangViewModel(IPondokService pondok) => _pondok = pondok;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var page = await _pondok.GetGerbangAntreanAsync(ct: ct);
            Antrean.Clear();
            foreach (var r in page.Data) Antrean.Add(r);
            StatusMessage = $"{page.Total} izin menunggu check-out";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task CariAsync(CancellationToken ct = default)
    {
        var q = Pencarian?.Trim();
        if (string.IsNullOrEmpty(q)) return;
        try
        {
            var hasil = await _pondok.CariGerbangAsync(q, ct);
            HasilCari.Clear();
            HasilToken = hasil.Izin;
            if (hasil.Mode == "token")
            {
                StatusMessage = hasil.Izin is { Valid: true } ? $"Token valid — {hasil.Izin.NamaSantri}" : "Token tidak valid / kedaluwarsa";
            }
            else
            {
                foreach (var r in hasil.Rows) HasilCari.Add(r);
                StatusMessage = $"{hasil.Rows.Count} hasil untuk \"{q}\"";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task LoadRiwayatAsync(CancellationToken ct = default)
    {
        try
        {
            var hasil = await _pondok.GetRiwayatGerbangAsync(ct: ct);
            Riwayat.Clear();
            foreach (var r in hasil.RiwayatRows ?? new()) Riwayat.Add(r);
            StatusMessage = $"{Riwayat.Count} riwayat check-out";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task CheckoutAsync(GerbangAntreanDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            var ok = await _pondok.CheckoutAsync(new GerbangActionRequest { Op = "checkout", IzinId = item.Id }, ct);
            StatusMessage = ok ? $"{item.Santri?.Nama} check-out" : "Gagal check-out";
            if (ok) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task CheckoutTokenAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Pencarian)) return;
        try
        {
            var ok = await _pondok.CheckoutAsync(new GerbangActionRequest { Op = "checkout", Token = Pencarian.Trim() }, ct);
            StatusMessage = ok ? "Check-out via token berhasil" : "Gagal check-out token";
            if (ok) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task CheckinAsync(GerbangAntreanDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        try
        {
            var ok = await _pondok.CheckinAsync(item.Id, ct);
            StatusMessage = ok ? $"{item.Santri?.Nama} check-in" : "Gagal check-in";
            if (ok) await LoadRiwayatAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}
