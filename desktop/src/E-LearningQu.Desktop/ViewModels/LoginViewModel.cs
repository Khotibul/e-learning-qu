using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Desktop.ViewModels;

public partial class LoginViewModel : ObservableObject
{
    private readonly IAuthService _auth;
    private readonly IOAuthService _oauth;

    public event EventHandler? LoginSucceeded;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    private string email = "";

    [ObservableProperty]
    private string password = "";

    [ObservableProperty]
    private Role selectedRole = Role.SISWA;

    [ObservableProperty]
    private string? errorMessage;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    [NotifyCanExecuteChangedFor(nameof(LoginWithGoogleCommand))]
    private bool isBusy;

    public IReadOnlyList<Role> Roles { get; } = new[] { Role.SISWA, Role.GURU };

    public LoginViewModel(IAuthService auth, IOAuthService oauth)
    {
        _auth = auth;
        _oauth = oauth;
    }

    private bool CanLogin() => !IsBusy && !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password);
    private bool CanLoginGoogle() => !IsBusy;

    [RelayCommand(CanExecute = nameof(CanLogin))]
    private async Task LoginAsync()
    {
        ErrorMessage = null;
        IsBusy = true;
        try
        {
            var result = await _auth.LoginAsync(Email, Password, SelectedRole);
            if (result.IsSuccess)
                LoginSucceeded?.Invoke(this, EventArgs.Empty);
            else
                ErrorMessage = result.ErrorMessage ?? "Login gagal.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand(CanExecute = nameof(CanLoginGoogle))]
    private async Task LoginWithGoogleAsync()
    {
        ErrorMessage = null;
        IsBusy = true;
        try
        {
            var result = await _oauth.LoginWithGoogleAsync(SelectedRole.ToString());
            if (result.IsSuccess)
                LoginSucceeded?.Invoke(this, EventArgs.Empty);
            else
                ErrorMessage = result.ErrorMessage ?? "Login Google gagal.";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
