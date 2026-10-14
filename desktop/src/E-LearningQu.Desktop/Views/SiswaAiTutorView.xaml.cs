using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using E_LearningQu.Desktop.ViewModels;

namespace E_LearningQu.Desktop.Views;

public partial class SiswaAiTutorView : UserControl
{
    public SiswaAiTutorView() => InitializeComponent();

    private void OnSessionDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is SiswaAiTutorViewModel vm && sender is ListBox lb && lb.SelectedItem is Contracts.Siswa.TutorSessionDto s)
            _ = vm.OpenSessionAsync(s);
    }

    private async void OnInputKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter || DataContext is not SiswaAiTutorViewModel vm) return;
        e.Handled = true;
        if (vm.SendCommand.CanExecute(null)) await vm.SendCommand.ExecuteAsync(null);
    }
}