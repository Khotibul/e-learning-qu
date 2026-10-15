using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Academic;
using E_LearningQu.Desktop.ViewModels;
using E_LearningQu.Desktop.Views;
using E_LearningQu.Infrastructure.Http;

namespace E_LearningQu.Desktop;

public partial class MainWindow : Window
{
    private readonly ISessionManager _session;
    private readonly IAuthService _auth;
    private readonly IOAuthService _oauth;
    private readonly IDashboardService _dashboard;
    private readonly IAkademikService _akademik;
    private readonly INavigationService _nav;
    private readonly IGuruService _guru;
    private readonly ISiswaService _siswa;
    private readonly IAdminService _admin;
    private readonly IPondokService _pondok;

    /// <summary>Salinan menu tanpa saringan — dipakai ulang saat kolom cari dikosongkan.</summary>
    private IReadOnlyList<MenuItemDef> _menuAll = Array.Empty<MenuItemDef>();

    public MainWindow(ISessionManager session, IAuthService auth, IOAuthService oauth, IDashboardService dashboard, IAkademikService akademik, INavigationService nav, IGuruService guru, ISiswaService siswa, IAdminService admin, IPondokService pondok)
    {
        InitializeComponent();
        _session = session;
        _auth = auth;
        _oauth = oauth;
        _dashboard = dashboard;
        _akademik = akademik;
        _nav = nav;
        _guru = guru;
        _siswa = siswa;
        _admin = admin;
        _pondok = pondok;
        BackendApiClient.ConnectionChanged += OnConnectionChanged;
        BackendApiClient.SessionExpired += OnSessionExpired;
        BrandService.Changed += OnBrandChanged;
        Loaded += OnLoadedAsync;
        DialogService.Owner = this;
        ApplyBrand();
    }

    /// <summary>Terapkan brand dari SiteConfig (logo/nama/tagline/ikon jendela).</summary>
    private void OnBrandChanged() => Dispatcher.Invoke(ApplyBrand);

    private void ApplyBrand()
    {
        try
        {
            if (BrandService.Logo is not null) BrandLogo.Source = BrandService.Logo;
            BrandName.Text = BrandService.SiteName;
            BrandTagline.Text = BrandService.Tagline;
            if (BrandService.Favicon is not null) Icon = BrandService.Favicon;
            var suffix = Title.Contains(" — ") ? Title[(Title.IndexOf(" — ") + 3)..] : Title;
            Title = $"{BrandService.SiteName} — {suffix}";
        }
        catch { /* brand bersifat kosmetik — jangan ganggu startup */ }
    }

    private void OnSessionExpired()
    {
        try
        {
            Dispatcher.Invoke(async () =>
            {
                DesktopLog.Log("Session expired (401 setelah refresh gagal) — force logout");
                DialogService.Toast("Sesi berakhir — silakan login ulang.", ToastKind.Warning);
                await _auth.SignOutAsync();
                _menuAll = Array.Empty<MenuItemDef>();
                MenuList.ItemsSource = null;
                ContentHost.Content = null;
                ShowLogin();
            });
        }
        catch { /* event boleh datang dari thread non-UI setelah window ditutup */ }
    }

    private void OnConnectionChanged(bool online)
    {
        try
        {
            Dispatcher.Invoke(() =>
            {
                ConnDot.Fill = new System.Windows.Media.SolidColorBrush(
                    online ? System.Windows.Media.Colors.LimeGreen : System.Windows.Media.Colors.OrangeRed);
                ConnLabel.Text = online ? "Terhubung server" : "Terputus — cek jaringan";
            });
        }
        catch { /* event boleh datang dari thread non-UI setelah window ditutup */ }
    }

    private async void OnLoadedAsync(object sender, RoutedEventArgs e)
    {
        Loaded -= OnLoadedAsync;
        try
        {
            var restored = await _session.RestoreAsync();
            DesktopLog.Log($"App start: restored={(restored is not null)} tokenLen={restored?.Token?.Length ?? 0} role={restored?.Role.ToString() ?? "-"}");
            if (restored is not null && await _auth.ValidateSessionAsync())
                ShowShell();
            else
                ShowLogin();
        }
        catch (Exception ex)
        {
            // Restore/validate gagal (file DPAPI rusak / jaringan) — jangan crash, kembali ke login.
            DesktopLog.Log($"App start FAIL: {ex}");
            ShowLogin();
        }
    }

    private void ShowLogin()
    {
        ShellHost.Visibility = Visibility.Collapsed;
        LoginHost.Visibility = Visibility.Visible;
        Title = $"{BrandService.SiteName} — Masuk";

        var vm = new LoginViewModel(_auth, _oauth);
        vm.LoginSucceeded += (_, _) => ShowShell();
        LoginContentHost.Content = new LoginView { DataContext = vm };
    }

    private void ShowShell()
    {
        var session = _session.Current;
        if (session is null)
        {
            ShowLogin();
            return;
        }

        LoginHost.Visibility = Visibility.Collapsed;
        ShellHost.Visibility = Visibility.Visible;
        Title = $"{BrandService.SiteName} — {session.DisplayName}";

        UserLabel.Text = session.DisplayName;
        RoleLabel.Text = DescribeRole(session);

        _menuAll = _nav.BuildMenu(session);
        MenuList.ItemsSource = _menuAll;
        if (MenuList.Items.Count > 0)
            MenuList.SelectedIndex = 0;
    }

    private static string DescribeRole(Domain.Identity.UserSession session) => session.Role switch
    {
        Domain.Enums.Role.SISWA when !string.IsNullOrEmpty(session.KelasNama)
            => $"Siswa • {session.KelasNama}" + (string.IsNullOrEmpty(session.Jabatan) ? "" : $" • {session.Jabatan}"),
        Domain.Enums.Role.GURU when !string.IsNullOrEmpty(session.Jabatan) => $"Guru • {session.Jabatan}",
        Domain.Enums.Role.SISWA => "Siswa",
        Domain.Enums.Role.GURU => "Guru",
        Domain.Enums.Role.ADMIN => "Administrator",
        Domain.Enums.Role.RESEARCHER => "Peneliti",
        Domain.Enums.Role.KEPALA_PONDOK => "Kepala Pondok",
        Domain.Enums.Role.PENGURUS_PONDOK => "Pengurus Pondok",
        Domain.Enums.Role.USTADZ_PONDOK => "Ustadz Pondok",
        _ => session.Role.ToString()
    };

    private void OnMenuSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (MenuList.SelectedItem is not MenuItemDef item) return;
        Navigate(item);
    }

    /// <summary>Saring menu sidebar berdasarkan DisplayName (tidak case-sensitive).</summary>
    private void OnMenuSearchChanged(object sender, TextChangedEventArgs e)
    {
        var q = MenuSearchBox.Text.Trim();
        MenuList.ItemsSource = string.IsNullOrWhiteSpace(q)
            ? _menuAll
            : _menuAll.Where(i => i.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    private bool _sidebarCollapsed;

    private void OnToggleSidebar(object sender, MouseButtonEventArgs e)
    {
        _sidebarCollapsed = !_sidebarCollapsed;
        var col = ShellHost.ColumnDefinitions[0];
        col.Width = new GridLength(_sidebarCollapsed ? 72 : 264);
        SidebarText.Visibility = _sidebarCollapsed ? Visibility.Collapsed : Visibility.Visible;
        CollapseGlyph.Text = _sidebarCollapsed ? "»" : "«";
        UserLabel.Visibility = RoleLabel.Visibility = _sidebarCollapsed ? Visibility.Collapsed : Visibility.Visible;
        LogoutButton.Content = _sidebarCollapsed ? "⏻" : "⏻  Keluar";
        ConnLabel.Visibility = _sidebarCollapsed ? Visibility.Collapsed : Visibility.Visible;
        MenuSearchBox.Visibility = _sidebarCollapsed ? Visibility.Collapsed : Visibility.Visible;
    }

    private void Navigate(MenuItemDef item)
    {
        var session = _session.Current;
        if (session is null) return;
        DesktopLog.Log($"Navigate {item.ViewKey} (role={session.Role}, tokenLen={session.Token?.Length ?? 0})");

        // Cleanup: stop ujian timers if currently on KerjakanUjianView
        if (ContentHost.Content is KerjakanUjianView { DataContext: KerjakanUjianViewModel kuj })
            kuj.StopTimers();

        switch (item.ViewKey)
        {
            case "siswa-dashboard":
            {
                var vm = new SiswaDashboardViewModel(_dashboard);
                ContentHost.Content = new SiswaDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-dashboard":
            {
                var vm = new GuruDashboardViewModel(_dashboard);
                ContentHost.Content = new GuruDashboardView { DataContext = vm };
                _ = vm.RefreshCommand.ExecuteAsync(null);
                return;
            }
            case "guru-murid":
            {
                var vm = new GuruMuridViewModel(_guru);
                ContentHost.Content = new GuruMuridView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-bank-soal":
            case "guru-soal":
            {
                var vm = new GuruSoalViewModel(_guru);
                ContentHost.Content = new GuruSoalView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-ujian":
            {
                var vm = new GuruUjianViewModel(_guru);
                ContentHost.Content = new GuruUjianView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-analitik":
            {
                var vm = new GuruAnalitikViewModel(_guru);
                ContentHost.Content = new GuruAnalitikView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-materi":
            {
                var vm = new GuruMateriViewModel(_guru);
                ContentHost.Content = new GuruMateriView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-nilai":
            {
                var vm = new GuruNilaiViewModel(_guru);
                ContentHost.Content = new GuruNilaiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-absensi":
            {
                var vm = new GuruAbsensiViewModel(_guru);
                ContentHost.Content = new GuruAbsensiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-pengaturan":
            {
                var vm = new GuruProfilViewModel(_guru);
                ContentHost.Content = new GuruProfilView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-wali-kelas":
            {
                var vm = new GuruWaliKelasViewModel(_guru);
                ContentHost.Content = new GuruWaliKelasView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-anti-cheat":
            {
                var vm = new GuruAntiCheatViewModel(_guru);
                ContentHost.Content = new GuruAntiCheatView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-intervensi":
            {
                var vm = new GuruIntervensiViewModel(_guru);
                ContentHost.Content = new GuruIntervensiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-pelanggaran":
            {
                var vm = new GuruPelanggaranViewModel(_guru);
                ContentHost.Content = new GuruPelanggaranView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-ai-knowledge":
            {
                var vm = new GuruAiKnowledgeViewModel(_guru);
                ContentHost.Content = new GuruAiKnowledgeView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-ai-tutor":
            {
                var vm = new SiswaAiTutorViewModel(_siswa);
                ContentHost.Content = new SiswaAiTutorView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-bendahara":
            {
                var vm = new SiswaBendaharaViewModel(_siswa);
                ContentHost.Content = new SiswaBendaharaView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-sekretaris":
            {
                var vm = new SiswaSekretarisViewModel(_siswa);
                ContentHost.Content = new SiswaSekretarisView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-ujian":
            {
                var vm = new UjianListViewModel(_akademik, _session);
                var view = new UjianListView { DataContext = vm };
                vm.BukaUjian += (_, ujian) => BukaKerjakanUjian(ujian);
                ContentHost.Content = view;
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-nilai":
            {
                var vm = new NilaiViewModel(_akademik);
                ContentHost.Content = new NilaiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-jadwal":
            {
                var vm = new JadwalViewModel(_akademik);
                ContentHost.Content = new JadwalView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-materi":
            {
                var vm = new MateriViewModel(_akademik);
                ContentHost.Content = new MateriView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-kehadiran":
            {
                var vm = new KehadiranViewModel(_akademik);
                ContentHost.Content = new KehadiranView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-latihan":
            {
                var vm = new SiswaLatihanViewModel(_siswa);
                ContentHost.Content = new SiswaLatihanView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-absensi":
            {
                var vm = new SiswaAbsensiViewModel(_siswa);
                ContentHost.Content = new SiswaAbsensiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-struktur-kelas":
            {
                var vm = new SiswaStrukturKelasViewModel(_siswa);
                ContentHost.Content = new SiswaStrukturKelasView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-jadwal-piket":
            {
                var vm = new SiswaJadwalPiketViewModel(_siswa);
                ContentHost.Content = new SiswaJadwalPiketView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-iuran":
            {
                var vm = new SiswaIuranViewModel(_siswa);
                ContentHost.Content = new SiswaIuranView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-ranking":
            {
                var vm = new SiswaRankingViewModel(_siswa);
                ContentHost.Content = new SiswaRankingView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-pengaturan":
            {
                var vm = new SiswaPengaturanViewModel(_siswa);
                ContentHost.Content = new SiswaPengaturanView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-ai-analitik":
            {
                var vm = new SiswaAiAnalitikViewModel(_siswa);
                ContentHost.Content = new SiswaAiAnalitikView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-dashboard":
            {
                var vm = new AdminDashboardViewModel(_admin);
                ContentHost.Content = new AdminDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-guru":
            {
                var vm = new AdminGuruViewModel(_admin);
                ContentHost.Content = new AdminGuruView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-murid":
            {
                var vm = new AdminMuridViewModel(_admin);
                ContentHost.Content = new AdminMuridView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-kelas":
            {
                var vm = new AdminKelasViewModel(_admin);
                ContentHost.Content = new AdminKelasView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-mapel":
            {
                var vm = new AdminMapelViewModel(_admin);
                ContentHost.Content = new AdminMapelView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-tahun-ajaran":
            {
                var vm = new AdminTahunAjaranViewModel(_admin);
                ContentHost.Content = new AdminTahunAjaranView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-semester":
            {
                var vm = new AdminSemesterViewModel(_admin);
                ContentHost.Content = new AdminSemesterView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-jurusan":
            {
                var vm = new AdminJurusanViewModel(_admin);
                ContentHost.Content = new AdminJurusanView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-kompetensi":
            {
                var vm = new AdminKompetensiViewModel(_admin);
                ContentHost.Content = new AdminKompetensiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-pengumuman":
            {
                var vm = new AdminPengumumanViewModel(_admin);
                ContentHost.Content = new AdminPengumumanView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-nilai":
            {
                var vm = new AdminNilaiViewModel(_admin);
                ContentHost.Content = new AdminNilaiView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-statistik":
            {
                var vm = new AdminStatistikViewModel(_admin);
                ContentHost.Content = new AdminStatistikView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-pengaturan":
            {
                var vm = new AdminPengaturanViewModel(_admin);
                ContentHost.Content = new AdminPengaturanView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-jadwal-ujian":
            {
                var vm = new AdminJadwalUjianViewModel(_admin);
                ContentHost.Content = new AdminJadwalUjianView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-researcher":
            {
                var vm = new AdminResearcherViewModel(_admin);
                ContentHost.Content = new AdminResearcherView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-courses":
            {
                var vm = new AdminCoursesViewModel(_admin);
                ContentHost.Content = new AdminCoursesView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-jadwal":
            {
                var vm = new AdminJadwalViewModel(_admin);
                ContentHost.Content = new AdminJadwalView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-santri":
            {
                var vm = new AdminSantriViewModel(_admin);
                ContentHost.Content = new AdminSantriView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-ppdb":
            {
                var vm = new AdminPpdbViewModel(_admin);
                ContentHost.Content = new AdminPpdbView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-izin":
            {
                var vm = new AdminIzinViewModel(_admin);
                ContentHost.Content = new AdminIzinView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "siswa-dompet":
            {
                var vm = new SiswaDompetViewModel(_admin);
                ContentHost.Content = new SiswaDompetView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "santri-izin":
            {
                var vm = new SiswaIzinViewModel(_admin);
                ContentHost.Content = new SiswaIzinView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "guru-izin-musyrif":
            {
                var vm = new GuruIzinMusyrifViewModel(_admin);
                ContentHost.Content = new GuruIzinMusyrifView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "kantin":
            {
                var vm = new KantinViewModel(_admin);
                ContentHost.Content = new KantinView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "kepala-pondok-dashboard":
            {
                var vm = new KepalaPondokDashboardViewModel(_pondok);
                ContentHost.Content = new KepalaPondokDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "kepala-pondok-keuangan":
            {
                var vm = new KepalaPondokKeuanganViewModel(_pondok);
                ContentHost.Content = new KepalaPondokKeuanganView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "pengurus-dashboard":
            case "pengurus":
            {
                var vm = new PengurusDashboardViewModel(_pondok);
                ContentHost.Content = new PengurusDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "ustadz-dashboard":
            case "ustadz":
            {
                var vm = new UstadzDashboardViewModel(_pondok);
                ContentHost.Content = new UstadzDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "gerbang":
            {
                var vm = new GerbangViewModel(_pondok);
                ContentHost.Content = new GerbangView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-absensi-guru":
            {
                var vm = new AdminAbsensiGuruViewModel(_admin);
                ContentHost.Content = new AdminAbsensiGuruView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "admin-fingerprint":
            {
                var vm = new AdminFingerprintViewModel(_admin);
                ContentHost.Content = new AdminFingerprintView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            case "bendahara":
            {
                var vm = new AdminKeuanganViewModel(_admin);
                ContentHost.Content = new AdminKeuanganView { DataContext = vm };
                _ = vm.LoadAsync();
                return;
            }
            default:
                // View belum diimplementasi — Placeholder (tercatat sebagai GAP, bukan selesai).
                ContentHost.Content = new PlaceholderView(item.DisplayName);
                return;
        }
    }

    private void BukaKerjakanUjian(UjianListItemDto ujian)
    {
        var vm = new KerjakanUjianViewModel(_akademik);
        ContentHost.Content = new KerjakanUjianView { DataContext = vm };
        _ = vm.MulaiAsync(ujian.Id);
    }

    private async void OnLogout(object sender, RoutedEventArgs e)
    {
        try
        {
            var ok = await DialogService.ConfirmAsync(
                "Keluar", "Yakin ingin keluar dari akun ini?", "Ya, Keluar");
            if (!ok) return;
            await _auth.SignOutAsync();
            _menuAll = Array.Empty<MenuItemDef>();
            MenuList.ItemsSource = null;
            ContentHost.Content = null;
            ShowLogin();
        }
        catch (Exception ex)
        {
            DialogService.Toast($"Gagal keluar: {ex.Message}", ToastKind.Error);
        }
    }
}
