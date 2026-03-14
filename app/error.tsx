"use client"

import { useEffect } from "react"

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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0f172a] px-4 text-slate-100">
      <div className="max-w-md rounded-2xl border border-slate-600/80 bg-slate-900/95 p-6 shadow-xl">
        <h1 className="mb-2 text-lg font-bold text-rose-300">Что-то пошло не так</h1>
        <p className="mb-4 text-sm text-slate-400">
          Произошла ошибка при загрузке приложения. Попробуйте обновить страницу.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-slate-800/80 p-3 text-xs text-amber-200">
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl bg-rose-500/90 px-4 py-3 font-semibold text-white transition hover:bg-rose-500"
        >
          Обновить страницу
        </button>
      </div>
    </div>
  )
}
