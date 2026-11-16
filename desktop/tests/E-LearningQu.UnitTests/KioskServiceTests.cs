using System.Net;
using System.Net.Sockets;
using E_LearningQu.Application.Services;

namespace E_LearningQu.UnitTests;

/// <summary>
/// Aktivasi kiosk lewat browser: halaman /desktop/aktivasi-kiosk menyerahkan token
/// ke listener loopback aplikasi. Nonce (state) memastikan token hanya diterima
/// dari halaman aktivasi yang memang dibuka aplikasi ini.
/// </summary>
public class KioskServiceTests
{
    private static int PortBebas()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    [Fact]
    public async Task Menerima_token_kiosk_dari_halaman_aktivasi()
    {
        var port = PortBebas();
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();

        var tunggu = KioskService.TungguCallbackAktivasiAsync(
            listener, "nonce-uji", TimeSpan.FromSeconds(10));

        using var http = new HttpClient();
        var resp = await http.GetAsync(
            $"http://localhost:{port}/callback?token=TOKEN-UJI&url=https%3A%2F%2Fcontoh.test%2Fabsensi%2Fkiosk&admin=Budi&exp=3600&state=nonce-uji");

        var hasil = await tunggu;

        Assert.True(resp.IsSuccessStatusCode);
        Assert.Equal("TOKEN-UJI", hasil.Token);
        Assert.Equal("https://contoh.test/absensi/kiosk", hasil.Url);
        Assert.Equal("Budi", hasil.Admin);
        Assert.Equal(3600, hasil.ExpiresInDetik);
    }

    [Fact]
    public async Task Menolak_token_bila_state_tidak_cocok()
    {
        var port = PortBebas();
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();

        var tunggu = KioskService.TungguCallbackAktivasiAsync(
            listener, "nonce-uji", TimeSpan.FromSeconds(10));

        using var http = new HttpClient();
        await http.GetAsync(
            $"http://localhost:{port}/callback?token=TOKEN-PALSU&url=https%3A%2F%2Fcontoh.test&state=nonce-lain");

        var galat = await Assert.ThrowsAsync<InvalidOperationException>(() => tunggu);
        Assert.Contains("ditolak", galat.Message);
    }

    [Fact]
    public async Task Waktu_habis_bila_browser_tidak_menyelesaikan_aktivasi()
    {
        var port = PortBebas();
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();

        var galat = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            KioskService.TungguCallbackAktivasiAsync(listener, "nonce-uji", TimeSpan.FromMilliseconds(300)));

        Assert.Contains("waktu habis", galat.Message);
    }
}
