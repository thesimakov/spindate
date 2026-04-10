"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminRankingsEventsContentProps = { token: string }

type RowDraft = {
  achievementKey: string
  statsKeyTitle: string
  title: string
  hint: string
  defaultStatus: string
  group: "base" | "events" | "system"
  imageUrl: string
  postTextTemplate: string
  vkEnabled: boolean
  published: boolean
  targetCount: number | null
  /** Запись только в БД (ключ custom_*) */
  isCustom?: boolean
}

const DEFAULT_VK_POST = `Игрок {name} получил достижение «{achievement}» в Крути и знакомься!\n{game_url}`

function makeNewEventDraft(): RowDraft {
  return {
    achievementKey: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    statsKeyTitle: "",
    title: "",
    hint: "",
    defaultStatus: "",
    group: "events",
    imageUrl: "",
    postTextTemplate: DEFAULT_VK_POST,
    vkEnabled: false,
    published: false,
    targetCount: null,
    isCustom: true,
  }
}

function parseRows(raw: unknown): RowDraft[] {
  if (!Array.isArray(raw)) return []
  const out: RowDraft[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const x = row as Partial<RowDraft> & { statsKeyTitle?: string }
    if (typeof x.achievementKey !== "string" || !x.achievementKey) continue
    if (typeof x.title !== "string" || !x.title) continue
    if (x.group !== "base" && x.group !== "events" && x.group !== "system") continue
    const statsKeyTitle =
      typeof x.statsKeyTitle === "string" && x.statsKeyTitle.trim()
        ? x.statsKeyTitle.trim()
        : x.title
    const tc = x.targetCount
    const targetCount =
      tc != null && typeof tc === "number" && Number.isFinite(tc) ? Math.floor(tc) : null
    out.push({
      achievementKey: x.achievementKey,
      statsKeyTitle,
      title: x.title,
      hint: typeof x.hint === "string" ? x.hint : "",
      defaultStatus: typeof x.defaultStatus === "string" ? x.defaultStatus : x.title.slice(0, 15),
      group: x.group,
      imageUrl: typeof x.imageUrl === "string" ? x.imageUrl : "",
      postTextTemplate: typeof x.postTextTemplate === "string" ? x.postTextTemplate : "",
      vkEnabled: x.vkEnabled === true,
      published: x.published === true,
      targetCount,
      isCustom: x.isCustom === true,
    })
  }
  return out
}

export function AdminRankingsEventsContent({ token }: AdminRankingsEventsContentProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newDraft, setNewDraft] = useState<RowDraft | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/achievement-posts?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(parseRows(data.rows).filter((r) => r.group === "events"))
    } catch {
      setError("Ошибка сети при загрузке")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const updateRow = (id: string, patch: Partial<RowDraft>) => {
    setRows((prev) => prev.map((x) => (x.achievementKey === id ? { ...x, ...patch } : x)))
  }

  const createRow = useCallback(async () => {
    if (!newDraft) return
    if (!newDraft.statsKeyTitle.trim()) {
      setError("Укажите ключ статистики — тот же текст, что и ключ прогресса в игре (см. achievementStats).")
      return
    }
    if (!newDraft.title.trim()) {
      setError("Укажите название в интерфейсе.")
      return
    }
    setBusyId("__new__")
    setError("")
    try {
      const res = await apiFetch("/api/admin/content/achievement-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          achievementKey: newDraft.achievementKey,
          statsKeyTitle: newDraft.statsKeyTitle,
          imageUrl: newDraft.imageUrl,
          postTextTemplate: newDraft.postTextTemplate,
          vkEnabled: newDraft.vkEnabled,
          published: newDraft.published,
          displayTitle: newDraft.title,
          hintCustom: newDraft.hint,
          defaultStatusCustom: newDraft.defaultStatus,
          targetCount: newDraft.targetCount,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось создать: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setNewDraft(null)
      setRows(parseRows(data.rows).filter((r) => r.group === "events"))
    } catch {
      setError("Ошибка сети при создании")
    } finally {
      setBusyId(null)
    }
  }, [newDraft, token])

  const uploadNewDraftImage = useCallback(
    async (file: File) => {
      if (!newDraft) return
      setBusyId(newDraft.achievementKey)
      setError("")
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("bucket", "achievement_post")
        const res = await apiFetch("/api/admin/content/upload-image", {
          method: "POST",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: form,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || typeof data.path !== "string") {
          setError(`Не удалось загрузить изображение: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        const nextPath = data.path.startsWith("/") ? data.path : `/${data.path}`
        setNewDraft((d) => (d ? { ...d, imageUrl: nextPath } : null))
      } catch {
        setError("Ошибка сети при загрузке изображения")
      } finally {
        setBusyId(null)
      }
    },
    [newDraft, token],
  )

  const saveRow = useCallback(
    async (row: RowDraft) => {
      setBusyId(row.achievementKey)
      setError("")
      try {
        const res = await apiFetch("/api/admin/content/achievement-posts", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify({
            achievementKey: row.achievementKey,
            imageUrl: row.imageUrl,
            postTextTemplate: row.postTextTemplate,
            vkEnabled: row.vkEnabled,
            published: row.published,
            displayTitle: row.title,
            hintCustom: row.hint,
            defaultStatusCustom: row.defaultStatus,
            targetCount: row.targetCount,
            statsKeyTitle: row.statsKeyTitle,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setError(`Не удалось сохранить ${row.title}: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRows(parseRows(data.rows).filter((r) => r.group === "events"))
      } catch {
        setError("Ошибка сети при сохранении")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const deleteRow = useCallback(
    async (row: RowDraft) => {
      setBusyId(row.achievementKey)
      setError("")
      try {
        const res = await apiFetch(`/api/admin/content/achievement-posts/${encodeURIComponent(row.achievementKey)}`, {
          method: "DELETE",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setError(`Не удалось удалить ${row.title}: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRows(parseRows(data.rows).filter((r) => r.group === "events"))
      } catch {
        setError("Ошибка сети при удалении")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const uploadImage = useCallback(
    async (achievementKey: string, file: File) => {
      setBusyId(achievementKey)
      setError("")
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("bucket", "achievement_post")
        const res = await apiFetch("/api/admin/content/upload-image", {
          method: "POST",
          headers: { "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: form,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || typeof data.path !== "string") {
          setError(`Не удалось загрузить изображение: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        const nextPath = data.path.startsWith("/") ? data.path : `/${data.path}`
        updateRow(achievementKey, { imageUrl: nextPath })
      } catch {
        setError("Ошибка сети при загрузке изображения")
      } finally {
        setBusyId(null)
      }
    },
    [token],
  )

  const publishedCount = useMemo(() => rows.filter((x) => x.published).length, [rows])

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Рейтинги и ивенты</h2>
          <p className="text-xs text-slate-400">
            Ивенты из кода + свои записи (<span className="font-mono text-slate-300">custom_*</span>). Ключ статистики должен
            совпадать с полем в <span className="font-mono">achievementStats</span> в игре. Всего: {rows.length} ·
            опубликовано шаблонов: {publishedCount}. Пост: {"{name}"}, {"{achievement}"}, {"{game_url}"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={newDraft != null}
            onClick={() => {
              setError("")
              setNewDraft(makeNewEventDraft())
            }}
            className="rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            Добавить ивент
          </button>
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {newDraft && (
        <article className="mb-4 rounded-xl border border-emerald-600/50 bg-slate-900/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-200">Новый ивент</p>
            <button
              type="button"
              onClick={() => {
                setNewDraft(null)
                setError("")
              }}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Отмена
            </button>
          </div>
          <p className="mb-2 font-mono text-[10px] text-slate-500">Ключ: {newDraft.achievementKey}</p>
          <label className="block text-[11px] text-slate-400">
            Ключ статистики в игре (обязательно)
            <input
              type="text"
              value={newDraft.statsKeyTitle}
              onChange={(e) => setNewDraft((d) => (d ? { ...d, statsKeyTitle: e.target.value } : null))}
              placeholder='например «Любитель кваса»'
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Название в интерфейсе
            <input
              type="text"
              value={newDraft.title}
              onChange={(e) => setNewDraft((d) => (d ? { ...d, title: e.target.value } : null))}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Описание / подсказка
            <textarea
              value={newDraft.hint}
              onChange={(e) => setNewDraft((d) => (d ? { ...d, hint: e.target.value } : null))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Текст статуса в профиле
            <input
              type="text"
              value={newDraft.defaultStatus}
              onChange={(e) => setNewDraft((d) => (d ? { ...d, defaultStatus: e.target.value } : null))}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Количество для статуса (подсказка)
            <input
              type="number"
              min={0}
              value={newDraft.targetCount ?? ""}
              onChange={(e) => {
                const v = e.target.value
                setNewDraft((d) =>
                  d
                    ? {
                        ...d,
                        targetCount: v === "" ? null : Math.max(0, Math.floor(Number(v)) || 0),
                      }
                    : null,
                )
              }}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Картинка
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={newDraft.imageUrl}
                onChange={(e) => setNewDraft((d) => (d ? { ...d, imageUrl: e.target.value } : null))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              />
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-500 bg-slate-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600">
                Файл
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  disabled={busyId === newDraft.achievementKey}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.currentTarget.value = ""
                    if (!file) return
                    void uploadNewDraftImage(file)
                  }}
                />
              </label>
            </div>
          </label>
          <label className="mt-2 block text-[11px] text-slate-400">
            Текст поста ВК
            <textarea
              value={newDraft.postTextTemplate}
              onChange={(e) => setNewDraft((d) => (d ? { ...d, postTextTemplate: e.target.value } : null))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                checked={newDraft.vkEnabled}
                onChange={(e) => setNewDraft((d) => (d ? { ...d, vkEnabled: e.target.checked } : null))}
              />
              Публикация в VK
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                checked={newDraft.published}
                onChange={(e) => setNewDraft((d) => (d ? { ...d, published: e.target.checked } : null))}
              />
              Публиковать шаблон
            </label>
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={busyId === "__new__"}
              onClick={() => void createRow()}
              className="rounded-lg border border-emerald-500/50 bg-emerald-600/25 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-600/35 disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </article>
      )}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-6 text-center text-sm text-slate-400">
          Загрузка…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.achievementKey} className="rounded-xl border border-violet-700/50 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[10px] text-slate-500">{row.achievementKey}</div>
                  {row.isCustom || row.achievementKey.startsWith("custom_") ? (
                    <label className="mt-1 block text-[11px] text-slate-400">
                      Ключ статистики в игре
                      <input
                        type="text"
                        value={row.statsKeyTitle}
                        onChange={(e) => updateRow(row.achievementKey, { statsKeyTitle: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-200"
                      />
                    </label>
                  ) : (
                    <div className="truncate font-mono text-[10px] text-slate-600">stats: {row.statsKeyTitle}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-200">
                    events
                  </span>
                  {row.isCustom && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                      свой
                    </span>
                  )}
                </div>
              </div>

              <label className="block text-[11px] text-slate-400">
                Название в интерфейсе
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => updateRow(row.achievementKey, { title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="mt-2 block text-[11px] text-slate-400">
                Описание / подсказка
                <textarea
                  value={row.hint}
                  onChange={(e) => updateRow(row.achievementKey, { hint: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="mt-2 block text-[11px] text-slate-400">
                Текст статуса в профиле (до ~15 симв.)
                <input
                  type="text"
                  value={row.defaultStatus}
                  onChange={(e) => updateRow(row.achievementKey, { defaultStatus: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="mt-2 block text-[11px] text-slate-400">
                Количество для статуса (цель прогресса, подсказка)
                <input
                  type="number"
                  min={0}
                  value={row.targetCount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value
                    updateRow(row.achievementKey, {
                      targetCount: v === "" ? null : Math.max(0, Math.floor(Number(v)) || 0),
                    })
                  }}
                  placeholder="например 100"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="mt-2 block text-[11px] text-slate-400">
                Картинка (URL или файл)
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={row.imageUrl}
                    onChange={(e) => updateRow(row.achievementKey, { imageUrl: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                    placeholder="/uploads/catalog/achievement_post/..."
                  />
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-500 bg-slate-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600">
                    Файл
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      disabled={busyId === row.achievementKey}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.currentTarget.value = ""
                        if (!file) return
                        void uploadImage(row.achievementKey, file)
                      }}
                    />
                  </label>
                </div>
              </label>

              {row.imageUrl ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60 p-1">
                  <img src={row.imageUrl} alt="" className="mx-auto h-28 max-w-full rounded object-contain" />
                </div>
              ) : null}

              <label className="mt-2 block text-[11px] text-slate-400">
                Текст поста ВК
                <textarea
                  value={row.postTextTemplate}
                  onChange={(e) => updateRow(row.achievementKey, { postTextTemplate: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                    checked={row.vkEnabled}
                    onChange={(e) => updateRow(row.achievementKey, { vkEnabled: e.target.checked })}
                  />
                  Публикация в VK
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                    checked={row.published}
                    onChange={(e) => updateRow(row.achievementKey, { published: e.target.checked })}
                  />
                  Публиковать шаблон
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.achievementKey}
                  onClick={() => void saveRow(row)}
                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Публикация
                </button>
                <button
                  type="button"
                  disabled={busyId === row.achievementKey}
                  onClick={() => void deleteRow(row)}
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
