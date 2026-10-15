using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json.Serialization;

namespace E_LearningQu.Desktop;

/// <summary>Isi instance record request dari hasil form (match property name / JsonPropertyName).</summary>
public static class FormMap
{
    public static T Build<T>(IReadOnlyList<FormFieldDef> fields) where T : new()
    {
        var obj = new T();
        var type = typeof(T);
        var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        foreach (var f in fields)
        {
            var prop = props.FirstOrDefault(p => string.Equals(p.Name, f.Key, StringComparison.OrdinalIgnoreCase))
                       ?? props.FirstOrDefault(p => p.GetCustomAttribute<JsonPropertyNameAttribute>() is { } a
                                                   && string.Equals(a.Name, f.Key, StringComparison.OrdinalIgnoreCase));
            if (prop is null || !prop.CanWrite) continue;
            prop.SetValue(obj, ConvertTo(f.Value, prop.PropertyType));
        }
        return obj;
    }

    private static object? ConvertTo(string? raw, Type target)
    {
        var underlying = Nullable.GetUnderlyingType(target);
        var t = underlying ?? target;
        var isNullable = underlying is not null || !t.IsValueType;

        if (string.IsNullOrWhiteSpace(raw))
            return isNullable ? null : Activator.CreateInstance(t);

        if (t == typeof(string)) return raw;
        if (t == typeof(int)) return int.TryParse(raw, out var i) ? i : 0;
        if (t == typeof(long)) return long.TryParse(raw, out var l) ? l : 0L;
        if (t == typeof(decimal)) return decimal.TryParse(raw, out var d) ? d : 0m;
        if (t == typeof(double)) return double.TryParse(raw, out var d2) ? d2 : 0d;
        if (t == typeof(bool)) return raw.Equals("true", StringComparison.OrdinalIgnoreCase) || raw == "1";
        if (t == typeof(DateTime)) return DateTime.TryParse(raw, out var dt) ? dt : default(DateTime);
        if (t == typeof(DateOnly)) return DateOnly.TryParse(raw, out var d3) ? d3 : default(DateOnly);
        return null;
    }
}
