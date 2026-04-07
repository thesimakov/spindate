"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminTickerAnnouncementsContentProps = {
  token: string
}

type Row = {
  id: number
  authorDisplayName: string
  body: string
  linkUrl: string
  durationMs: number
  costHearts: number
  status: string
  paidAt: number
  queueStartMs: number | null
  queueEndMs: number | null
  createdAt: number
  updatedAt: number
  rejectReason: string | null
  ownerUserId: string | null
  ownerVkUserId: number | null
}

function fmtTs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—"
  return new Date(ms).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
}

export function AdminTickerAnnouncementsContent({ token }: AdminTickerAnnouncementsContentProps) {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejectForId, setRejectForId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/ticker-announcements?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        setError(`Ошибка загрузки: ${res.status}`)
        return
      }
      setItems(data.items as Row[])
    } catch {
      setError("Сеть")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const postAction = useCallback(
    async (id: number, action: "publish" | "delete" | "reject", reason?: string) => {
      setBusyId(id)
      setError("")
      try {
        const body: Record<string, unknown> = { id, action }
        if (action === "reject") body.reason = reason ?? ""
        const res = await apiFetch("/api/admin/content/ticker-announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          credentials: "include",
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setError(typeof data?.error === "string" ? data.error : `Ошибка ${res.status}`)
          return
        }
        await load()
        setRejectForId(null)
        setRejectReason("")
      } catch {
        setError("Сеть")
      } finally {
        setBusyId(null)
      }
    },
    [load, token],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Обновить
        </button>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>

      {loading && items.length === 0 ? (
        <p className="text-sm text-slate-400">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Нет объявлений</p>
      ) : (
        <div className="max-h-[70dvh] overflow-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[720px] text-left text-xs text-slate-200">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
              <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="p-2">Автор</th>
                <th className="p-2">Текст</th>
                <th className="p-2">Ссылка</th>
                <th className="p-2">Статус</th>
                <th className="p-2">Окно</th>
                <th className="p-2">❤</th>
                <th className="p-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const pending = r.status === "pending_moderation"
                const b = busyId === r.id
                return (
                  <tr key={r.id} className="border-b border-slate-800 align-top">
                    <td className="p-2">
                      <div className="font-medium">{r.authorDisplayName}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {r.ownerUserId
                          ? `login: ${r.ownerUserId.slice(0, 8)}…`
                          : r.ownerVkUserId != null
                            ? `VK: ${r.ownerVkUserId}`
                            : "—"}
                      </div>
                    </td>
                    <td className="p-2 max-w-[200px] break-words">{r.body}</td>
                    <td className="p-2 max-w-[180px] break-all">
                      <a href={r.linkUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                        {r.linkUrl}
                      </a>
                    </td>
                    <td className="p-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5">{r.status}</span>
                      {r.rejectReason ? (
                        <div className="mt-1 text-[10px] text-orange-300/90">{r.rejectReason}</div>
                      ) : null}
                    </td>
                    <td className="p-2 text-[10px] text-slate-400">
                      {fmtTs(r.queueStartMs)}
                      <br />
                      {fmtTs(r.queueEndMs)}
                    </td>
                    <td className="p-2">{r.costHearts}</td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {pending ? (
                          <>
                            <button
                              type="button"
                              disabled={b}
                              onClick={() => void postAction(r.id, "publish")}
                              className="rounded border border-emerald-600/50 bg-emerald-950/40 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-50"
                            >
                              Опубликовать
                            </button>
                            {rejectForId === r.id ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Причина (необязательно)"
                                  className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px]"
                                />
                                <button
                                  type="button"
                                  disabled={b}
                                  onClick={() => void postAction(r.id, "reject", rejectReason)}
                                  className="rounded border border-orange-600/50 bg-orange-950/40 px-2 py-1 text-[10px] font-semibold text-orange-200"
                                >
                                  Подтвердить отклонение
                                </button>
                                <button
                                  type="button"
                                  disabled={b}
                                  onClick={() => {
                                    setRejectForId(null)
                                    setRejectReason("")
                                  }}
                                  className="text-[10px] text-slate-400 underline"
                                >
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={b}
                                onClick={() => {
                                  setRejectForId(r.id)
                                  setRejectReason("")
                                }}
                                className="rounded border border-orange-600/40 bg-slate-900/50 px-2 py-1 text-[10px] font-semibold text-orange-200"
                              >
                                Отклонить
                              </button>
                            )}
                          </>
                        ) : null}
                        {r.status !== "deleted" ? (
                          <button
                            type="button"
                            disabled={b}
                            onClick={() => void postAction(r.id, "delete")}
                            className="rounded border border-red-600/50 bg-red-950/30 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-50"
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Очередь: при публикации слот начинается после хвоста текущей очереди (или сразу, если очередь пуста). На табло
        показывается активное по времени окно; иначе — редакционная строка статуса.
      </p>
    </div>
  )
}
