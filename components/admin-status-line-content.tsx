"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminStatusLineContentProps = {
  token: string
}

type StatusRow = {
  text: string
  published: boolean
  deleted: boolean
  updatedAt: number
}

export function AdminStatusLineContent({ token }: AdminStatusLineContentProps) {
  const [row, setRow] = useState<StatusRow>({ text: "", published: false, deleted: false, updatedAt: 0 })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const fetchRow = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/status-line?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить статус: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      const next = data?.row
      setRow({
        text: typeof next?.text === "string" ? next.text : "",
        published: next?.published === true,
        deleted: next?.deleted === true,
        updatedAt: Number(next?.updatedAt) || 0,
      })
    } catch {
      setError("Ошибка сети при загрузке статуса")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRow()
  }, [fetchRow])

  const postUpdate = useCallback(
    async (payload: Partial<StatusRow>) => {
      setBusy(true)
      setError("")
      try {
        const res = await apiFetch("/api/admin/content/status-line", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !data?.row) {
          setError(`Не удалось обновить статус: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRow({
          text: typeof data.row.text === "string" ? data.row.text : "",
          published: data.row.published === true,
          deleted: data.row.deleted === true,
          updatedAt: Number(data.row.updatedAt) || Date.now(),
        })
      } catch {
        setError("Ошибка сети при обновлении статуса")
      } finally {
        setBusy(false)
      }
    },
    [token],
  )

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Контент: статус-табло</h2>
          <p className="text-xs text-slate-400">
            Текст публикуется внизу экрана как бегущая строка. Удаление скрывает строку с витрины.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchRow()}
          className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600"
        >
          Обновить
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-6 text-center text-sm text-slate-400">
          Загрузка...
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-[11px] text-slate-400">
            Текст статуса
            <textarea
              value={row.text}
              onChange={(e) => setRow((prev) => ({ ...prev, text: e.target.value }))}
              rows={4}
              placeholder="Например: Сегодня акция — +50% сердец за приглашение друзей"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void postUpdate({ text: row.text, deleted: false, published: false })}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void postUpdate({ text: row.text, deleted: false, published: true })}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Публиковать
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void postUpdate({ published: false })}
              className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
            >
              Снять с публикации
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void postUpdate({ text: "", published: false, deleted: true })}
              className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-2 text-xs font-medium text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:opacity-50"
            >
              Удалить
            </button>
          </div>

          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
            Статус:{" "}
            <span className="font-semibold">
              {row.deleted ? "удалено" : row.published ? "опубликовано" : "черновик"}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

