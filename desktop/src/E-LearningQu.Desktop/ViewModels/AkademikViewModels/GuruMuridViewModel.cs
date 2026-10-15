using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Teacher;
using E_LearningQu.Desktop;

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
    public async Task TambahAsync(CancellationToken ct = default)
    {
        if (IsLoading) return;
        try
        {
            var mapels = await _guru.GetMapelAsync(ct);
            var fields = new[]
            {
                new FormFieldDef { Key = "pertanyaan", Label = "Pertanyaan", Kind = FormFieldKind.Memo, Required = true },
                new FormFieldDef { Key = "jenisSoal", Label = "Jenis Soal", Kind = FormFieldKind.Combo, Required = true,
                    Options = new[] { new ComboOption("PILIHAN_GANDA","Pilihan Ganda"), new ComboOption("ESSAY","Essay"), new ComboOption("TRUE_FALSE","Benar/Salah") } },
                new FormFieldDef { Key = "tingkatKesulitan", Label = "Tingkat Kesulitan", Kind = FormFieldKind.Combo,
                    Options = new[] { new ComboOption("MUDAH","Mudah"), new ComboOption("SEDANG","Sedang"), new ComboOption("SULIT","Sulit") } },
                new FormFieldDef { Key = "mataPelajaranId", Label = "Mata Pelajaran", Kind = FormFieldKind.Combo, Required = true,
                    Options = mapels.Select(m => new ComboOption(m.Id, m.Nama)).ToList() },
                new FormFieldDef { Key = "pilihanGanda", Label = "Pilihan Ganda (satu per baris)", Kind = FormFieldKind.Memo },
                new FormFieldDef { Key = "jawaban", Label = "Kunci Jawaban", Kind = FormFieldKind.Text },
                new FormFieldDef { Key = "trueFalse", Label = "Benar (untuk Benar/Salah)", Kind = FormFieldKind.Bool },
                new FormFieldDef { Key = "poin", Label = "Poin", Kind = FormFieldKind.Int },
                new FormFieldDef { Key = "bab", Label = "BAB", Kind = FormFieldKind.Text },
            };
            var values = await DialogService.FormAsync("Tambah Soal", fields, subtitle: "Isi bank soal lalu simpan.", saveText: "Simpan");
            if (values is null) return;
            var payload = BuildSoalPayload(values);
            if (await _guru.CreateSoalAsync(payload, ct) is not null)
            {
                StatusMessage = "Soal ditambahkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task EditAsync(GuruSoalDto item, CancellationToken ct = default)
    {
        if (IsLoading || item is null) return;
        try
        {
            var mapels = await _guru.GetMapelAsync(ct);
            var fields = new[]
            {
                new FormFieldDef { Key = "pertanyaan", Label = "Pertanyaan", Kind = FormFieldKind.Memo, Required = true, Value = item.Pertanyaan },
                new FormFieldDef { Key = "jenisSoal", Label = "Jenis Soal", Kind = FormFieldKind.Combo, Required = true, Value = item.JenisSoal,
                    Options = new[] { new ComboOption("PILIHAN_GANDA","Pilihan Ganda"), new ComboOption("ESSAY","Essay"), new ComboOption("TRUE_FALSE","Benar/Salah") } },
                new FormFieldDef { Key = "tingkatKesulitan", Label = "Tingkat Kesulitan", Kind = FormFieldKind.Combo, Value = item.TingkatKesulitan,
                    Options = new[] { new ComboOption("MUDAH","Mudah"), new ComboOption("SEDANG","Sedang"), new ComboOption("SULIT","Sulit") } },
                new FormFieldDef { Key = "mataPelajaranId", Label = "Mata Pelajaran", Kind = FormFieldKind.Combo, Required = true, Value = item.MataPelajaranId,
                    Options = mapels.Select(m => new ComboOption(m.Id, m.Nama)).ToList() },
                new FormFieldDef { Key = "pilihanGanda", Label = "Pilihan Ganda (satu per baris)", Kind = FormFieldKind.Memo,
                    Value = item.PilihanGanda is { Count: > 0 } ? string.Join("\n", item.PilihanGanda) : "" },
                new FormFieldDef { Key = "jawaban", Label = "Kunci Jawaban", Kind = FormFieldKind.Text, Value = item.Jawaban },
                new FormFieldDef { Key = "trueFalse", Label = "Benar (untuk Benar/Salah)", Kind = FormFieldKind.Bool, Value = item.TrueFalse == true ? "true" : "false" },
                new FormFieldDef { Key = "poin", Label = "Poin", Kind = FormFieldKind.Int, Value = item.Poin.ToString() },
                new FormFieldDef { Key = "bab", Label = "BAB", Kind = FormFieldKind.Text, Value = item.Bab },
            };
            var values = await DialogService.FormAsync("Edit Soal", fields, subtitle: "Ubah bank soal lalu simpan.", saveText: "Simpan Perubahan");
            if (values is null) return;
            var payload = BuildSoalPayload(values);
            payload["id"] = item.Id;
            if (await _guru.UpdateSoalAsync(payload, ct))
            {
                StatusMessage = "Soal diperbarui";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    private static Dictionary<string, object?> BuildSoalPayload(IReadOnlyDictionary<string, string?> v)
    {
        var pilihan = (v.GetValueOrDefault("pilihanGanda") ?? "")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();
        return new Dictionary<string, object?>
        {
            ["pertanyaan"] = v.GetValueOrDefault("pertanyaan") ?? "",
            ["jenisSoal"] = v.GetValueOrDefault("jenisSoal") ?? "PILIHAN_GANDA",
            ["tingkatKesulitan"] = v.GetValueOrDefault("tingkatKesulitan") ?? "SEDANG",
            ["mataPelajaranId"] = v.GetValueOrDefault("mataPelajaranId") ?? "",
            ["pilihanGanda"] = pilihan.Length > 0 ? pilihan : null,
            ["jawaban"] = v.GetValueOrDefault("jawaban") ?? "",
            ["trueFalse"] = v.GetValueOrDefault("trueFalse") == "true" ? true : null,
            ["poin"] = int.TryParse(v.GetValueOrDefault("poin"), out var p) ? p : 1,
            ["bab"] = v.GetValueOrDefault("bab"),
            ["tags"] = null,
        };
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