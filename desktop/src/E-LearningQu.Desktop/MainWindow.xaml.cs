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

    public MainWindow(ISessionManager session, IAuthService auth, IOAuthService oauth, IDashboardService dashboard, IAkademikService akademik)
    {
        InitializeComponent();
        _session = session;
        _auth = auth;
        _oauth = oauth;
        _dashboard = dashboard;
        _akademik = akademik;
        LogoutButton.Click += OnLogout;
        Loaded += OnLoadedAsync;
    }

    private async void OnLoadedAsync(object sender, RoutedEventArgs e)
    {
        Loaded -= OnLoadedAsync;
        var restored = await _session.RestoreAsync();
        if (restored is not null)
            ShowShell();
        else
            ShowLogin();
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

        MenuList.ItemsSource = MenuFor(session);
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

    private static IReadOnlyList<MenuItemEntry> MenuFor(Domain.Identity.UserSession session)
    {
        var perms = session.Permissions;
        var menu = new List<MenuItemEntry>();

        // Selalu ada dashboard bila role punya dashboard permission.
        if (perms.Contains(Domain.Identity.Permissions.SiswaDashboard) ||
            perms.Contains(Domain.Identity.Permissions.GuruDashboard) ||
            perms.Contains(Domain.Identity.Permissions.AdminDashboard) ||
            perms.Contains(Domain.Identity.Permissions.KepalaPondokDashboard) ||
            perms.Contains(Domain.Identity.Permissions.PengurusPondokDashboard) ||
            perms.Contains(Domain.Identity.Permissions.UstadzPondokDashboard))
            menu.Add(new MenuItemEntry("dashboard", "Beranda", "🏠"));

        void Add(string perm, string key, string label, string icon)
        {
            if (perms.Contains(perm)) menu.Add(new MenuItemEntry(key, label, icon));
        }

        // Siswa
        Add(Domain.Identity.Permissions.SiswaUjian, "ujian", "Ujian", "📝");
        Add(Domain.Identity.Permissions.SiswaLatihan, "latihan", "Latihan", "✏️");
        Add(Domain.Identity.Permissions.SiswaAbsensi, "absensi", "Absensi", "🗓️");
        Add(Domain.Identity.Permissions.SiswaKehadiran, "kehadiran", "Kehadiran", "📍");
        Add(Domain.Identity.Permissions.SiswaMateri, "materi", "Materi", "📖");
        Add(Domain.Identity.Permissions.SiswaNilai, "nilai", "Nilai", "📊");
        Add(Domain.Identity.Permissions.SiswaRanking, "ranking", "Ranking", "🏆");
        Add(Domain.Identity.Permissions.SiswaJadwalPelajaran, "jadwal", "Jadwal", "🗓️");
        Add(Domain.Identity.Permissions.SiswaAiTutor, "ai-tutor", "AI Tutor", "🤖");
        Add(Domain.Identity.Permissions.SiswaAiAnalitik, "ai-analitik", "AI Analitik", "🧠");
        Add(Domain.Identity.Permissions.SiswaDompet, "dompet", "Dompet", "👛");
        Add(Domain.Identity.Permissions.SiswaIuran, "iuran", "Iuran", "🧾");

        // Guru
        Add(Domain.Identity.Permissions.GuruMurid, "murid", "Murid", "👨‍🎓");
        Add(Domain.Identity.Permissions.GuruBankSoal, "soal", "Bank Soal", "🗂️");
        Add(Domain.Identity.Permissions.GuruUjian, "ujian", "Kelola Ujian", "📝");
        Add(Domain.Identity.Permissions.GuruAbsensi, "absensi", "Absensi", "🗓️");
        Add(Domain.Identity.Permissions.GuruNilai, "nilai", "Nilai", "📊");
        Add(Domain.Identity.Permissions.GuruMateri, "materi", "Materi", "📖");
        Add(Domain.Identity.Permissions.GuruAnalitik, "analitik", "Analitik", "📈");
        Add(Domain.Identity.Permissions.GuruIntervensi, "intervensi", "Intervensi", "🩺");
        Add(Domain.Identity.Permissions.GuruAntiCheat, "anti-cheat", "Anti-Cheat", "🛡️");

        // Admin
        Add(Domain.Identity.Permissions.AdminGuru, "admin-guru", "Guru", "👩‍🏫");
        Add(Domain.Identity.Permissions.AdminMurid, "admin-murid", "Murid", "👨‍🎓");
        Add(Domain.Identity.Permissions.AdminSantri, "admin-santri", "Santri", "🕌");
        Add(Domain.Identity.Permissions.AdminPpdb, "admin-ppdb", "PPDB", "📮");
        Add(Domain.Identity.Permissions.AdminKelas, "admin-kelas", "Kelas", "🏫");
        Add(Domain.Identity.Permissions.AdminNilai, "admin-nilai", "Nilai", "📊");
        Add(Domain.Identity.Permissions.AdminPengumuman, "admin-pengumuman", "Pengumuman", "📢");
        Add(Domain.Identity.Permissions.AdminResearcher, "admin-researcher", "Peneliti", "🔬");
        Add(Domain.Identity.Permissions.AdminStatistik, "admin-statistik", "Statistik", "📉");

        // Pondok
        Add(Domain.Identity.Permissions.KepalaPondokKeuangan, "keuangan", "Keuangan Pondok", "💰");
        Add(Domain.Identity.Permissions.KepalaPondokGerbang, "gerbang", "Gerbang Pondok", "🚪");
        Add(Domain.Identity.Permissions.KepalaPondokUstadz, "ustadz", "Ustadz Pondok", "👨‍🏫");
        Add(Domain.Identity.Permissions.KepalaPondokPengurus, "pengurus", "Pengurus Pondok", "👥");

        return menu.Count == 0 ? new MenuItemEntry[] { new("dashboard", "Beranda", "🏠") } : menu;
    }

    private void OnMenuSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (MenuList.SelectedItem is not MenuItemEntry item) return;
        Navigate(item.Key);
    }

    private void Navigate(string key)
    {
        var session = _session.Current;
        if (session is null) return;

        if (key == "dashboard")
        {
            switch (session.Role)
            {
                case Domain.Enums.Role.SISWA:
                {
                    var vm = new SiswaDashboardViewModel(_dashboard);
                    ContentHost.Content = new SiswaDashboardView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
                case Domain.Enums.Role.GURU:
                {
                    var vm = new GuruDashboardViewModel(_dashboard);
                    ContentHost.Content = new GuruDashboardView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
                default:
                    // ADMIN / RESEARCHER / role pondok — belum ada khusus (PHASE 3/4).
                    ContentHost.Content = new PlaceholderView($"Dashboard {DescribeRole(session)}");
                    return;
            }
        }

        // Modul akademik siswa (PHASE 5) — endpoint mobile sudah tersedia.
        if (session.Role == Domain.Enums.Role.SISWA)
        {
            switch (key)
            {
                case "ujian":
                {
                    var vm = new UjianListViewModel(_akademik, _session);
                    var view = new UjianListView { DataContext = vm };
                    vm.BukaUjian += (_, ujian) => BukaKerjakanUjian(ujian);
                    ContentHost.Content = view;
                    _ = vm.LoadAsync();
                    return;
                }
                case "nilai":
                {
                    var vm = new NilaiViewModel(_akademik);
                    ContentHost.Content = new NilaiView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
                case "jadwal":
                {
                    var vm = new JadwalViewModel(_akademik);
                    ContentHost.Content = new JadwalView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
                case "materi":
                {
                    var vm = new MateriViewModel(_akademik);
                    ContentHost.Content = new MateriView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
                case "absensi":
                {
                    var vm = new KehadiranViewModel(_akademik);
                    ContentHost.Content = new KehadiranView { DataContext = vm };
                    _ = vm.LoadAsync();
                    return;
                }
            }
        }

        var title = key switch
        {
            "ujian" => "Kelola Ujian",
            "murid" or "admin-murid" => "Murid",
            "soal" => "Bank Soal",
            "absensi" => "Absensi",
            "materi" => "Materi",
            "nilai" or "admin-nilai" => "Nilai",
            "jadwal" => "Jadwal Pelajaran",
            "kehadiran" => "Kehadiran",
            "latihan" => "Latihan",
            "ranking" => "Ranking",
            "ai-tutor" => "AI Tutor",
            "ai-analitik" => "AI Analitik",
            "dompet" => "Dompet",
            "iuran" => "Iuran",
            "analitik" => "Analitik",
            "intervensi" => "Intervensi",
            "anti-cheat" => "Anti-Cheat",
            "admin-guru" => "Data Guru",
            "admin-santri" => "Data Santri",
            "admin-ppdb" => "PPDB",
            "admin-kelas" => "Kelas",
            "admin-pengumuman" => "Pengumuman",
            "admin-researcher" => "Peneliti",
            "admin-statistik" => "Statistik",
            "keuangan" => "Keuangan Pondok",
            "gerbang" => "Gerbang Pondok",
            "ustadz" => "Ustadz Pondok",
            "pengurus" => "Pengurus Pondok",
            _ => key
        };
        ContentHost.Content = new PlaceholderView(title);
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

    private sealed record MenuItemEntry(string Key, string Label, string Icon);
}
