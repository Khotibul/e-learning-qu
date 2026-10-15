using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;

namespace E_LearningQu.Desktop.Views;

public partial class FormDialogWindow : Window
{
    public string DialogTitle { get; }
    public string Subtitle { get; }
    public string SaveText { get; }

    public IReadOnlyList<FormFieldDef> Fields { get; }
    public IReadOnlyDictionary<string, string?> Values { get; private set; } =
        new Dictionary<string, string?>();

    public FormDialogWindow(string title, IReadOnlyList<FormFieldDef> fields,
        string subtitle = "", string saveText = "Simpan")
    {
        InitializeComponent();
        DialogTitle = title;
        Subtitle = subtitle;
        SaveText = saveText;
        Fields = fields;
        DataContext = this;
        BuildFields();
    }

    private void BuildFields()
    {
        foreach (var f in Fields)
        {
            var row = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };

            var label = new TextBlock
            {
                Text = f.Label + (f.Required ? " *" : ""),
                Style = (System.Windows.Style)FindResource("FieldLabel"),
                Margin = new Thickness(0, 0, 0, 6)
            };
            row.Children.Add(label);
            row.Children.Add(BuildControl(f));
            FieldsPanel.Children.Add(row);
        }
    }

    private FrameworkElement BuildControl(FormFieldDef f)
    {
        switch (f.Kind)
        {
            case FormFieldKind.Combo:
            {
                var cb = new ComboBox
                {
                    Style = (System.Windows.Style)FindResource("InputCombo"),
                    ItemsSource = f.Options,
                    DisplayMemberPath = nameof(ComboOption.Display),
                    SelectedValuePath = nameof(ComboOption.Value),
                    HorizontalAlignment = HorizontalAlignment.Stretch
                };
                if (f.Value is not null) cb.SelectedValue = f.Value;
                return cb;
            }
            case FormFieldKind.Bool:
            {
                return new CheckBox
                {
                    Content = f.Label,
                    IsChecked = f.Value == "true" || f.Value == "True",
                    VerticalAlignment = VerticalAlignment.Center,
                    Margin = new Thickness(0, 4, 0, 0)
                };
            }
            case FormFieldKind.Memo:
            {
                return new TextBox
                {
                    Style = (System.Windows.Style)FindResource("InputBox"),
                    AcceptsReturn = true,
                    TextWrapping = TextWrapping.Wrap,
                    MinHeight = 80,
                    VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                    Text = f.Value ?? ""
                };
            }
            case FormFieldKind.Password:
            {
                return new PasswordBox
                {
                    Style = (System.Windows.Style)FindResource("InputBox"),
                    Password = f.Value ?? ""
                };
            }
            default: // Text, Int, Date
            {
                return new TextBox
                {
                    Style = (System.Windows.Style)FindResource("InputBox"),
                    Text = f.Value ?? ""
                };
            }
        }
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        var result = new Dictionary<string, string?>();
        for (int i = 0; i < Fields.Count; i++)
        {
            var f = Fields[i];
            if (i >= FieldsPanel.Children.Count) break;
            if (FieldsPanel.Children[i] is not StackPanel row || row.Children.Count < 2) continue;

            string? val = row.Children[1] switch
            {
                ComboBox cb => cb.SelectedValue as string,
                CheckBox chk => chk.IsChecked == true ? "true" : "false",
                PasswordBox pb => pb.Password,
                TextBox tb => tb.Text,
                _ => null
            };

            if (f.Required && string.IsNullOrWhiteSpace(val))
            {
                MessageBox.Show(this, $"{f.Label} wajib diisi.", "Validasi",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            result[f.Key] = val;
        }
        Values = result;
        DialogResult = true;
    }

    private void OnCancel(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}
