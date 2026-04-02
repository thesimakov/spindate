"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { toBottleImageUrl } from "@/lib/bottle-catalog"

type AdminBottleContentProps = {
  token: string
}

type RowDraft = {
  id: string
  name: string
  img: string
  section: "free" | "paid" | "vip"
  cost: number
  published: boolean
  deleted: boolean
  isMain: boolean
}

type ShowcaseTier = "free" | "paid" | "vip"

function parseAdminRows(rows: unknown): RowDraft[] {
  if (!Array.isArray(rows)) return []
  const parsed: RowDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const rec = row as {
      id?: string
      name?: string
      img?: string
      section?: string
      cost?: number
      published?: boolean
      deleted?: boolean
      isMain?: boolean
    }
    if (typeof rec.id !== "string" || !rec.id.trim()) continue
    parsed.push({
      id: rec.id,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      img: typeof rec.img === "string" ? rec.img : "",
      section:
        rec.section === "free" || rec.section === "vip"
          ? rec.section
          : Number(rec.cost) <= 0
            ? "free"
            : "paid",
      cost: Number.isFinite(Number(rec.cost)) ? Math.max(0, Math.floor(Number(rec.cost))) : 0,
      published: rec.published !== false,
      deleted: rec.deleted === true,
      isMain: rec.isMain === true,
    })
  }
  return parsed
}

function normalizeCatalogId(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
  return cleaned || fallback
}

function makeUniqueId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) return baseId
  let idx = 2
  while (existingIds.has(`${baseId}-${idx}`)) idx += 1
  return `${baseId}-${idx}`
}

export function AdminBottleContent({ token }: AdminBottleContentProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addTier, setAddTier] = useState<ShowcaseTier>("free")
  const [addDraft, setAddDraft] = useState<RowDraft>({
    id: "new_bottle",
    name: "Новая бутылочка",
    img: "",
    section: "free",
    cost: 0,
    published: true,
    deleted: false,
    isMain: false,
  })

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/bottles?admin_token=${encodeURIComponent(token)}`, {
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
      const parsed = parseAdminRows(data.rows)
      setRows(parsed)
    } catch {
      setError("Ошибка сети при загрузке каталога")
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
        const res = await apiFetch("/api/admin/content/bottles", {
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
        const parsed = parseAdminRows(data.rows)
        setRows(parsed)
      } catch {
        setError("Ошибка сети при обновлении каталога")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const uploadBottleImage = useCallback(
    async (id: string, file: File) => {
      setBusyId(id)
      setError("")
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("bucket", "bottle")
        const res = await apiFetch("/api/admin/content/upload-image", {
          method: "POST",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: form,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || typeof data.path !== "string") {
          setError(`Не удалось загрузить файл: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        updateRow(id, { img: data.path })
        await postUpdate(id, { img: data.path })
      } catch {
        setError("Ошибка сети при загрузке картинки")
      } finally {
        setBusyId(null)
      }
    },
    [token, postUpdate],
  )

  const total = rows.length
  const publishedCount = useMemo(() => rows.filter((r) => r.published && !r.deleted).length, [rows])
  const addBusyKey = "__new_bottle__"

  const createFromAddDraft = useCallback(async () => {
    const existingIds = new Set(rows.map((row) => row.id))
    const baseId = normalizeCatalogId(addDraft.id || addDraft.name, "bottle")
    const id = makeUniqueId(baseId, existingIds)
    const nextCost = addTier === "free" ? 0 : addDraft.cost
    const nextSection: "free" | "paid" | "vip" = addTier === "free" ? "free" : addTier === "vip" ? "vip" : "paid"
    await postUpdate(id, {
      ...addDraft,
      id,
      section: nextSection,
      cost: Math.max(0, Math.floor(Number(nextCost) || 0)),
      published: true,
      deleted: false,
    })
    setAddDraft((prev) => ({
      ...prev,
      id: "",
      name: "Новая бутылочка",
      img: "",
      section: nextSection,
      cost: addTier === "free" ? 0 : prev.cost,
      isMain: false,
    }))
  }, [addDraft, addTier, postUpdate, rows])

  const uploadNewBottleImage = useCallback(
    async (file: File) => {
      setBusyId(addBusyKey)
      setError("")
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("bucket", "bottle")
        const res = await apiFetch("/api/admin/content/upload-image", {
          method: "POST",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: form,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || typeof data.path !== "string") {
          setError(`Не удалось загрузить файл: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setAddDraft((prev) => ({ ...prev, img: data.path }))
      } catch {
        setError("Ошибка сети при загрузке картинки")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Контент: каталог бутылочек</h2>
          <p className="text-xs text-slate-400">
            Всего: {total} · опубликовано: {publishedCount}. После публикации бутылочка сразу появляется в игре.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/25"
          >
            Добавить
          </button>
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600"
          >
            Обновить каталог
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl border border-violet-500/35 bg-violet-950/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-200">Добавление бутылочки</p>
          <div className="grid gap-2 md:grid-cols-4">
            <label className="text-[11px] text-slate-400">
              ID
              <input
                type="text"
                value={addDraft.id}
                onChange={(e) => setAddDraft((p) => ({ ...p, id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                placeholder="new_bottle"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Витрина
              <select
                value={addTier}
                onChange={(e) => setAddTier(e.target.value as ShowcaseTier)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="free">Бесплатные</option>
                <option value="paid">Платные</option>
                <option value="vip">VIP</option>
              </select>
            </label>
            <label className="text-[11px] text-slate-400">
              Название
              <input
                type="text"
                value={addDraft.name}
                onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Стоимость
              <input
                type="number"
                min={0}
                step={1}
                value={addDraft.cost}
                onChange={(e) => setAddDraft((p) => ({ ...p, cost: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Картинка (файл)
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={addDraft.img}
                  readOnly
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-500 bg-slate-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600">
                  Файл
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={busyId === addBusyKey}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.currentTarget.value = ""
                      if (!file) return
                      void uploadNewBottleImage(file)
                    }}
                  />
                </label>
              </div>
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={addDraft.isMain}
              onChange={(e) => setAddDraft((p) => ({ ...p, isMain: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-amber-200 font-medium">Главная</span>
            <span className="text-slate-500">(заменяет дефолтную бутылочку на всех столах, для праздников)</span>
          </label>
          <p className="mt-2 text-xs text-slate-400">
            ID можно задать вручную, если оставить пустым - сформируется автоматически.
          </p>
          <button
            type="button"
            onClick={() => void createFromAddDraft()}
            className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
          >
            Создать / добавить
          </button>
        </div>
      )}

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
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  {row.id === "fortune_wheel" ? (
                    <div className="flex h-full items-center justify-center text-[10px] text-slate-400">wheel</div>
                  ) : row.img ? (
                    <img src={toBottleImageUrl(row.img)} alt={row.name} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-slate-500">нет img</div>
                  )}
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
                  Картинка (загрузка файла)
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={row.img}
                      readOnly
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                    />
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-500 bg-slate-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600">
                      Прикрепить файл
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={busyId === row.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.currentTarget.value = ""
                          if (!file) return
                          void uploadBottleImage(row.id, file)
                        }}
                      />
                    </label>
                  </div>
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
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.isMain}
                    onChange={(e) => {
                      const checked = e.target.checked
                      if (checked) {
                        setRows((prev) => prev.map((r) => ({ ...r, isMain: r.id === row.id })))
                      } else {
                        updateRow(row.id, { isMain: false })
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500/30"
                  />
                  <span className={row.isMain ? "font-semibold text-amber-300" : "text-slate-400"}>
                    Главная {row.isMain && "★"}
                  </span>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() =>
                    void postUpdate(row.id, {
                      name: row.name,
                      img: row.img,
                      section: row.section,
                      cost: row.cost,
                      isMain: row.isMain,
                    })
                  }
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Сохранить
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
                  onClick={() => {
                    const nextSection = row.section === "free" ? "paid" : row.section === "paid" ? "vip" : "free"
                    void postUpdate(row.id, { section: nextSection })
                  }}
                  className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                >
                  {row.section === "free" ? "В витрину: Доступно" : row.section === "paid" ? "В витрину: VIP" : "В витрину: Бесплатно"}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void postUpdate(row.id, { deleted: true })}
                  className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-2.5 py-1.5 text-xs font-medium text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
