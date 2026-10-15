using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using E_LearningQu.Contracts.Admin;

namespace E_LearningQu.Desktop;

/// <summary>
/// Branding dari SiteConfig website (GET /api/site-config — publik, tanpa auth).
/// Logo di-download lalu di-cache di LocalAppData; fallback: cache → aset tertanam Assets/logo.png.
/// Dipakai sidebar MainWindow + layar Login; event Changed boleh datang dari thread background.
/// </summary>
public static class BrandService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    private static readonly string CacheDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "E-LearningQu", "brand");

    private static readonly string CacheLogo = Path.Combine(CacheDir, "logo.png");
    private static readonly string CacheFavicon = Path.Combine(CacheDir, "favicon.png");

    public static string SiteName { get; private set; } = "E-Learning-Qu";
    public static string Tagline { get; private set; } = "Pondok Pesantren Digital";
    public static ImageSource? Logo { get; private set; }
    public static ImageSource? Favicon { get; private set; }

    public static event Action? Changed;

    /// <summary>Muat ulang brand dari server. Selalu memakai cache dulu (offline baseline),
    /// lalu ditimpa data terbaru bila jaringan berhasil. Aman dipanggil berulang.</summary>
    public static async System.Threading.Tasks.Task RefreshAsync(string baseUrl)
    {
        TryLoadCache();
        try
        {
            var baseTrim = baseUrl.TrimEnd('/');
            var json = await Http.GetStringAsync($"{baseTrim}/api/site-config");
            var cfg = JsonSerializer.Deserialize<SiteConfigDto>(json,
                new JsonSerializerOptions(JsonSerializerDefaults.Web));

            if (cfg is not null)
            {
                if (!string.IsNullOrWhiteSpace(cfg.SiteName)) SiteName = cfg.SiteName;
                if (!string.IsNullOrWhiteSpace(cfg.Tagline)) Tagline = cfg.Tagline;

                if (!string.IsNullOrWhiteSpace(cfg.LogoUrl))
                {
                    var bytes = await Http.GetByteArrayAsync(ToAbsolute(baseTrim, cfg.LogoUrl));
                    Directory.CreateDirectory(CacheDir);
                    File.WriteAllBytes(CacheLogo, bytes);
                    Logo = DecodeFrozen(bytes);
                }
                if (!string.IsNullOrWhiteSpace(cfg.FaviconUrl))
                {
                    var bytes = await Http.GetByteArrayAsync(ToAbsolute(baseTrim, cfg.FaviconUrl));
                    Directory.CreateDirectory(CacheDir);
                    File.WriteAllBytes(CacheFavicon, bytes);
                    Favicon = DecodeFrozen(bytes);
                }
            }
        }
        catch (Exception ex)
        {
            DesktopLog.Log($"BrandService refresh gagal (pakai cache/aset): {ex.Message}");
        }
        Changed?.Invoke();
    }

    private static string ToAbsolute(string baseTrim, string url) =>
        url.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? url
            : baseTrim + (url.StartsWith('/') ? "" : "/") + url;

    private static void TryLoadCache()
    {
        try
        {
            if (Logo is null && File.Exists(CacheLogo))
                Logo = DecodeFrozen(File.ReadAllBytes(CacheLogo));
            if (Favicon is null && File.Exists(CacheFavicon))
                Favicon = DecodeFrozen(File.ReadAllBytes(CacheFavicon));
        }
        catch (Exception ex)
        {
            DesktopLog.Log($"BrandService cache gagal: {ex.Message}");
        }
    }

    private static BitmapImage DecodeFrozen(byte[] bytes)
    {
        using var ms = new MemoryStream(bytes);
        var img = new BitmapImage();
        img.BeginInit();
        img.CacheOption = BitmapCacheOption.OnLoad;
        img.StreamSource = ms;
        img.EndInit();
        img.Freeze(); // aman dipakai dari thread mana pun
        return img;
    }
}
