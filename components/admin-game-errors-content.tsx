"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminGameErrorsContentProps = { token: string }

type Item = {
  id: number
  createdAt: number
  source: string
  message: string
  stack: string | null
  payload: unknown
}

export function AdminGameErrorsContent({ token }: AdminGameErrorsContentProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(
        `/api/admin/game-client-errors?limit=100&admin_token=${encodeURIComponent(token)}`,
        {
          method: "GET",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        setError(`Не удалось загрузить: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setItems(data.items as Item[])
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          Отчёты с клиента: ручная диагностика, ошибки окна и необработанные промисы.
        </p>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={loading}
          className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-50"
        >
          {loading ? "Загрузка…" : "Обновить"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="max-h-[72dvh] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-slate-500">Пока нет записей</p>
        )}
        {items.map((row) => {
          const open = expandedId === row.id
          return (
            <div
              key={row.id}
              className="rounded-xl border border-slate-600/80 bg-slate-900/50 p-3 text-left text-sm text-slate-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-slate-500">#{row.id}</span>{" "}
                  <span className="text-xs text-slate-400">
                    {new Date(row.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </span>
                  <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
                    {row.source}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : row.id)}
                  className="shrink-0 rounded border border-slate-500 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                >
                  {open ? "Свернуть" : "Подробнее"}
                </button>
              </div>
              <p className="mt-2 break-words font-medium text-slate-100">{row.message}</p>
              {row.stack && (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950/80 p-2 text-xs text-red-200/90">
                  {row.stack}
                </pre>
              )}
              {open && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950/80 p-2 text-xs text-cyan-100/90">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
