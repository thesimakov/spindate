"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"

type AdminTableStyleContentProps = {
  token: string
}

type RowDraft = {
  id: RoomTableStyle
  name: string
  published: boolean
  updatedAt: number
  sortOrder: number
}

type GlobalSkinDraft = {
  enabled: boolean
  styleId: RoomTableStyle
}

function parseRows(rows: unknown): RowDraft[] {
  if (!Array.isArray(rows)) return []
  const parsed: RowDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as Partial<RowDraft> & { id?: string }
    if (typeof rec.id !== "string") continue
    parsed.push({
      id: rec.id as RoomTableStyle,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      published: rec.published === true,
      updatedAt: Number(rec.updatedAt) || 0,
      sortOrder: Number(rec.sortOrder) || 0,
    })
  }
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

function parseGlobalSkin(raw: unknown): GlobalSkinDraft | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as { enabled?: unknown; styleId?: unknown }
  if (typeof o.enabled !== "boolean") return null
  if (typeof o.styleId !== "string") return null
  return { enabled: o.enabled, styleId: o.styleId as RoomTableStyle }
}

export function AdminTableStyleContent({ token }: AdminTableStyleContentProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [globalSkin, setGlobalSkin] = useState<GlobalSkinDraft>({
    enabled: false,
    styleId: "classic_night",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [globalBusy, setGlobalBusy] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/table-styles?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить стили стола: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(parseRows(data.rows))
      const g0 = parseGlobalSkin(data.globalSkin)
      if (g0) setGlobalSkin(g0)
    } catch {
      setError("Ошибка сети при загрузке стилей стола")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const postUpdate = useCallback(
    async (id: RoomTableStyle, payload: Partial<Pick<RowDraft, "name" | "published">>) => {
      setBusyId(id)
      setError("")
      try {
        const res = await apiFetch("/api/admin/content/table-styles", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify({ id, ...payload }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setError(`Не удалось обновить ${id}: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRows(parseRows(data.rows))
        const g = parseGlobalSkin(data.globalSkin)
        if (g) setGlobalSkin(g)
      } catch {
        setError("Ошибка сети при обновлении стилей стола")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const saveGlobalSkin = useCallback(async () => {
    setGlobalBusy(true)
    setError("")
    try {
      const res = await apiFetch("/api/admin/content/table-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          globalSkin: { enabled: globalSkin.enabled, styleId: globalSkin.styleId },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось сохранить общий скин: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(parseRows(data.rows))
      const g = parseGlobalSkin(data.globalSkin)
      if (g) setGlobalSkin(g)
    } catch {
      setError("Ошибка сети при сохранении общего скина")
    } finally {
      setGlobalBusy(false)
    }
  }, [token, globalSkin.enabled, globalSkin.styleId])

  const cosmic = useMemo(() => rows.find((r) => r.id === "cosmic_rockets"), [rows])

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Контент: стили стола</h2>
          <p className="text-xs text-slate-400">
            Витрина для лобби: скрытый стиль не появится при создании комнаты. «Космос и ракеты» — отдельный скин с
            анимацией.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchRows()}
          className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600"
        >
          Обновить
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-6 text-center text-sm text-slate-400">
          Загрузка...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-amber-600/45 bg-slate-900/70 p-3 md:col-span-2">
            <h3 className="text-sm font-semibold text-amber-100">Общий скин (системные столы)</h3>
            <p className="mt-1 text-xs text-slate-400">
              Если включено, выбранный стиль применяется ко всем столам без признака «комната пользователя». Столы,
              созданные игроками со своим выбором в лобби, сохраняют свой скин.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500/30"
                  checked={globalSkin.enabled}
                  disabled={globalBusy}
                  onChange={(e) => setGlobalSkin((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="font-semibold">Применять ко всем системным столам</span>
              </label>
              <label className="block min-w-[10rem] text-[11px] text-slate-400">
                Стиль
                <select
                  value={globalSkin.styleId}
                  disabled={globalBusy}
                  onChange={(e) =>
                    setGlobalSkin((prev) => ({ ...prev, styleId: e.target.value as RoomTableStyle }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={globalBusy || rows.length === 0}
                onClick={() => void saveGlobalSkin()}
                className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {globalBusy ? "Сохранение…" : "Сохранить общий скин"}
              </button>
            </div>
          </article>

          <article className="rounded-xl border border-cyan-700/40 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-slate-400">cosmic_rockets</div>
                <div className="truncate text-sm font-semibold text-slate-100">Космос и ракеты</div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500/30"
                  checked={cosmic?.published === true}
                  disabled={busyId === "cosmic_rockets" || !cosmic}
                  onChange={(e) => void postUpdate("cosmic_rockets", { published: e.target.checked })}
                />
                <span className="font-semibold">Включить в лобби</span>
              </label>
            </div>
            <p className="text-xs text-slate-500">
              По умолчанию выключено: можно подготовить скин и включить перед продажей/ивентом.
            </p>
          </article>

          {rows
            .filter((r) => r.id !== "cosmic_rockets")
            .map((row) => (
              <article key={row.id} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-400">{row.id}</div>
                    <div className="truncate text-sm font-semibold text-slate-100">{row.name}</div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500/30"
                      checked={row.published}
                      disabled={busyId === row.id}
                      onChange={(e) => void postUpdate(row.id, { published: e.target.checked })}
                    />
                    <span className="font-semibold">В лобби</span>
                  </label>
                </div>
                <label className="block text-[11px] text-slate-400">
                  Название (для справки)
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void postUpdate(row.id, { name: row.name })}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    Сохранить название
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  )
}
