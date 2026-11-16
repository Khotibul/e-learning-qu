using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// Aktivasi kiosk absensi (wajah &amp; sidik jari) di komputer desktop.
/// Memakai sesi Admin yang sedang login untuk menukar access token menjadi
/// token kiosk berumur panjang.
/// </summary>
public interface IKioskService
{
    Task<KioskActivationResponse> AktifkanAsync(CancellationToken ct = default);

    /// <summary>
    /// Aktivasi untuk Admin yang masuk lewat Google (tanpa kata sandi): browser sistem
    /// dibuka ke halaman aktivasi web, lalu token kiosk dikirim balik ke listener
    /// loopback aplikasi ini.
    /// </summary>
    Task<KioskActivationResponse> AktifkanLewatBrowserAsync(CancellationToken ct = default);
}
