using System.Globalization;
using System.IO;
using System.Windows.Data;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using E_LearningQu.Application.Common;

namespace E_LearningQu.Desktop.Converters;

/// <summary>URL foto (/api/upload/*) → ImageSource dari FotoCache (biner sudah
/// di-preload AdminService.PreloadFotoAsync SEBELUM baris tabel diisi).
/// Miss/kegagalan decode = null (kolom foto kosong) — tak pernah melempar.</summary>
public sealed class ThumbUrlToImageConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not string url || string.IsNullOrWhiteSpace(url)) return null;
        if (!FotoCache.TryGet(url, out var bytes) || bytes.Length == 0) return null;
        try
        {
            using var ms = new MemoryStream(bytes);
            var img = new BitmapImage();
            img.BeginInit();
            img.CacheOption = BitmapCacheOption.OnLoad;
            img.StreamSource = ms;
            img.EndInit();
            img.Freeze(); // aman dipanggil dari thread mana pun
            return img;
        }
        catch
        {
            return null;
        }
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
