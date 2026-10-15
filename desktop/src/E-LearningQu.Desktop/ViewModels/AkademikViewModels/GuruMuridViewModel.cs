using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Teacher;

namespace E_LearningQu.Desktop.ViewModels;

public partial class GuruMuridViewModel : ObservableObject
{
    private readonly IGuruService _guru;
    private CancellationTokenSource? _searchCts;

    public ObservableCollection<GuruMuridDto> Items { get; } = new();

    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruMuridViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetMuridAsync(null, ct);
            Items.Clear();
            foreach (var m in list) Items.Add(m);
            StatusMessage = $"{Items.Count} murid";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    partial void OnSearchTextChanged(string value)
    {
        _searchCts?.Cancel();
        _searchCts = new CancellationTokenSource();
        var ct = _searchCts.Token;
        _ = Task.Run(async () =>
        {
            await Task.Delay(300, ct);
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() => SearchAsync(value, ct));
        }, ct);
    }

    [RelayCommand]
    private async Task SearchAsync(string q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q)) { await LoadAsync(ct); return; }
        try
        {
            var list = await _guru.GetMuridAsync(q, ct);
            Items.Clear();
            foreach (var m in list) Items.Add(m);
            StatusMessage = $"{Items.Count} hasil";
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

public partial class GuruSoalViewModel : ObservableObject
{
    private readonly IGuruService _guru;
    private CancellationTokenSource? _searchCts;

    public ObservableCollection<GuruSoalDto> Items { get; } = new();

    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";

    public GuruSoalViewModel(IGuruService guru) => _guru = guru;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            var list = await _guru.GetSoalAsync(null, ct);
            Items.Clear();
            foreach (var s in list) Items.Add(s);
            StatusMessage = $"{Items.Count} soal";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }

    [RelayCommand]
    private async Task DeleteAsync(GuruSoalDto soal, CancellationToken ct)
    {
        try
        {
            if (await _guru.DeleteSoalAsync(soal.Id, ct))
            {
                Items.Remove(soal);
                StatusMessage = "Soal dihapus";
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    partial void OnSearchTextChanged(string value)
    {
        _searchCts?.Cancel();
        _searchCts = new CancellationTokenSource();
        var ct = _searchCts.Token;
        _ = Task.Run(async () =>
        {
            await Task.Delay(300, ct);
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() => SearchAsync(value, ct));
        }, ct);
    }

    [RelayCommand]
    private async Task SearchAsync(string q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q)) { await LoadAsync(ct); return; }
        try
        {
            var list = await _guru.GetSoalAsync(q, ct);
            Items.Clear();
            foreach (var s in list) Items.Add(s);
            StatusMessage = $"{Items.Count} hasil";
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}