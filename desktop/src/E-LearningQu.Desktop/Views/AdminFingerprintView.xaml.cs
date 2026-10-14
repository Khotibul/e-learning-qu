using System.Windows.Controls;
using System.Windows.Input;
using E_LearningQu.Contracts.Admin;
using E_LearningQu.Desktop.ViewModels;

namespace E_LearningQu.Desktop.Views;

public partial class AdminFingerprintView : UserControl
{
    public AdminFingerprintView() => InitializeComponent();

    private void OnPerangkatDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (sender is DataGrid grid && grid.SelectedItem is PerangkatFpDto item && DataContext is AdminFingerprintViewModel vm)
            _ = vm.PilihPerangkatCommand.ExecuteAsync(item);
    }
}
