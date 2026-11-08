using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// Penyimpanan token kiosk per perangkat (terenkripsi DPAPI) supaya absensi
/// berikutnya tidak perlu login lagi.
/// </summary>
public interface IKioskTokenStore
{
    Task<KioskCredential?> LoadAsync(CancellationToken ct = default);
    Task SaveAsync(KioskCredential credential, CancellationToken ct = default);
    Task ClearAsync(CancellationToken ct = default);
}
