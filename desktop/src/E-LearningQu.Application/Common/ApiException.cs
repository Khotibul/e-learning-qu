using System.Net;

namespace E_LearningQu.Application.Common;

/// <summary>Exception untuk semua kegagalan panggilan backend (status + pesan dari body {"error"}).</summary>
public sealed class ApiException : Exception
{
    public HttpStatusCode StatusCode { get; }
    public string? ServerMessage { get; }

    public ApiException(HttpStatusCode statusCode, string? serverMessage, string? message = null, Exception? inner = null)
        : base(message ?? serverMessage ?? $"HTTP {(int)statusCode}", inner)
    {
        StatusCode = statusCode;
        ServerMessage = serverMessage;
    }
}
