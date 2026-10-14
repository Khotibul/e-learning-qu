using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Siswa;

namespace E_LearningQu.Desktop.ViewModels;

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
