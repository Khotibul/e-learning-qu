using E_LearningQu.Application.Abstractions;
using E_LearningQu.Infrastructure.Http;
using E_LearningQu.Infrastructure.OAuth;
using E_LearningQu.Infrastructure.Options;
using E_LearningQu.Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace E_LearningQu.Infrastructure;

public static class DependencyInjection
{
    public const string PlainClientName = "backend-plain";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, Action<BackendOptions>? configure = null)
    {
        services.AddOptions<BackendOptions>()
            .BindConfiguration(BackendOptions.SectionName)
            .PostConfigure(o =>
            {
                if (string.IsNullOrWhiteSpace(o.BaseUrl))
                    o.BaseUrl = "https://e-learning-qu.vercel.app";
                if (o.TimeoutSeconds <= 0)
                    o.TimeoutSeconds = 15;
            });

        if (configure is not null)
            services.Configure(configure);

        services.AddSingleton<IAuthTokenStore>(_ => new DpapiSessionStore());

        // HttpClient polos (tanpa auto-refresh) — dipakai AuthAutoRefreshHandler untuk memanggil endpoint refresh.
        services.AddHttpClient(PlainClientName, (sp, client) =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<BackendOptions>>().Value;
            client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        });

        // Handler singleton (dependensi singleton) → dipasang manual ke typed client.
        services.AddSingleton<AuthAutoRefreshHandler>(sp =>
        {
            var plain = sp.GetRequiredService<IHttpClientFactory>().CreateClient(PlainClientName);
            return new AuthAutoRefreshHandler(plain, sp.GetRequiredService<ISessionManager>(),
                sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<AuthAutoRefreshHandler>>());
        });

        services.AddHttpClient<IBackendApiClient, BackendApiClient>()
            .ConfigureHttpClient((sp, client) => { /* BaseAddress/timeout di ctor dari BackendOptions */ })
            .AddHttpMessageHandler<AuthAutoRefreshHandler>();

        // Google Login desktop (OAuth 2.0 Authorization Code + PKCE) — loopback + browser sistem.
        services.AddSingleton<IOAuthService, GooglePkceOAuthService>();

        return services;
    }
}
