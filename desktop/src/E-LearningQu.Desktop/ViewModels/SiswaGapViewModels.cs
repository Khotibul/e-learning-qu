using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Siswa;

namespace E_LearningQu.Desktop.ViewModels;

// ─── AI TUTOR ────────────────────────────────────────────────────────────────
public partial class SiswaAiTutorViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<TutorSessionDto> Sessions { get; } = new();
    public ObservableCollection<TutorMessageDto> Messages { get; } = new();
    public ObservableCollection<TutorMapelDto> Mapels { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private bool isSending;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string draft = "";
    [ObservableProperty] private string? currentSessionId;
    [ObservableProperty] private TutorMapelDto? selectedMapel;
    [ObservableProperty] private bool hasMessages;

    public SiswaAiTutorViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var sessions = await _siswa.GetTutorSessionsAsync(ct);
            Sessions.Clear();
            foreach (var s in sessions) Sessions.Add(s);

            var mapels = await _siswa.GetTutorMapelAsync(ct);
            Mapels.Clear();
            foreach (var m in mapels) Mapels.Add(m);

            StatusMessage = $"{Sessions.Count} sesi · {Mapels.Count} mata pelajaran";
            if (CurrentSessionId is null && Sessions.Count > 0)
                await OpenSessionAsync(Sessions[0], ct);
            else
                UpdateHasMessages();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    public async Task OpenSessionAsync(TutorSessionDto session, CancellationToken ct = default)
    {
        try
        {
            CurrentSessionId = session.Id;
            var msgs = await _siswa.GetTutorMessagesAsync(session.Id, ct);
            Messages.Clear();
            foreach (var m in msgs) Messages.Add(m);
            StatusMessage = session.Judul;
            UpdateHasMessages();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task NewSessionAsync(CancellationToken ct = default)
    {
        CurrentSessionId = null;
        Messages.Clear();
        StatusMessage = "Sesi baru";
        UpdateHasMessages();
        await Task.CompletedTask;
    }

    [RelayCommand]
    private async Task SendAsync(CancellationToken ct)
    {
        var text = Draft.Trim();
        if (string.IsNullOrEmpty(text) || IsSending) return;

        IsSending = true; ErrorMessage = null;
        try
        {
            Messages.Add(new TutorMessageDto { Id = $"tmp-{Guid.NewGuid()}", Role = "siswa", Konten = text, CreatedAt = DateTimeOffset.Now });

            var resp = await _siswa.SendTutorMessageAsync(new TutorChatRequest
            {
                Message = text,
                SessionId = CurrentSessionId,
                MapelId = SelectedMapel?.Id,
            }, ct);

            if (resp is null)
            {
                ErrorMessage = "Tutor AI tidak menjawab. Coba lagi.";
            }
            else
            {
                CurrentSessionId = resp.SessionId;
                Messages.Add(new TutorMessageDto
                {
                    Id = $"tmp-{Guid.NewGuid()}",
                    Role = "assistant",
                    Agent = "tutor",
                    Konten = resp.Jawaban,
                    CreatedAt = DateTimeOffset.Now,
                });

                if (resp.Sumber.Count > 0)
                {
                    var src = string.Join(", ", resp.Sumber.Select(s => s.Judul).Distinct().Take(4));
                    StatusMessage = $"Sumber: {src}";
                }
            }

            Draft = "";
            await RefreshSessionsAsync(ct);
            UpdateHasMessages();
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsSending = false; }
    }

    private async Task RefreshSessionsAsync(CancellationToken ct)
    {
        try
        {
            var sessions = await _siswa.GetTutorSessionsAsync(ct);
            Sessions.Clear();
            foreach (var s in sessions) Sessions.Add(s);
        }
        catch { /* refresh sesi bersifat opsional */ }
    }

    private void UpdateHasMessages() => HasMessages = Messages.Count > 0;
}

// ─── BENDAHARA (kas kelas) ───────────────────────────────────────────────────
public partial class SiswaBendaharaViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private BendaharaSummaryDto summary = new();

    public SiswaBendaharaViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var data = await _siswa.GetBendaharaSummaryAsync(ct);
            if (data is null)
            {
                ErrorMessage = "Anda bukan bendahara kelas atau data belum tersedia.";
                StatusMessage = "";
            }
            else
            {
                Summary = data;
                StatusMessage = $"Kas kelas · sisa {data.SisaKas:N0}";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── SEKRETARIS (jadwal piket) ───────────────────────────────────────────────
public partial class SiswaSekretarisViewModel : ObservableObject
{
    private readonly ISiswaService _siswa;

    public ObservableCollection<SekretarisPiketDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public SiswaSekretarisViewModel(ISiswaService siswa) => _siswa = siswa;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _siswa.GetSekretarisPiketAsync(ct);
            Items.Clear();
            foreach (var p in list) Items.Add(p);
            StatusMessage = $"{Items.Count} jadwal piket sekretaris";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
