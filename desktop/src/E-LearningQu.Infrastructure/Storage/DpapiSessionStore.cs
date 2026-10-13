using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Infrastructure.Storage;

/// <summary>
/// Persistensi sesi user dengan DPAPI (CurrentUser) — token TIDAK PERNAH plaintext di disk.
/// File: %APPDATA%\E-LearningQu\session.bin (bisa di-override path untuk test).
/// </summary>
public sealed class DpapiSessionStore : IAuthTokenStore
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly string _filePath;

    public DpapiSessionStore(string? filePath = null)
    {
        _filePath = filePath ?? DefaultPath();
    }

    public async Task SaveAsync(UserSession session, CancellationToken ct = default)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(session, JsonOpts);
        var protectedBytes = ProtectedData.Protect(json, optionalEntropy: null, DataProtectionScope.CurrentUser);
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        await File.WriteAllBytesAsync(_filePath, protectedBytes, ct);
    }

    public async Task<UserSession?> LoadAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_filePath)) return null;
        try
        {
            var protectedBytes = await File.ReadAllBytesAsync(_filePath, ct);
            var json = ProtectedData.Unprotect(protectedBytes, optionalEntropy: null, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<UserSession>(json, JsonOpts);
        }
        catch (CryptographicException)
        {
            // File korup / di-encrypt user lain — anggap tidak ada sesi.
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public Task ClearAsync(CancellationToken ct = default)
    {
        if (File.Exists(_filePath))
            File.Delete(_filePath);
        return Task.CompletedTask;
    }

    private static string DefaultPath()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(root, "E-LearningQu", "session.bin");
    }
}
