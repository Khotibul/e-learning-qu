using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Media;

namespace E_LearningQu.Desktop;

public sealed class ToastItem
{
    public string Message { get; init; } = "";
    public ToastKind Kind { get; init; } = ToastKind.Info;
    public Brush AccentBrush => Kind switch
    {
        ToastKind.Success => new SolidColorBrush(Color.FromRgb(0x1E, 0x7A, 0x50)),
        ToastKind.Error => new SolidColorBrush(Color.FromRgb(0xB3, 0x26, 0x1E)),
        ToastKind.Warning => new SolidColorBrush(Color.FromRgb(0xB7, 0x79, 0x1F)),
        _ => new SolidColorBrush(Color.FromRgb(0x2C, 0x6E, 0x63)),
    };
    public string Glyph => Kind switch
    {
        ToastKind.Success => "✓",
        ToastKind.Error => "✕",
        ToastKind.Warning => "!",
        _ => "i",
    };
}

public static class ToastService
{
    public static ObservableCollection<ToastItem> Items { get; } = new();

    public static void Show(string message, ToastKind kind = ToastKind.Info)
    {
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            var item = new ToastItem { Message = message, Kind = kind };
            Items.Insert(0, item);
            while (Items.Count > 4) Items.RemoveAt(Items.Count - 1);
            _ = RemoveAfterDelayAsync(item);
        });
    }

    private static async Task RemoveAfterDelayAsync(ToastItem item)
    {
        await Task.Delay(TimeSpan.FromSeconds(4));
        System.Windows.Application.Current.Dispatcher.Invoke(() => Items.Remove(item));
    }
}
