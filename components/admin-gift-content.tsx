"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { isGiftCatalogId, type GiftCatalogSection } from "@/lib/gift-catalog"

type AdminGiftContentProps = {
  token: string
}

type RowDraft = {
  id: string
  section: GiftCatalogSection
  name: string
  emoji: string
  cost: number
  published: boolean
  deleted: boolean
}

function parseRows(rows: unknown): RowDraft[] {
  if (!Array.isArray(rows)) return []
  const parsed: RowDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as {
      id?: string
      section?: string
      name?: string
      emoji?: string
      cost?: number
      published?: boolean
      deleted?: boolean
    }
    if (typeof rec.id !== "string" || !isGiftCatalogId(rec.id)) continue
    parsed.push({
      id: rec.id,
      section: rec.section === "free" ? "free" : "premium",
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      emoji: typeof rec.emoji === "string" && rec.emoji.trim() ? rec.emoji.trim() : "🎁",
      cost: Number.isFinite(Number(rec.cost)) ? Math.max(0, Math.floor(Number(rec.cost))) : 0,
      published: rec.published !== false,
      deleted: rec.deleted === true,
    })
  }
  return parsed
}

export function AdminGiftContent({ token }: AdminGiftContentProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/gifts?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить каталог: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(parseRows(data.rows))
    } catch {
      setError("Ошибка сети при загрузке каталога подарков")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const updateRow = (id: string, patch: Partial<RowDraft>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const postUpdate = useCallback(
    async (id: string, payload: Partial<RowDraft>) => {
      setBusyId(id)
      setError("")
      try {
        const res = await apiFetch("/api/admin/content/gifts", {
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
      } catch {
        setError("Ошибка сети при обновлении каталога подарков")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const total = rows.length
  const publishedCount = useMemo(() => rows.filter((r) => r.published && !r.deleted).length, [rows])

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Контент: каталог подарков</h2>
          <p className="text-xs text-slate-400">
            Всего: {total} · опубликовано: {publishedCount}. Изменения сразу применяются в меню подарков за столом.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchRows()}
          className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600"
        >
          Обновить каталог
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-6 text-center text-sm text-slate-400">
          Загрузка каталога...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-3xl">
                  {row.emoji}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-slate-400">{row.id}</div>
                  <div className="truncate text-sm font-semibold text-slate-100">{row.name}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400">
                  Название
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-[11px] text-slate-400">
                  Картинка (emoji)
                  <input
                    type="text"
                    value={row.emoji}
                    onChange={(e) => updateRow(row.id, { emoji: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-[11px] text-slate-400">
                  Стоимость, ❤
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.cost}
                    onChange={(e) => updateRow(row.id, { cost: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() =>
                    void postUpdate(row.id, {
                      section: row.section,
                      name: row.name,
                      emoji: row.emoji,
                      cost: row.cost,
                    })
                  }
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void postUpdate(row.id, { section: row.section === "free" ? "premium" : "free" })}
                  className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                >
                  {row.section === "free" ? "Сделать премиум" : "Сделать бесплатным"}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id || row.deleted}
                  onClick={() => void postUpdate(row.id, { published: !row.published })}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {row.published ? "Снять с публикации" : "Публиковать"}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void postUpdate(row.id, { deleted: !row.deleted })}
                  className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-2.5 py-1.5 text-xs font-medium text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:opacity-50"
                >
                  {row.deleted ? "Восстановить" : "Удалить"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
