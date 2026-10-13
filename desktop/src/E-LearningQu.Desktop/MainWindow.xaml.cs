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

        MenuList.ItemsSource = MenuFor(session.Role);
        MenuList.SelectedIndex = 0;
    }

    private static string DescribeRole(Domain.Identity.UserSession session) => session.Role switch
    {
        Domain.Enums.Role.SISWA when !string.IsNullOrEmpty(session.KelasNama)
            => $"Siswa • {session.KelasNama}" + (string.IsNullOrEmpty(session.Jabatan) ? "" : $" • {session.Jabatan}"),
        Domain.Enums.Role.GURU when !string.IsNullOrEmpty(session.Jabatan) => $"Guru • {session.Jabatan}",
        _ => session.Role.ToString()
    };

    private static IReadOnlyList<MenuItemEntry> MenuFor(Domain.Enums.Role role) => role switch
    {
        Domain.Enums.Role.SISWA => new MenuItemEntry[]
        {
            new("dashboard", "Dashboard"),
            new("ujian", "Ujian & Latihan"),
            new("absensi", "Absensi"),
            new("materi", "Materi"),
            new("nilai", "Nilai"),
            new("jadwal", "Jadwal"),
            new("ai-tutor", "AI Tutor"),
        },
        Domain.Enums.Role.GURU => new MenuItemEntry[]
        {
            new("dashboard", "Dashboard"),
            new("murid", "Murid"),
            new("ujian", "Kelola Ujian"),
            new("soal", "Bank Soal"),
            new("absensi", "Absensi"),
            new("nilai", "Nilai"),
            new("materi", "Materi"),
        },
        _ => new MenuItemEntry[] { new("dashboard", "Dashboard") }
    };

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
            if (session.Role == Domain.Enums.Role.SISWA)
            {
                var vm = new SiswaDashboardViewModel(_dashboard);
                ContentHost.Content = new SiswaDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
            }
            else
            {
                var vm = new GuruDashboardViewModel(_dashboard);
                ContentHost.Content = new GuruDashboardView { DataContext = vm };
                _ = vm.LoadAsync();
            }
            return;
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
            "murid" => "Murid",
            "soal" => "Bank Soal",
            "absensi" => "Absensi",
            "materi" => "Materi",
            "nilai" => "Nilai",
            "jadwal" => "Jadwal",
            "ai-tutor" => "AI Tutor",
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

    private sealed record MenuItemEntry(string Key, string Label);
}
