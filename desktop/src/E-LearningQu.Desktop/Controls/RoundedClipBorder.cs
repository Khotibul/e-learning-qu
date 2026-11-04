using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace E_LearningQu.Desktop.Controls;

/// <summary>
/// Border dengan sudut membulat yang ikut meng-clip isi di dalamnya.
/// Dibutuhkan agar baris tabel (yang warnanya kotak) tidak "meluber" ke luar
/// sudut membulat kartu tabel — <see cref="Border"/> biasa tidak memotong anaknya.
/// </summary>
public sealed class RoundedClipBorder : Border
{
    public RoundedClipBorder()
    {
        SizeChanged += (_, _) => UpdateClip();
    }

    protected override void OnPropertyChanged(DependencyPropertyChangedEventArgs e)
    {
        base.OnPropertyChanged(e);
        if (e.Property == CornerRadiusProperty ||
            e.Property == WidthProperty ||
            e.Property == HeightProperty ||
            e.Property == ActualWidthProperty ||
            e.Property == ActualHeightProperty ||
            e.Property == VisibilityProperty ||
            e.Property == BorderThicknessProperty)
        {
            UpdateClip();
        }
    }

    private void UpdateClip()
    {
        var w = ActualWidth;
        var h = ActualHeight;
        if (w <= 0 || h <= 0)
        {
            Clip = null;
            return;
        }

        var r = CornerRadius.TopLeft;
        Clip = r > 0
            ? new RectangleGeometry(new Rect(0, 0, w, h), r, r)
            : null;
    }
}
