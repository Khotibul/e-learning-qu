using System.IO;
using Microsoft.Extensions.Logging;

namespace E_LearningQu.Desktop;

/// <summary>Log diagnostik sederhana ke %LocalAppData%\E-LearningQu\logs\app-YYYYMMDD.log.</summary>
public static class DesktopLog
{
    private static readonly object Gate = new();

    public static void Log(string message)
    {
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "E-LearningQu", "logs");
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"app-{DateTime.Now:yyyyMMdd}.log");
            lock (Gate)
            {
                File.AppendAllText(file, $"[{DateTime.Now:HH:mm:ss.fff}] {message}{Environment.NewLine}");
            }
        }
        catch
        {
            // logging tidak boleh crash app
        }
    }
}

/// <summary>ILoggerProvider agar log Microsoft.Extensions (mis. HTTP BackendApiClient) ikut tercatat ke file.</summary>
public sealed class DesktopFileLoggerProvider : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new DesktopFileLogger(categoryName);

    public void Dispose() { }

    private sealed class DesktopFileLogger(string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            DesktopLog.Log($"[{category}] {logLevel}: {formatter(state, exception)}" + (exception is null ? "" : $" :: {exception.Message}"));
        }
    }
}
