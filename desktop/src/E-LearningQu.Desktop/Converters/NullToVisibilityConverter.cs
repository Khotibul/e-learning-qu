using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace E_LearningQu.Desktop.Converters;

/// <summary>null / string kosong → Collapsed, selainnya Visible.</summary>
public sealed class NullToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var invert = string.Equals(parameter as string, "invert", StringComparison.OrdinalIgnoreCase);
        var isNullOrEmpty = value is null || (value is string s && string.IsNullOrWhiteSpace(s));
        var visible = !isNullOrEmpty;
        if (invert) visible = !visible;
        return visible ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
