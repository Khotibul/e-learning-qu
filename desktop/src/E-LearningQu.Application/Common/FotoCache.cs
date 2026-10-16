using System.Collections.Concurrent;

namespace E_LearningQu.Application.Common;

/// <summary>
/// Cache biner foto profil/thumbnail per-URL (byte[] hasil GET /api/upload/*).
/// Diisi oleh AdminService.PreloadFotoAsync SEBELUM baris ditambahkan ke tabel,
/// dibaca sinkron oleh converter XAML desktop. Bersihkan saat logout
/// (FotoCache.Clear) agar foto akun sebelumnya tidak bocor ke akun berikutnya.
/// </summary>
public static class FotoCache
{
    private static readonly ConcurrentDictionary<string, byte[]> Items = new();

    public static void Put(string url, byte[] bytes) => Items[url] = bytes;

    public static bool TryGet(string url, out byte[] bytes) => Items.TryGetValue(url, out bytes!);

    public static bool Contains(string url) => Items.ContainsKey(url);

    public static void Clear() => Items.Clear();
}
