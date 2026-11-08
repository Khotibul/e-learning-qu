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
}
