using System.Collections.Generic;

namespace E_LearningQu.Desktop;

public enum FormFieldKind { Text, Password, Int, Bool, Combo, Memo, Date }

public sealed record ComboOption(string Value, string Display);

public sealed class FormFieldDef
{
    public string Key { get; init; } = "";
    public string Label { get; init; } = "";
    public FormFieldKind Kind { get; init; } = FormFieldKind.Text;
    public string? Value { get; set; }
    public bool Required { get; init; }
    public IReadOnlyList<ComboOption>? Options { get; init; }
    public string? Placeholder { get; init; }
}
