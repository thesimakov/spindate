"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminTablesContentProps = { token: string; refreshTrigger?: number }

type TableRow = {
  roomId: number
  name: string
  createdByUserId: number | null
  createdAtMs: number | null
  disabledByAdmin: boolean
  livePlayerCount: number
  maxPlayers: number
  bottleSkin: string
  tableStyle: string
  authorityRevision: number | null
  roundNumber: number | null
}

type Stats = {
  userRoomsTotal: number
  userRoomsDisabled: number
  userRoomsActive: number
  livePlayersOnActiveUserRooms: number
}

export function AdminTablesContent({ token, refreshTrigger = 0 }: AdminTablesContentProps) {
  const [rows, setRows] = useState<TableRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyRoomId, setBusyRoomId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/tables?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить столы: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(Array.isArray(data.rooms) ? data.rooms : [])
      setStats(typeof data.stats === "object" && data.stats != null ? data.stats : null)
    } catch {
      setError("Ошибка сети при загрузке столов")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshTrigger])

  const toggleDisabled = async (roomId: number, disable: boolean) => {
    setBusyRoomId(roomId)
    setError("")
    try {
      const res = await apiFetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ roomId, action: disable ? "disable" : "enable" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Действие не выполнено: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      await fetchData()
    } catch {
      setError("Ошибка сети")
    } finally {
      setBusyRoomId(null)
    }
  }

  const deleteRoom = async (roomId: number, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Удалить стол #${roomId} «${name}» безвозвратно?\n\n` +
          "Комната исчезнет из лобби, все игроки будут выгнаны, на сервере будут очищены состояние стола, лента событий и чат комнаты.",
      )
    ) {
      return
    }
    setBusyRoomId(roomId)
    setError("")
    try {
      const res = await apiFetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ roomId, action: "delete" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Удаление не выполнено: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      await fetchData()
    } catch {
      setError("Ошибка сети")
    } finally {
      setBusyRoomId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Столы, созданные игроками (платное создание). Отключённый стол скрыт из лобби, вход запрещён, игроки выкидываются
          из live.
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

      {stats && (
        <div
          className="grid gap-3 rounded-xl border border-slate-600 bg-slate-800/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ color: "#e2e8f0" }}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Всего игровых столов</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-amber-200">{stats.userRoomsTotal}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Активны (не отключены)</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-emerald-200">{stats.userRoomsActive}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Отключены модератором</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-rose-200">{stats.userRoomsDisabled}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Живых игроков на активных</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-sky-200">
              {stats.livePlayersOnActiveUserRooms}
            </div>
          </div>
        </div>
      )}

      <div className="max-h-[62dvh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-600 bg-slate-800/40">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-600 bg-slate-800/95 backdrop-blur">
              <th className="px-3 py-3 font-semibold text-slate-300">ID</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Название</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Создатель (id)</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Создан</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Live</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Раунд / rev</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Статус</th>
              <th className="px-3 py-3 font-semibold text-slate-300">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  Пока нет столов, созданных игроками.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.roomId} className="border-b border-slate-700/80 hover:bg-slate-700/25">
                <td className="px-3 py-2.5 font-mono tabular-nums text-slate-300">#{r.roomId}</td>
                <td className="px-3 py-2.5 font-medium text-slate-100">{r.name}</td>
                <td className="px-3 py-2.5 font-mono text-slate-400">{r.createdByUserId ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-400">
                  {r.createdAtMs
                    ? new Date(r.createdAtMs).toLocaleString("ru-RU", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-300">
                  {r.livePlayerCount} / {r.maxPlayers}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">
                  {r.roundNumber ?? "—"} · rev {r.authorityRevision ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  {r.disabledByAdmin ? (
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-200">
                      Отключён
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                      Активен
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.disabledByAdmin ? (
                      <button
                        type="button"
                        disabled={busyRoomId === r.roomId}
                        onClick={() => void toggleDisabled(r.roomId, false)}
                        className="rounded border border-emerald-500/45 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        Включить
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyRoomId === r.roomId}
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(`Отключить стол #${r.roomId}? Игроки будут выкинуты из live.`)
                          ) {
                            return
                          }
                          void toggleDisabled(r.roomId, true)
                        }}
                        className="rounded border border-rose-500/45 bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        Отключить
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyRoomId === r.roomId}
                      onClick={() => void deleteRoom(r.roomId, r.name)}
                      className="rounded border border-red-600/50 bg-red-950/40 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-900/50 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
