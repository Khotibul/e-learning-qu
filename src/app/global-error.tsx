"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Terjadi kesalahan</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>{error.message || "Terjadi kesalahan yang tidak terduga"}</p>
          <button
            onClick={() => reset()}
            style={{ padding: "0.5rem 1.5rem", borderRadius: "0.5rem", border: "1px solid #ccc", cursor: "pointer", fontSize: "1rem" }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  )
}
