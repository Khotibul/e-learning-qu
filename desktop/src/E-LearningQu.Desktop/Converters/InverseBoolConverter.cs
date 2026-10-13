using System.Globalization;
using System.Windows.Data;

namespace E_LearningQu.Desktop.Converters;

/// <summary>true → !IsEnabled (untuk disable control saat busy).</summary>
public sealed class InverseBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is not true;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is not true;
}
