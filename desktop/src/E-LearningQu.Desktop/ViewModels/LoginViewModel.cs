using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Desktop.ViewModels;

public partial class LoginViewModel : ObservableObject
{
    private readonly IAuthService _auth;
    private readonly IOAuthService _oauth;
    private readonly IKioskService _kiosk;
    private readonly IKioskTokenStore _kioskStore;

    public event EventHandler? LoginSucceeded;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    [NotifyCanExecuteChangedFor(nameof(BukaKioskCommand))]
    private string email = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    [NotifyCanExecuteChangedFor(nameof(BukaKioskCommand))]
    private string password = "";

    [ObservableProperty]
    private string? errorMessage;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    [NotifyCanExecuteChangedFor(nameof(LoginWithGoogleCommand))]
    [NotifyCanExecuteChangedFor(nameof(BukaKioskCommand))]
    [NotifyCanExecuteChangedFor(nameof(AktifkanKioskGoogleCommand))]
    private bool isBusy;

    // ── Kiosk absensi (wajah & sidik jari) tanpa login ──────────────
    [ObservableProperty]
    private bool isKioskOpen;

    [ObservableProperty]
    private string? kioskUrl;

    [ObservableProperty]
    private string? kioskToken;

    [ObservableProperty]
    private string? kioskAdmin;

    [ObservableProperty]
    private string? kioskMessage;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(BukaKioskCommand))]
    [NotifyCanExecuteChangedFor(nameof(AktifkanKioskGoogleCommand))]
    private bool isKioskBusy;

    public LoginViewModel(IAuthService auth, IOAuthService oauth, IKioskService kiosk, IKioskTokenStore kioskStore)
    {
        _auth = auth;
        _oauth = oauth;
        _kiosk = kiosk;
        _kioskStore = kioskStore;
    }

    private bool CanLogin() => !IsBusy && !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password);
    private bool CanLoginGoogle() => !IsBusy;
    private bool CanBukaKiosk() => !IsBusy && !IsKioskBusy;
    private bool CanAktifkanKioskGoogle() => !IsBusy && !IsKioskBusy;

    [RelayCommand(CanExecute = nameof(CanLogin))]
    private async Task LoginAsync()
    {
        ErrorMessage = null;
        IsBusy = true;
        try
        {
            var result = await _auth.LoginAsync(Email, Password);
            if (result.IsSuccess)
                LoginSucceeded?.Invoke(this, EventArgs.Empty);
            else
                ErrorMessage = result.ErrorMessage ?? "Login gagal.";
        }
        catch (Exception)
        {
            ErrorMessage = "Terjadi kesalahan tak terduga. Coba lagi.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand(CanExecute = nameof(CanLoginGoogle))]
    private async Task LoginWithGoogleAsync()
    {
        ErrorMessage = null;
        IsBusy = true;
        try
        {
            var result = await _oauth.LoginWithGoogleAsync();
            if (result.IsSuccess)
                LoginSucceeded?.Invoke(this, EventArgs.Empty);
            else
                ErrorMessage = result.ErrorMessage ?? "Login Google gagal.";
        }
        catch (Exception)
        {
            ErrorMessage = "Login Google gagal. Coba lagi.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Buka kiosk absensi. Bila perangkat belum diaktifkan, email + kata sandi
    /// Admin yang sedang terisi dipakai SEKALI untuk klaim token kiosk 30 hari.
    /// Sesudah itu guru/siswa bisa absen tanpa login.
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanBukaKiosk))]
    private async Task BukaKioskAsync()
    {
        KioskMessage = null;
        IsKioskBusy = true;
        try
        {
            var tersimpan = await BacaKioskTersimpanAsync();
            if (tersimpan is not null)
            {
                BukaKiosk(tersimpan);
                return;
            }

            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
            {
                KioskMessage = "Aktifkan sekali: isi email & kata sandi Admin, lalu tekan tombol ini lagi.";
                return;
            }

            var login = await _auth.LoginAsync(Email, Password);
            if (!login.IsSuccess)
            {
                KioskMessage = login.ErrorMessage ?? "Aktivasi kiosk gagal — periksa akun Admin.";
                return;
            }

            try
            {
                var hasil = await _kiosk.AktifkanAsync();
                var kredensial = new KioskCredential(
                    hasil.Token,
                    hasil.Url,
                    DateTimeOffset.UtcNow.AddSeconds(hasil.ExpiresInDetik),
                    hasil.Admin);

                await _kioskStore.SaveAsync(kredensial);
                BukaKiosk(kredensial);
            }
            finally
            {
                // Aktivasi tidak boleh meninggalkan sesi Admin aktif di layar login.
                await _auth.SignOutAsync();
            }
        }
        catch (ApiException ex)
        {
            KioskMessage = ex.ServerMessage ?? ex.Message;
        }
        catch (Exception)
        {
            KioskMessage = "Gagal membuka kiosk absensi. Periksa koneksi lalu coba lagi.";
        }
        finally
        {
            IsKioskBusy = false;
        }
    }

    /// <summary>
    /// Aktivasi kiosk memakai akun Google — untuk Admin yang tidak punya kata
    /// sandi (login Google-only). Alur OAuth sama dengan tombol Masuk Google.
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanAktifkanKioskGoogle))]
    private async Task AktifkanKioskGoogleAsync()
    {
        KioskMessage = null;
        IsKioskBusy = true;
        var loginBerhasil = false;
        try
        {
            var tersimpan = await BacaKioskTersimpanAsync();
            if (tersimpan is not null)
            {
                BukaKiosk(tersimpan);
                return;
            }

            var login = await _oauth.LoginWithGoogleAsync();
            if (!login.IsSuccess)
            {
                KioskMessage = login.ErrorMessage ?? "Login Google gagal.";
                return;
            }
            loginBerhasil = true;

            var hasil = await _kiosk.AktifkanAsync();
            var kredensial = new KioskCredential(
                hasil.Token,
                hasil.Url,
                DateTimeOffset.UtcNow.AddSeconds(hasil.ExpiresInDetik),
                hasil.Admin);

            await _kioskStore.SaveAsync(kredensial);
            BukaKiosk(kredensial);
        }
        catch (ApiException ex)
        {
            KioskMessage = ex.ServerMessage ?? ex.Message;
        }
        catch (Exception)
        {
            KioskMessage = "Gagal mengaktifkan kiosk dengan Google. Coba lagi.";
        }
        finally
        {
            if (loginBerhasil)
            {
                // Aktivasi tidak boleh meninggalkan sesi Admin aktif di layar login.
                try { await _auth.SignOutAsync(); }
                catch { /* sesi sementara — jangan gagalkan aktivasi */ }
            }
            IsKioskBusy = false;
        }
    }

    /// <summary>Token kiosk tersimpan yang masih berlaku; token kedaluwarsa dihapus.</summary>
    private async Task<KioskCredential?> BacaKioskTersimpanAsync()
    {
        var tersimpan = await _kioskStore.LoadAsync();
        if (tersimpan is null) return null;
        if (tersimpan.MasihBerlaku) return tersimpan;
        await _kioskStore.ClearAsync();
        return null;
    }

    private void BukaKiosk(KioskCredential kredensial)
    {
        KioskUrl = kredensial.Url;
        KioskToken = kredensial.Token;
        KioskAdmin = kredensial.Admin;
        IsKioskOpen = true;
    }

    [RelayCommand]
    private void TutupKiosk()
    {
        IsKioskOpen = false;
        KioskUrl = null;
        KioskToken = null;
    }

    /// <summary>Hapus token kiosk perangkat ini — absensi berikutnya butuh aktivasi Admin lagi.</summary>
    [RelayCommand]
    private async Task LupakanKioskAsync()
    {
        await _kioskStore.ClearAsync();
        TutupKiosk();
        KioskAdmin = null;
        KioskMessage = "Kiosk dilupakan di komputer ini. Aktifkan ulang dengan akun Admin bila diperlukan.";
    }

    /// <summary>Tampilkan status kiosk perangkat saat layar login dibuka.</summary>
    public async Task MuatStatusKioskAsync()
    {
        try
        {
            var tersimpan = await _kioskStore.LoadAsync();
            if (tersimpan is null || !tersimpan.MasihBerlaku) return;
            KioskAdmin = tersimpan.Admin;
            KioskMessage = string.IsNullOrWhiteSpace(tersimpan.Admin)
                ? "Kiosk aktif di komputer ini — absensi guru & siswa tanpa login."
                : $"Kiosk aktif di komputer ini (Admin: {tersimpan.Admin}) — absensi tanpa login.";
        }
        catch
        {
            // Status kiosk bersifat informatif — jangan ganggu layar login.
        }
    }
}
