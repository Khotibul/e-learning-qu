using System.Windows;

namespace E_LearningQu.Desktop.Views;

public partial class ConfirmWindow : Window
{
    public string DialogTitle { get; }
    public string Message { get; }
    public string ConfirmText { get; }
    public bool Result { get; private set; }

    public ConfirmWindow(string title, string message, string confirmText = "Ya, Lanjutkan")
    {
        InitializeComponent();
        DialogTitle = title;
        Message = message;
        ConfirmText = confirmText;
        DataContext = this;
    }

    private void OnConfirm(object sender, RoutedEventArgs e)
    {
        Result = true;
        DialogResult = true;
    }

    private void OnCancel(object sender, RoutedEventArgs e)
    {
        Result = false;
        DialogResult = false;
    }
}
