using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace E_LearningQu.Desktop.Converters;

/// <summary>int/Collection.Count → Visible bila &gt; 0, Collapsed bila 0/null.</summary>
public sealed class CountToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        int count = value switch
        {
            int i => i,
            System.Collections.ICollection c => c.Count,
            System.Collections.IEnumerable e => System.Linq.Enumerable.Count(e.Cast<object>()),
            _ => 0
        };
        var visible = count > 0;
        if (string.Equals(parameter as string, "invert", StringComparison.OrdinalIgnoreCase))
            visible = !visible;
        return visible ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
