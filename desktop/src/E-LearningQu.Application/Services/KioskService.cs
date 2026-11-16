using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Application.Services;

/// <summary>Klaim token kiosk desktop lewat /api/mobile/desktop/kiosk memakai sesi Admin.</summary>
public sealed class KioskService : IKioskService
{
    /// <summary>Batas waktu Admin menyelesaikan login di browser.</summary>
    private static readonly TimeSpan BrowserTimeout = TimeSpan.FromMinutes(3);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public KioskService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    public async Task<KioskActivationResponse> AktifkanAsync(CancellationToken ct = default)
    {
        var token = _session.Current?.Token;
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Sesi Admin belum aktif — masukkan email dan kata sandi Admin terlebih dahulu.");

        // Nama komputer ikut dikirim agar panel Admin bisa menampilkan status per perangkat.
        var response = await _api.PostAsync<object, KioskActivationResponse>(
            "/api/mobile/desktop/kiosk",
            new { perangkatNama = Environment.MachineName },
            token,
            ct);
        if (string.IsNullOrWhiteSpace(response.Token) || string.IsNullOrWhiteSpace(response.Url))
            throw new InvalidOperationException("Server tidak mengembalikan token kiosk yang valid.");
        return response;
    }

    /// <summary>
    /// Aktivasi untuk Admin yang masuk dengan Google. Google menolak redirect loopback
    /// pada client ID tipe Web yang dipakai situs ini (redirect_uri_mismatch), jadi OAuth
    /// tidak dijalankan di dalam aplikasi. Sebagai gantinya browser sistem dibuka ke
    /// /desktop/aktivasi-kiosk; setelah Admin masuk, halaman itu mengirim token kiosk ke
    /// listener loopback di sini. Nonce (state) memastikan hanya halaman aktivasi yang
    /// kita buka sendiri yang bisa menyerahkan token.
    /// </summary>
    public async Task<KioskActivationResponse> AktifkanLewatBrowserAsync(CancellationToken ct = default)
    {
        var port = GetFreeLoopbackPort();
        var state = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var baseUrl = _api.BaseUrl.TrimEnd('/');
        var halaman = $"{baseUrl}/desktop/aktivasi-kiosk?port={port}&state={Uri.EscapeDataString(state)}";

        // Prefix "localhost" diizinkan tanpa hak admin; "127.0.0.1" ditolak http.sys
        // (HttpListenerException: Access is denied) pada aplikasi yang tidak dielevasi.
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        try
        {
            listener.Start();
        }
        catch (HttpListenerException)
        {
            throw new InvalidOperationException("Tidak bisa membuka port lokal untuk aktivasi kiosk. Coba lagi.");
        }

        try
        {
            Process.Start(new ProcessStartInfo(halaman) { UseShellExecute = true });
        }
        catch
        {
            throw new InvalidOperationException("Tidak dapat membuka browser. Pastikan browser default tersedia.");
        }

        return await TungguCallbackAktivasiAsync(listener, state, BrowserTimeout, ct);
    }

    /// <summary>
    /// Menunggu halaman aktivasi web mengirim token ke listener loopback.
    /// Dipisah dari pembukaan browser supaya alur ini bisa diuji tanpa membuka jendela.
    /// </summary>
    public static async Task<KioskActivationResponse> TungguCallbackAktivasiAsync(
        HttpListener listener,
        string state,
        TimeSpan batasWaktu,
        CancellationToken ct = default)
    {
        HttpListenerContext context;
        using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct))
        {
            timeout.CancelAfter(batasWaktu);
            try
            {
                var menerima = listener.GetContextAsync();
                var selesai = await Task.WhenAny(menerima, Task.Delay(Timeout.Infinite, timeout.Token));
                if (selesai != menerima)
                    throw new InvalidOperationException("Aktivasi lewat browser tidak selesai (waktu habis). Coba lagi.");
                context = await menerima;
            }
            catch (OperationCanceledException)
            {
                throw new InvalidOperationException("Aktivasi lewat browser dibatalkan.");
            }
            catch (HttpListenerException)
            {
                throw new InvalidOperationException("Aktivasi lewat browser gagal — listener lokal tertutup.");
            }
        }

        var query = context.Request.QueryString;
        var token = query["token"];
        var url = query["url"];
        var admin = query["admin"];
        var exp = query["exp"];
        var valid =
            string.Equals(query["state"], state, StringComparison.Ordinal) &&
            !string.IsNullOrWhiteSpace(token) &&
            !string.IsNullOrWhiteSpace(url);

        await TulisHalamanAsync(
            context,
            valid ? "Kiosk aktif. Kembali ke aplikasi desktop." : "Aktivasi kiosk ditolak. Jalankan ulang dari aplikasi desktop.",
            valid);

        if (!valid)
            throw new InvalidOperationException("Aktivasi kiosk ditolak — jalankan ulang dari aplikasi desktop.");

        return new KioskActivationResponse
        {
            Token = token!,
            Url = url!,
            Admin = string.IsNullOrWhiteSpace(admin) ? "Admin" : admin,
            ExpiresInDetik = int.TryParse(exp, out var detik) && detik > 0 ? detik : 30 * 24 * 60 * 60,
        };
    }

    private static async Task TulisHalamanAsync(HttpListenerContext context, string pesan, bool berhasil)
    {
        var warna = berhasil ? "#16a34a" : "#dc2626";
        var html =
            "<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\"><title>Aktivasi Kiosk</title></head>" +
            "<body style=\"font-family:system-ui,sans-serif;text-align:center;padding-top:80px;color:#111\">" +
            "<h2 style=\"margin:0 0 8px\">E-Learning-Qu Desktop</h2>" +
            $"<p style=\"color:{warna};font-weight:600\">{WebUtility.HtmlEncode(pesan)}</p>" +
            "<p style=\"color:#666;font-size:14px\">Jendela ini boleh ditutup.</p></body></html>";

        var buffer = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength64 = buffer.Length;
        try
        {
            await context.Response.OutputStream.WriteAsync(buffer);
        }
        finally
        {
            context.Response.OutputStream.Close();
        }
    }

    private static int GetFreeLoopbackPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
