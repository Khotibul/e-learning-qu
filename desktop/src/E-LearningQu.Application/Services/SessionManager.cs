using E_LearningQu.Application.Abstractions;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>Sesi aktif in-memory + persist/restore ke IAuthTokenStore.</summary>
public sealed class SessionManager : ISessionManager
{
    private readonly IAuthTokenStore _store;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public SessionManager(IAuthTokenStore store) => _store = store;

    public UserSession? Current { get; private set; }
    public event EventHandler<UserSession?>? SessionChanged;

    public void SetSession(UserSession session)
    {
        Current = session;
        SessionChanged?.Invoke(this, session);
        // Persist tidak di-await agar UI tidak nunggu disk; ditangani PersistSafeAsync (tidak melempar).
        _ = PersistSafeAsync(session).ConfigureAwait(false); // fire-and-forget disengaja (tidak blocking UI)
    }

    public async Task<UserSession?> RestoreAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var loaded = await _store.LoadAsync(ct);
            if (loaded is not null && !ReferenceEquals(Current, loaded))
            {
                Current = loaded;
                SessionChanged?.Invoke(this, loaded);
            }
            return loaded;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SignOutAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await _store.ClearAsync(ct);
            Current = null;
            SessionChanged?.Invoke(this, null);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task PersistSafeAsync(UserSession session)
    {
        try
        {
            await _gate.WaitAsync();
            try
            {
                await _store.SaveAsync(session);
            }
            finally
            {
                _gate.Release();
            }
        }
        catch
        {
            // Persist gagal tidak membatalkan login (mis. profil DPAPI rusak) — sesi tetap hidup di memori.
        }
    }
}
