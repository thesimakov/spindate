"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

type AdminLobbyAnnouncementContentProps = {
  token: string
}

type RowState = {
  title: string
  body: string
  buttonLabel: string
  imageUrl: string
  published: boolean
  deleted: boolean
  updatedAt: number
}

export function AdminLobbyAnnouncementContent({ token }: AdminLobbyAnnouncementContentProps) {
  const [row, setRow] = useState<RowState>({
    title: "",
    body: "",
    buttonLabel: "",
    imageUrl: "",
    published: false,
    deleted: false,
    updatedAt: 0,
  })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const fetchRow = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch(`/api/admin/content/lobby-announcement?admin_token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "X-Admin-Token": token },
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(`Не удалось загрузить новинку: ${res.status} ${(data?.error as string) ?? ""}`.trim())
        return
      }
      const next = data?.row
      if (!next || typeof next !== "object") {
        setRow({
          title: "",
          body: "",
          buttonLabel: "",
          imageUrl: "",
          published: false,
          deleted: false,
          updatedAt: 0,
        })
        return
      }
      setRow({
        title: typeof next.title === "string" ? next.title : "",
        body: typeof next.body === "string" ? next.body : "",
        buttonLabel: typeof next.buttonLabel === "string" ? next.buttonLabel : "",
        imageUrl: typeof next.imageUrl === "string" ? next.imageUrl : "",
        published: next.published === true,
        deleted: next.deleted === true,
        updatedAt: Number(next.updatedAt) || 0,
      })
    } catch {
      setError("Ошибка сети при загрузке новинки")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchRow()
  }, [fetchRow])

  const postUpdate = useCallback(
    async (payload: Partial<RowState>) => {
      setBusy(true)
      setError("")
      try {
        const res = await apiFetch("/api/admin/content/lobby-announcement", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": token },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify({
            title: payload.title ?? row.title,
            body: payload.body ?? row.body,
            buttonLabel: payload.buttonLabel ?? row.buttonLabel,
            imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : row.imageUrl,
            published: payload.published !== undefined ? payload.published : row.published,
            deleted: payload.deleted !== undefined ? payload.deleted : row.deleted,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !data?.row) {
          setError(`Не удалось сохранить: ${res.status} ${(data?.error as string) ?? ""}`.trim())
          return
        }
        const r = data.row as RowState
        setRow({
          title: typeof r.title === "string" ? r.title : "",
          body: typeof r.body === "string" ? r.body : "",
          buttonLabel: typeof r.buttonLabel === "string" ? r.buttonLabel : "",
          imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : "",
          published: r.published === true,
          deleted: r.deleted === true,
          updatedAt: Number(r.updatedAt) || Date.now(),
        })
      } catch {
        setError("Ошибка сети при сохранении")
      } finally {
        setBusy(false)
      }
    },
    [token, row.title, row.body, row.buttonLabel, row.imageUrl, row.published, row.deleted],
  )

  const uploadImage = useCallback(
    async (file: File) => {
      setBusy(true)
      setError("")
      try {
        const form = new FormData()
        form.set("file", file)
        form.set("bucket", "lobby-announcement")
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
        await postUpdate({ imageUrl: data.path })
      } catch {
        setError("Ошибка сети при загрузке картинки")
      } finally {
        setBusy(false)
      }
    },
    [token, postUpdate],
  )

  const removeImage = useCallback(async () => {
    await postUpdate({ imageUrl: "" })
  }, [postUpdate])

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-amber-200">Контент: новинка</h2>
          <p className="text-xs text-slate-400">
            Окно перед выбором стола в лобби. Нужны заголовок, текст и подпись кнопки; картинка по желанию.
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
            Заголовок
            <input
              type="text"
              value={row.title}
              onChange={(e) => setRow((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              placeholder="Например: Новая коллекция столов"
            />
          </label>
          <label className="block text-[11px] text-slate-400">
            Текст
            <textarea
              value={row.body}
              onChange={(e) => setRow((prev) => ({ ...prev, body: e.target.value }))}
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              placeholder="Описание для игроков"
            />
          </label>
          <label className="block text-[11px] text-slate-400">
            Подпись кнопки
            <input
              type="text"
              value={row.buttonLabel}
              onChange={(e) => setRow((prev) => ({ ...prev, buttonLabel: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              placeholder="Понятно"
            />
          </label>

          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
            <p className="mb-2 text-[11px] font-medium text-slate-400">Картинка</p>
            {row.imageUrl ? (
              <div className="mb-2 flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.imageUrl}
                  alt=""
                  className="max-h-32 max-w-full rounded-lg border border-slate-600 object-contain"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeImage()}
                  className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-2 text-xs font-medium text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:opacity-50"
                >
                  Удалить картинку
                </button>
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void uploadImage(f)
                }}
              />
              Прикрепить изображение
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void postUpdate({
                  title: row.title,
                  body: row.body,
                  buttonLabel: row.buttonLabel,
                  imageUrl: row.imageUrl,
                  deleted: false,
                  published: false,
                })
              }
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void postUpdate({
                  title: row.title,
                  body: row.body,
                  buttonLabel: row.buttonLabel,
                  imageUrl: row.imageUrl,
                  deleted: false,
                  published: true,
                })
              }
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
              onClick={() =>
                void postUpdate({
                  title: "",
                  body: "",
                  buttonLabel: "",
                  imageUrl: "",
                  published: false,
                  deleted: true,
                })
              }
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
            {row.updatedAt ? (
              <span className="ml-2 text-slate-500">
                · обновлено {new Date(row.updatedAt).toLocaleString("ru-RU")}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
