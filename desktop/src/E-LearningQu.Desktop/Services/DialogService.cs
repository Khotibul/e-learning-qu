using System.Windows;
using E_LearningQu.Desktop.Views;

namespace E_LearningQu.Desktop;

public enum ToastKind { Success, Error, Warning, Info }

public static class DialogService
{
    public static Window? Owner { get; set; }

    public static Task<bool> ConfirmAsync(string title, string message, string confirmText = "Ya, Lanjutkan") =>
        System.Windows.Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var win = new ConfirmWindow(title, message, confirmText) { Owner = Owner };
            return win.ShowDialog() == true;
        }).Task;

    public static void Toast(string message, ToastKind kind = ToastKind.Info) =>
        ToastService.Show(message, kind);
}
