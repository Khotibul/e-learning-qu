using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Dashboard;

namespace E_LearningQu.Application.Abstractions;

public interface IDashboardService
{
    Task<SiswaDashboardDto> GetSiswaDashboardAsync(CancellationToken ct = default);
    Task<GuruDashboardDto> GetGuruDashboardAsync(CancellationToken ct = default);
}
