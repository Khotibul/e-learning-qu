using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace E_LearningQu.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<ISessionManager, SessionManager>();
        services.AddSingleton<IAuthService, AuthService>();
        services.AddSingleton<IDashboardService, DashboardService>();
        services.AddSingleton<IAkademikService, AkademikService>();
        services.AddSingleton<IGuruService, GuruService>();
        services.AddSingleton<ISiswaService, SiswaService>();
        services.AddSingleton<IAdminService, AdminService>();
        services.AddSingleton<INavigationService, NavigationService>();
        return services;
    }
}
