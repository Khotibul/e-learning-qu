using System.Security.Cryptography;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Infrastructure.Storage;

/// <summary>
/// Token kiosk absensi desktop disimpan terenkripsi DPAPI (CurrentUser) — tidak
/// pernah plaintext di disk. File: %APPDATA%\E-LearningQu\kiosk.bin.
/// </summary>
public sealed class DpapiKioskTokenStore : IKioskTokenStore
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly string _filePath;

    public DpapiKioskTokenStore(string? filePath = null)
    {
        _filePath = filePath ?? DefaultPath();
    }

    public async Task<KioskCredential?> LoadAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_filePath)) return null;
        try
        {
            var protectedBytes = await File.ReadAllBytesAsync(_filePath, ct);
            var json = ProtectedData.Unprotect(protectedBytes, optionalEntropy: null, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<KioskCredential>(json, JsonOpts);
        }
        catch (CryptographicException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    public async Task SaveAsync(KioskCredential credential, CancellationToken ct = default)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(credential, JsonOpts);
        var protectedBytes = ProtectedData.Protect(json, optionalEntropy: null, DataProtectionScope.CurrentUser);
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        await File.WriteAllBytesAsync(_filePath, protectedBytes, ct);
    }

    public Task ClearAsync(CancellationToken ct = default)
    {
        if (File.Exists(_filePath)) File.Delete(_filePath);
        return Task.CompletedTask;
    }

    private static string DefaultPath()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(root, "E-LearningQu", "kiosk.bin");
    }
}
