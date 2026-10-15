using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;

namespace E_LearningQu.Desktop.ViewModels;

// ═══════════════════════════════════════════════════════════════════════
// VM batch akhir: siswa-dompet, santri-izin, guru-izin-musyrif, kantin.
// ═══════════════════════════════════════════════════════════════════════

// ─── Siswa Dompet ───────────────────────────────────────────────────────

public sealed partial class SiswaDompetViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private DompetAccountDto dompet = new();

    public ObservableCollection<WalletLedgerDto> Riwayat { get; } = new();
    public ObservableCollection<KantinTransaksiDto> TransaksiKantin { get; } = new();
    public ObservableCollection<TagihanDto> Tagihan { get; } = new();

    public SiswaDompetViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var dompetTask = _admin.GetDompetSayaAsync(ct);
            var kantinTask = _admin.GetRiwayatKantinSayaAsync(ct);
            var tagihanTask = _admin.GetTagihanSayaAsync(ct);
            await Task.WhenAll(dompetTask, kantinTask, tagihanTask);

            var d = await dompetTask;
            Dompet = d.Dompet ?? new DompetAccountDto();
            Riwayat.Clear();
            foreach (var r in d.Riwayat) Riwayat.Add(r);
            TransaksiKantin.Clear();
            foreach (var t in (await kantinTask).Rows) TransaksiKantin.Add(t);
            Tagihan.Clear();
            foreach (var t in (await tagihanTask).Rows) Tagihan.Add(t);
            StatusMessage = $"Saldo Rp{Dompet.Saldo:N0} · {Tagihan.Count} tagihan";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── Santri Izin (siswa side) ───────────────────────────────────────────

public sealed partial class SiswaIzinViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private SantriIzinBriefDto santri = new();

    public ObservableCollection<IzinAntreanDto> Rows { get; } = new();

    [ObservableProperty] private string jenis = "PULANG_RUMAH";
    [ObservableProperty] private string alasan = "";
    [ObservableProperty] private string rencanaKeluar = "";
    [ObservableProperty] private string rencanaKembali = "";
    [ObservableProperty] private string alamatTujuan = "";
    [ObservableProperty] private string namaPenjemput = "";
    [ObservableProperty] private string hubunganPenjemput = "AYAH";
    [ObservableProperty] private string noTelpPenjemput = "";

    public SiswaIzinViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await _admin.GetIzinSayaAsync(ct);
            Santri = result.Santri ?? new SantriIzinBriefDto();
            Rows.Clear();
            foreach (var r in result.Rows) Rows.Add(r);
            StatusMessage = $"{Rows.Count} izin · keberadaan {Santri.Keberadaan}";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task AjukanAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Alasan) || Alasan.Trim().Length < 10)
        {
            ErrorMessage = "Alasan minimal 10 karakter";
            return;
        }
        if (string.IsNullOrWhiteSpace(RencanaKeluar) || string.IsNullOrWhiteSpace(RencanaKembali))
        {
            ErrorMessage = "Rencana keluar & kembali wajib diisi";
            return;
        }
        IsLoading = true; ErrorMessage = null;
        try
        {
            var ok = await _admin.AjukanIzinAsync(new IzinAjukanRequest
            {
                Jenis = Jenis,
                Alasan = Alasan.Trim(),
                RencanaKeluar = RencanaKeluar,
                RencanaKembali = RencanaKembali,
                AlamatTujuan = AlamatTujuan.Trim(),
                NamaPenjemput = NamaPenjemput.Trim(),
                HubunganPenjemput = HubunganPenjemput,
                NoTelpPenjemput = NoTelpPenjemput.Trim(),
            }, ct);
            if (ok)
            {
                Alasan = ""; RencanaKeluar = ""; RencanaKembali = "";
                AlamatTujuan = ""; NamaPenjemput = ""; NoTelpPenjemput = "";
                StatusMessage = "Izin diajukan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task BatalAsync((IzinAntreanDto item, string alasan) arg, CancellationToken ct = default)
    {
        var (item, alasan) = arg;
        if (item is null || string.IsNullOrWhiteSpace(alasan) || alasan.Trim().Length < 5)
        {
            ErrorMessage = "Alasan pembatalan minimal 5 karakter";
            return;
        }
        try
        {
            if (await _admin.BatalIzinAsync(item.Id, alasan.Trim(), ct))
            {
                StatusMessage = "Izin dibatalkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Guru Izin Musyrif ──────────────────────────────────────────────────

public sealed partial class GuruIzinMusyrifViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private MusyrifMonitoringDto monitoring = new();

    public ObservableCollection<IzinAntreanDto> Antrean { get; } = new();

    public GuruIzinMusyrifViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var antreanTask = _admin.GetIzinMusyrifAntreanAsync(ct);
            var monTask = _admin.GetMusyrifMonitoringAsync(ct);
            await Task.WhenAll(antreanTask, monTask);

            Antrean.Clear();
            foreach (var a in (await antreanTask).Rows) Antrean.Add(a);
            Monitoring = await monTask;
            StatusMessage = $"{Antrean.Count} menunggu musyrif · {Monitoring.DiPondok.Count} di pondok · {Monitoring.Terlambat.Count} terlambat";
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
            if (await _admin.SetujuiIzinMusyrifAsync(item.Id, null, ct))
            {
                Antrean.Remove(item);
                StatusMessage = "Izin disetujui musyrif";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TolakAsync(IzinAntreanDto? item, CancellationToken ct = default)
    {
        if (item is null) return;
        var alasan = item.AlasanTolak?.Trim() ?? "";
        if (alasan.Length < 5)
        {
            ErrorMessage = "Alasan penolakan minimal 5 karakter";
            return;
        }
        try
        {
            if (await _admin.TolakIzinMusyrifAsync(item.Id, alasan, ct))
            {
                Antrean.Remove(item);
                StatusMessage = "Izin ditolak musyrif";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── Kantin (kasir) ─────────────────────────────────────────────────────

public sealed partial class KantinViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string? selectedOutletId;
    [ObservableProperty] private KantinShiftDto? shiftAktif;
    [ObservableProperty] private string saldoAwal = "0";
    [ObservableProperty] private string kasAkhir = "0";

    public ObservableCollection<KantinOutletDto> Outlets { get; } = new();
    public ObservableCollection<KantinProdukDto> Produk { get; } = new();
    public ObservableCollection<KantinTransaksiDto> Riwayat { get; } = new();

    public KantinViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var outlets = await _admin.GetKantinOutletsAsync(ct);
            Outlets.Clear();
            foreach (var o in outlets) Outlets.Add(o);
            StatusMessage = $"{Outlets.Count} outlet";
            if (SelectedOutletId is not null) await MuatOutletAsync(SelectedOutletId, ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task PilihOutletAsync(KantinOutletDto? outlet, CancellationToken ct = default)
    {
        if (outlet is null) return;
        SelectedOutletId = outlet.Id;
        await MuatOutletAsync(outlet.Id, ct);
    }

    private async Task MuatOutletAsync(string outletId, CancellationToken ct)
    {
        try
        {
            var produkTask = _admin.GetKantinProdukAsync(outletId, ct);
            var shiftTask = _admin.GetKantinShiftAktifAsync(outletId, ct);
            await Task.WhenAll(produkTask, shiftTask);
            Produk.Clear();
            foreach (var p in await produkTask) Produk.Add(p);
            ShiftAktif = await shiftTask;
            StatusMessage = $"{Produk.Count} produk · shift {(ShiftAktif is null ? "belum buka" : $"#{ShiftAktif.NomorShift}")}";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task BukaShiftAsync(CancellationToken ct = default)
    {
        if (SelectedOutletId is null) { ErrorMessage = "Pilih outlet dulu"; return; }
        if (!int.TryParse(SaldoAwal, out var saldo)) { ErrorMessage = "Saldo awal harus angka"; return; }
        try
        {
            var shiftId = await _admin.BukaShiftAsync(SelectedOutletId, saldo, ct);
            if (shiftId is not null)
            {
                StatusMessage = "Shift dibuka";
                await MuatOutletAsync(SelectedOutletId, ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task TutupShiftAsync(CancellationToken ct = default)
    {
        if (ShiftAktif is null) { ErrorMessage = "Belum ada shift aktif"; return; }
        if (!int.TryParse(KasAkhir, out var kas)) { ErrorMessage = "Kas akhir harus angka"; return; }
        try
        {
            if (await _admin.TutupShiftAsync(ShiftAktif.Id, kas, null, ct))
            {
                StatusMessage = "Shift ditutup";
                if (SelectedOutletId is not null) await MuatOutletAsync(SelectedOutletId, ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}
