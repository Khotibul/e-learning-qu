using System.Windows;
using System.Windows.Controls;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Academic;
using E_LearningQu.Desktop.ViewModels;
using E_LearningQu.Desktop.Views;

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
        LogoutButton.Click += OnLogout;
        Loaded += OnLoadedAsync;
    }

    private async void OnLoadedAsync(object sender, RoutedEventArgs e)
    {
        Loaded -= OnLoadedAsync;
        try
        {
            var restored = await _session.RestoreAsync();
            if (restored is not null && await _auth.ValidateSessionAsync())
                ShowShell();
            else
                ShowLogin();
        }
        catch (Exception)
        {
            // Restore/validate gagal (file DPAPI rusak / jaringan) — jangan crash, kembali ke login.
            ShowLogin();
        }
    }

    private void ShowLogin()
    {
        ShellHost.Visibility = Visibility.Collapsed;
        LoginHost.Visibility = Visibility.Visible;
        Title = "E-Learning-Qu Desktop — Masuk";

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
        Title = $"E-Learning-Qu Desktop — {session.DisplayName}";

        UserLabel.Text = session.DisplayName;
        RoleLabel.Text = DescribeRole(session);

        MenuList.ItemsSource = _nav.BuildMenu(session);
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

    private void Navigate(MenuItemDef item)
    {
        var session = _session.Current;
        if (session is null) return;

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
        await _auth.SignOutAsync();
        MenuList.ItemsSource = null;
        ContentHost.Content = null;
        ShowLogin();
    }
}
