using System.Globalization;
using System.Windows.Data;

namespace E_LearningQu.Desktop.Converters;

/// <summary>bool → kebalikannya (untuk IsEnabled saat busy). dipakai di LoginView.</summary>
public sealed class NotBoolToBoolConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : true;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : false;
}