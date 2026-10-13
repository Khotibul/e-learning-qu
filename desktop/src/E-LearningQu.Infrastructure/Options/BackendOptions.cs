namespace E_LearningQu.Infrastructure.Options;

public sealed class BackendOptions
{
    public const string SectionName = "Backend";

    public string BaseUrl { get; set; } = "https://e-learning-qu.vercel.app";
    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>Client ID Google OAuth untuk URL authorize (desktop PKCE). Bukan secret — aman di client.</summary>
    public string GoogleClientId { get; set; } = "";
}
