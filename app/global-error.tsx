"use client"

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "1rem", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "28rem", padding: "1.5rem", background: "rgba(30,41,59,0.95)", borderRadius: "1rem", border: "1px solid #334155" }}>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", color: "#fda4af" }}>Ошибка загрузки</h1>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>
            Обновите страницу или зайдите позже.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "0.9375rem", fontWeight: 600, color: "#fff", background: "#e11d48", border: "none", borderRadius: "0.75rem", cursor: "pointer" }}
          >
            Обновить страницу
          </button>
        </div>
      </body>
    </html>
  )
}
