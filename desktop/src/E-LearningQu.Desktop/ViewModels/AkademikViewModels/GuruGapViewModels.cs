using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Teacher;

namespace E_LearningQu.Desktop.ViewModels;

// ─── ANTI-CHEAT ──────────────────────────────────────────────────────────────
public partial class GuruAntiCheatViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<AntiCheatSessionDto> Items { get; } = new();
    public ObservableCollection<AntiCheatSessionDto> Flagged { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruAntiCheatViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetAntiCheatAsync(ct);
            Items.Clear(); Flagged.Clear();
            foreach (var s in list)
            {
                Items.Add(s);
                if (s.IsFlagged) Flagged.Add(s);
            }
            StatusMessage = $"{Items.Count} sesi · {Flagged.Count} ditandai";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── INTERVENSI ──────────────────────────────────────────────────────────────
public partial class GuruIntervensiViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<IntervensiDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruIntervensiViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetIntervensiAsync(ct);
            Items.Clear();
            foreach (var i in list) Items.Add(i);
            StatusMessage = $"{Items.Count} intervensi";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── PELANGGARAN ─────────────────────────────────────────────────────────────
public partial class GuruPelanggaranViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<PelanggaranDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private int totalPoin;

    public GuruPelanggaranViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetPelanggaranAsync(ct);
            Items.Clear();
            var poin = 0;
            foreach (var p in list) { Items.Add(p); poin += p.Poin ?? 0; }
            TotalPoin = poin;
            StatusMessage = $"{Items.Count} pelanggaran · {poin} poin";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── WALI KELAS ──────────────────────────────────────────────────────────────
public partial class GuruWaliKelasViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<WaliKelasDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private WaliKelasDto? selectedKelas;

    public ObservableCollection<WaliKelasSiswaDto> Siswa { get; } = new();

    public GuruWaliKelasViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetWaliKelasAsync(ct);
            Items.Clear();
            foreach (var k in list) Items.Add(k);
            StatusMessage = $"{Items.Count} kelas binaan";
            SelectKelas(Items.FirstOrDefault());
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private void SelectKelas(WaliKelasDto? kelas)
    {
        SelectedKelas = kelas;
        Siswa.Clear();
        if (kelas is null) return;
        foreach (var s in kelas.Siswas) Siswa.Add(s);
        StatusMessage = $"{kelas.Nama} · {Siswa.Count} siswa";
    }
}

// ─── AI KNOWLEDGE BASE ───────────────────────────────────────────────────────
public partial class GuruAiKnowledgeViewModel : ObservableObject
{
    private readonly IGuruService _guru;

    public ObservableCollection<AiMateriDto> Items { get; } = new();

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private int totalChunks;
    [ObservableProperty] private bool geminiEnabled;

    public GuruAiKnowledgeViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var resp = await _guru.GetAiKnowledgeAsync(ct);
            Items.Clear();
            foreach (var m in resp.Materis) Items.Add(m);
            TotalChunks = resp.TotalChunks;
            GeminiEnabled = resp.GeminiEnabled;
            StatusMessage = $"{Items.Count} materi · {resp.TotalChunks} chunk" +
                            (resp.GeminiEnabled ? " · Gemini aktif" : " · Gemini nonaktif");
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
