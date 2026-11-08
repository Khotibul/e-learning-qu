using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using E_LearningQu.Desktop.ViewModels;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace E_LearningQu.Desktop.Views;

public partial class LoginView : UserControl
{
    /// <summary>Nama cookie perangkat yang dibaca halaman /absensi/kiosk (KIOSK_COOKIE di server).</summary>
    private const string KioskCookieName = "kiosk_absensi";

    private LoginViewModel? _vm;
    private bool _browserDisiapkan;

    public LoginView()
    {
        InitializeComponent();
        BrandService.Changed += OnBrandChanged;
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        ApplyBrand();
    }

    private void OnBrandChanged() => Dispatcher.Invoke(ApplyBrand);

    private void ApplyBrand()
    {
        try
        {
            if (BrandService.Logo is not null) BrandLogo.Source = BrandService.Logo;
            BrandName.Text = BrandService.SiteName;
            BrandTagline.Text = BrandService.Tagline;
        }
        catch { /* kosmetik */ }
    }

    /// <summary>PasswordBox tidak bindable di WPF — sinkronkan manual ke VM.</summary>
    private void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm && sender is PasswordBox pb)
            vm.Password = pb.Password;
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (_vm is not null) _vm.PropertyChanged -= OnVmPropertyChanged;
        _vm = DataContext as LoginViewModel;
        if (_vm is not null) _vm.PropertyChanged += OnVmPropertyChanged;
    }

    private void OnVmPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName != nameof(LoginViewModel.IsKioskOpen)) return;

        if (_vm?.IsKioskOpen == true)
            _ = TampilkanKioskAsync(_vm.KioskUrl, _vm.KioskToken);
        else
            SembunyikanKiosk();
    }

    // ── Kiosk absensi (webcam wajah + sidik jari) ───────────────────

    private async Task TampilkanKioskAsync(string? url, string? token)
    {
        try
        {
            KioskErrorPanel.Visibility = Visibility.Collapsed;
            KioskBrowser.Visibility = Visibility.Visible;

            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(token))
            {
                TampilkanGalat("Token kiosk tidak tersedia. Tutup lalu aktifkan ulang dengan akun Admin.");
                return;
            }

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            {
                TampilkanGalat("Alamat kiosk tidak valid. Periksa Backend.BaseUrl di appsettings.json.");
                return;
            }

            // Tunggu overlay benar-benar tampil sebelum HwndHost WebView2 dibuat.
            await Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Loaded);

            var core = await PastikanBrowserAsync();
            if (core is null) return;

            // Suntikkan cookie perangkat yang sama dengan tombol "Aktifkan Kiosk Desktop"
            // di website, supaya halaman & API absensi tidak meminta login.
            var cookie = core.CookieManager.CreateCookie(KioskCookieName, token, uri.Host, "/");
            cookie.IsHttpOnly = true;
            cookie.IsSecure = uri.Scheme == Uri.UriSchemeHttps;
            cookie.SameSite = CoreWebView2CookieSameSiteKind.Lax;
            cookie.Expires = DateTime.Now.AddDays(29);
            core.CookieManager.AddOrUpdateCookie(cookie);

            core.Navigate(url);
        }
        catch (Exception ex)
        {
            TampilkanGalat(
                "WebView2 Runtime belum terpasang atau gagal disiapkan. Pasang \"Microsoft Edge WebView2 Runtime\" " +
                $"lalu coba lagi. ({ex.Message})");
        }
    }

    private async Task<CoreWebView2?> PastikanBrowserAsync()
    {
        if (KioskBrowser.CoreWebView2 is not null) return KioskBrowser.CoreWebView2;

        if (!_browserDisiapkan)
        {
            var folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "E-LearningQu", "WebView2");
            Directory.CreateDirectory(folder);
            KioskBrowser.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = folder };
            _browserDisiapkan = true;
        }

        await KioskBrowser.EnsureCoreWebView2Async();
        var core = KioskBrowser.CoreWebView2;
        if (core is null) return null;

        core.PermissionRequested += OnPermissionRequested;
        core.NavigationCompleted += OnNavigationCompleted;
        core.NewWindowRequested += OnNewWindowRequested;
        return core;
    }

    /// <summary>Kamera hanya diizinkan untuk origin backend yang sedang ditampilkan.</summary>
    private void OnPermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        if (e.PermissionKind != CoreWebView2PermissionKind.Camera) return;

        var halaman = KioskBrowser.Source;
        if (halaman is null || !Uri.TryCreate(e.Uri, UriKind.Absolute, out var diminta)) return;
        if (!string.Equals(halaman.Host, diminta.Host, StringComparison.OrdinalIgnoreCase)) return;

        e.State = CoreWebView2PermissionState.Allow;
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess) return;
        TampilkanGalat(
            "Gagal memuat halaman kiosk. Periksa koneksi internet ke server, lalu tekan Muat Ulang.");
    }

    /// <summary>Kiosk tidak boleh membuka jendela browser baru di dalam aplikasi.</summary>
    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
    }

    private void SembunyikanKiosk()
    {
        try
        {
            var core = KioskBrowser.CoreWebView2;
            // Cookie perangkat juga dihapus saat kiosk ditutup/dilupakan — token
            // tidak boleh tetap hidup di profil WebView2 setelah sesi selesai.
            if (core is not null && _vm?.KioskUrl is string url &&
                Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                core.CookieManager.DeleteCookies(KioskCookieName, uri.ToString());
            }
            core?.Navigate("about:blank");
        }
        catch { /* browser belum siap */ }
        KioskErrorPanel.Visibility = Visibility.Collapsed;
    }

    private void TampilkanGalat(string pesan)
    {
        KioskErrorText.Text = pesan;
        KioskErrorPanel.Visibility = Visibility.Visible;
        KioskBrowser.Visibility = Visibility.Collapsed;
    }

    private void OnMuatUlangKiosk(object sender, RoutedEventArgs e)
    {
        if (_vm is null) return;
        if (KioskBrowser.CoreWebView2 is not null && KioskErrorPanel.Visibility != Visibility.Visible)
            KioskBrowser.CoreWebView2.Reload();
        else
            _ = TampilkanKioskAsync(_vm.KioskUrl, _vm.KioskToken);
    }

    private void OnTutupKiosk(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm)
            vm.TutupKioskCommand.Execute(null);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        BrandService.Changed -= OnBrandChanged;
        if (_vm is not null) _vm.PropertyChanged -= OnVmPropertyChanged;
        try
        {
            if (KioskBrowser.CoreWebView2 is not null) KioskBrowser.Dispose();
        }
        catch { /* shutdown */ }
    }
}
