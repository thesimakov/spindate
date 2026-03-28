"use client"

import { useEffect, type CSSProperties } from "react"

/** Стили inline: работают даже если бандл CSS с /_next/static не загрузился (500 у прокси и т.п.). */
const shell: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f172a",
  color: "#f1f5f9",
  padding: "1rem",
}

const card: CSSProperties = {
  maxWidth: "28rem",
  borderRadius: "1rem",
  border: "1px solid rgba(71, 85, 105, 0.8)",
  background: "rgba(15, 23, 42, 0.95)",
  padding: "1.5rem",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div style={shell}>
      <div style={card}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 700, color: "#fda4af" }}>
          Что-то пошло не так
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#94a3b8", lineHeight: 1.5 }}>
          Произошла ошибка при загрузке приложения. Попробуйте обновить страницу.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <pre
            style={{
              marginBottom: "1rem",
              maxHeight: "8rem",
              overflow: "auto",
              borderRadius: "0.5rem",
              background: "rgba(30, 41, 59, 0.8)",
              padding: "0.75rem",
              fontSize: "0.75rem",
              color: "#fde68a",
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            width: "100%",
            borderRadius: "0.75rem",
            border: "none",
            background: "rgba(244, 63, 94, 0.9)",
            padding: "0.75rem 1rem",
            fontWeight: 600,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Обновить страницу
        </button>
      </div>
    </div>
  )
}
