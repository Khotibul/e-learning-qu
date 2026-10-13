using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace E_LearningQu.Infrastructure.OAuth;

/// <summary>
/// OAuth 2.0 Authorization Code + PKCE untuk Google Login desktop.
/// 1) Generate code_verifier + code_challenge (S256) + state.
/// 2) Buka browser sistem ke URL authorize Google (loopback redirect).
/// 3) HttpListener loopback menunggu code + validasi state.
/// 4) Tukar code+verifier ke backend desktop (exchange) → JWT → IAuthService.ApplyGoogleExchange.
/// Tidak menyimpan client secret di aplikasi desktop.
/// </summary>
public sealed class GooglePkceOAuthService : IOAuthService
{
    private static readonly TimeSpan BrowserTimeout = TimeSpan.FromMinutes(3);

    private readonly IBackendApiClient _api;
    private readonly IAuthService _auth;
    private readonly ILogger<GooglePkceOAuthService> _logger;
    private readonly string _clientId;

    public GooglePkceOAuthService(
        IBackendApiClient api,
        IAuthService auth,
        ILogger<GooglePkceOAuthService> logger,
        Microsoft.Extensions.Options.IOptions<Infrastructure.Options.BackendOptions> options)
    {
        _api = api;
        _auth = auth;
        _logger = logger;
        // Client ID Google dipakai untuk URL authorize; tidak ada secret di desktop.
        _clientId = options.Value.GoogleClientId;
    }

    public async Task<AuthResult> LoginWithGoogleAsync(string role, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_clientId))
            return AuthResult.Failure("Google Client ID belum dikonfigurasi.");

        var requestedRole = ParseRole(role);
        var port = GetFreeLoopbackPort();
        var redirectUri = $"http://127.0.0.1:{port}/callback";

        // PKCE
        var codeVerifier = GenerateCodeVerifier();
        var codeChallenge = GenerateCodeChallengeS256(codeVerifier);
        var state = GenerateRandomUrlSafe(32);

        var authorizeUrl =
            "https://accounts.google.com/o/oauth2/v2/auth?" +
            $"client_id={Uri.EscapeDataString(_clientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
            "&response_type=code" +
            "&scope=openid%20email%20profile" +
            $"&state={Uri.EscapeDataString(state)}" +
            $"&code_challenge={Uri.EscapeDataString(codeChallenge)}" +
            "&code_challenge_method=S256";

        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        try
        {
            listener.Start();
        }
        catch (HttpListenerException ex)
        {
            _logger.LogError(ex, "HttpListener gagal start di port {Port}", port);
            return AuthResult.Failure("Gagal memulai listener lokal untuk OAuth. Coba lagi.");
        }

        // Buka browser sistem
        try
        {
            Process.Start(new ProcessStartInfo(authorizeUrl) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal membuka browser");
            return AuthResult.Failure("Tidak dapat membuka browser. Pastikan browser default tersedia.");
        }

        // Tunggu callback dari Google (code atau error)
        string? code;
        using (var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct))
        {
            timeoutCts.CancelAfter(BrowserTimeout);
            try
            {
                var contextTask = listener.GetContextAsync();
                var completed = await Task.WhenAny(contextTask, Task.Delay(Timeout.Infinite, timeoutCts.Token));
                if (completed != contextTask)
                {
                    return AuthResult.Failure("Login Google dibatalkan (timeout).");
                }
                var context = await contextTask;
                code = await HandleCallbackAsync(context, state, redirectUri);
            }
            catch (OperationCanceledException)
            {
                return AuthResult.Failure("Login Google dibatalkan.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error menerima callback OAuth");
                return AuthResult.Failure("Gagal menerima respon dari Google.");
            }
        }

        if (string.IsNullOrEmpty(code))
            return AuthResult.Failure("Login Google gagal (code tidak diterima).");

        // Tukar code + PKCE ke backend desktop
        var exchangeRequest = new DesktopGoogleExchangeRequest(code, codeVerifier, redirectUri, requestedRole.ToString());
        DesktopGoogleExchangeResponse exchangeResponse;
        try
        {
            exchangeResponse = await _api.PostAsync<DesktopGoogleExchangeRequest, DesktopGoogleExchangeResponse>(
                "/api/mobile/auth/desktop/google/exchange", exchangeRequest, token: null, ct);
        }
        catch (ApiException ex)
        {
            _logger.LogWarning(ex, "Exchange Google ditolak: {Status}", (int)ex.StatusCode);
            return AuthResult.Failure(ex.ServerMessage ?? ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Exchange Google gagal jaringan");
            return AuthResult.Failure("Tidak dapat terhubung ke server. Periksa koneksi internet.");
        }

        // Apply session (sama dengan login password)
        return _auth.ApplyGoogleExchange(exchangeResponse, requestedRole);
    }

    private static async Task<string?> HandleCallbackAsync(HttpListenerContext context, string expectedState, string redirectUri)
    {
        var query = context.Request.QueryString;
        var state = query["state"];
        var error = query["error"];
        var code = query["code"];

        string html;
        if (!string.Equals(state, expectedState, StringComparison.Ordinal))
        {
            html = CloseHtml("Login gagal: state tidak valid.");
        }
        else if (!string.IsNullOrEmpty(error))
        {
            html = CloseHtml($"Login dibatalkan: {error}");
        }
        else if (string.IsNullOrEmpty(code))
        {
            html = CloseHtml("Login gagal: code tidak ditemukan.");
        }
        else
        {
            html = CloseHtml("Login berhasil! Anda dapat menutup jendela ini dan kembali ke aplikasi.");
        }

        var buffer = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength64 = buffer.Length;
        await context.Response.OutputStream.WriteAsync(buffer);
        context.Response.OutputStream.Close();

        return string.IsNullOrEmpty(error) && !string.IsNullOrEmpty(state) && string.Equals(state, expectedState, StringComparison.Ordinal) ? code : null;
    }

    private static string CloseHtml(string message) =>
        $"<html><body style=\"font-family:sans-serif;text-align:center;padding-top:80px\">" +
        $"<h2>E-Learning-Qu Desktop</h2><p>{message}</p></body></html>";

    private static Role ParseRole(string role) =>
        RoleParser.TryParse(role, out var r) ? r : Role.SISWA;

    private static int GetFreeLoopbackPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static string GenerateCodeVerifier()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Base64UrlEncode(bytes);
    }

    private static string GenerateCodeChallengeS256(string verifier)
    {
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
        return Base64UrlEncode(hash);
    }

    private static string GenerateRandomUrlSafe(int byteCount)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteCount);
        return Base64UrlEncode(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
