"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminAchievementPostsContentProps = { token: string }

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
    })
  }
  return out
}

export function AdminAchievementPostsContent({ token }: AdminAchievementPostsContentProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

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
        setError(`Не удалось загрузить шаблоны: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      setRows(parseRows(data.rows).filter((r) => r.group !== "events"))
    } catch {
      setError("Ошибка сети при загрузке шаблонов постов")
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
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          setError(`Не удалось сохранить ${row.title}: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        setRows(parseRows(data.rows).filter((r) => r.group !== "events"))
      } catch {
        setError("Ошибка сети при сохранении шаблона")
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
        setRows(parseRows(data.rows).filter((r) => r.group !== "events"))
      } catch {
        setError("Ошибка сети при удалении шаблона")
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
          <h2 className="text-lg font-semibold text-amber-200">Посты: базовые достижения и стол</h2>
          <p className="text-xs text-slate-400">
            Без блока «Рейтинги и ивенты» — тот список вынесен на отдельную вкладку. Здесь: {rows.length} шт. ·
            опубликовано: {publishedCount}. Плейсхолдеры: {"{name}"}, {"{achievement}"}, {"{game_url}"}. Пост «созданный
            стол»: {"{name}"}, {"{table_name}"}, {"{game_url}"}.
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
          Загрузка шаблонов...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.achievementKey} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-slate-400">{row.achievementKey}</div>
                  <div className="truncate text-sm font-semibold text-slate-100">{row.title}</div>
                  <div className="text-xs text-slate-500">{row.hint}</div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    row.group === "base"
                      ? "bg-cyan-500/20 text-cyan-200"
                      : row.group === "events"
                        ? "bg-violet-500/20 text-violet-200"
                        : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  {row.group}
                </span>
              </div>

              <label className="block text-[11px] text-slate-400">
                Картинка (URL)
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
                  <img src={row.imageUrl} alt={row.title} className="h-24 w-full rounded object-cover" />
                </div>
              ) : null}

              <label className="mt-2 block text-[11px] text-slate-400">
                Текст поста
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
