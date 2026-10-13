using System.Windows;
using System.Windows.Controls;
using E_LearningQu.Desktop.ViewModels;

namespace E_LearningQu.Desktop.Views;

public partial class LoginView : UserControl
{
    public LoginView()
    {
        InitializeComponent();
    }

    /// <summary>PasswordBox tidak bindable di WPF — sinkronkan manual ke VM.</summary>
    private void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm && sender is PasswordBox pb)
            vm.Password = pb.Password;
    }
}
