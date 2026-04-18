"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminMaintenanceContentProps = {
  token: string
}

type MaintenanceRow = {
  enabled: boolean
  updatedAt: number
}

export function AdminMaintenanceContent({ token }: AdminMaintenanceContentProps) {
  const [row, setRow] = useState<MaintenanceRow>({ enabled: false, updatedAt: 0 })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const fetchRow = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/maintenance-mode?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.row) {
        setError(`Не удалось загрузить режим техработ: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRow({
        enabled: data.row.enabled === true,
        updatedAt: Number(data.row.updatedAt) || 0,
      })
    } catch {
      setError("Ошибка сети при загрузке режима техработ")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRow()
  }, [fetchRow])

  const toggleMode = useCallback(
    async (enabled: boolean) => {
      setBusy(true)
      setError("")
      try {
        const res = await apiFetch("/api/admin/maintenance-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify({ enabled }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !data?.row) {
          setError(`Не удалось переключить режим: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRow({
          enabled: data.row.enabled === true,
          updatedAt: Number(data.row.updatedAt) || Date.now(),
        })
      } catch {
        setError("Ошибка сети при переключении режима техработ")
      } finally {
        setBusy(false)
      }
    },
    [token],
  )

  return (
    <section className="mb-4 rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">ТЕХ работы</h2>
          <p className="mt-1 text-xs text-slate-400">
            Глобально показывает игрокам окно техработ с кнопкой подписки на группу VK.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void toggleMode(true)}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            Включить
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void toggleMode(false)}
            className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
          >
            Выключить
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void fetchRow()}
            className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-50"
          >
            Обновить
          </button>
        </div>
      </div>
      {error ? (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
      <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
        Статус: <span className="font-semibold">{row.enabled ? "включено" : "выключено"}</span>
      </div>
    </section>
  )
}
