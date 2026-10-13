using System.Windows.Controls;

namespace E_LearningQu.Desktop.Views;

public partial class PlaceholderView : UserControl
{
    public PlaceholderView(string title)
    {
        InitializeComponent();
        TitleText.Text = title;
    }
}
