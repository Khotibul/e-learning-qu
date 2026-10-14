using System.Windows.Controls;
using E_LearningQu.Desktop.ViewModels;

namespace E_LearningQu.Desktop.Views;

public partial class GuruWaliKelasView : UserControl
{
    public GuruWaliKelasView() => InitializeComponent();

    private void OnKelasSelected(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is GuruWaliKelasViewModel vm && sender is ListBox lb && lb.SelectedItem is not null)
            vm.SelectKelasCommand.Execute(lb.SelectedItem);
    }
}