using System.Windows;
using System.Windows.Controls;
using E_LearningQu.Desktop.ViewModels;

namespace E_LearningQu.Desktop.Views;

public partial class LoginView : UserControl
{
    public LoginView()
    {
        InitializeComponent();
        BrandService.Changed += OnBrandChanged;
        Unloaded += (_, _) => BrandService.Changed -= OnBrandChanged;
        ApplyBrand();
    }

    private void OnBrandChanged() => Dispatcher.Invoke(ApplyBrand);

    private void ApplyBrand()
    {
        try
        {
            if (BrandService.Logo is not null) BrandLogo.Source = BrandService.Logo;
            BrandName.Text = BrandService.SiteName;
            BrandTagline.Text = BrandService.Tagline;
        }
        catch { /* kosmetik */ }
    }

    /// <summary>PasswordBox tidak bindable di WPF — sinkronkan manual ke VM.</summary>
    private void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm && sender is PasswordBox pb)
            vm.Password = pb.Password;
    }
}
