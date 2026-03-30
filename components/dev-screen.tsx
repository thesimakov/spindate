"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

const ADMIN_SESSION_KEY = "admin_lemnity_ok"
const ADMIN_TOKEN_KEY = "admin_lemnity_token"
const ADMIN_LOGIN = "admin"
const ADMIN_PASSWORD = "date_admin_2026_super_secret_1"

function getAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
}

export function DevScreen() {
  const [authenticated, setAuthenticated] = useState(false)
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [serverError, setServerError] = useState("")
  const [users, setUsers] = useState<Array<{
    userId: string
    username: string
    vkUserId?: number
    displayName: string
    age?: number
    voiceBalance: number
    flags?: { blockedUntil: number | null; bannedUntil: number | null; deleted: boolean } | null
    live?: { tableId: number; updatedAt: number; playerId: number } | null
    stats?: { totalActions: number; counts: Record<string, number> } | null
  }>>([])
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  useEffect(() => {
    setAuthenticated(getAdminAuthenticated())
  }, [])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1")
        window.sessionStorage.setItem(ADMIN_TOKEN_KEY, password)
      }
      setAuthenticated(true)
      setPassword("")
    } else {
      setAuthError("Неверный логин или пароль")
    }
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
      window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    }
    setAuthenticated(false)
    setLogin("")
    setPassword("")
    setAuthError("")
  }

  const getAdminToken = () => (typeof window !== "undefined" ? window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "" : "")

  const refresh = useCallback(async () => {
    setServerError("")
    try {
      const token = getAdminToken()
      const url = token ? `/api/admin/users?admin_token=${encodeURIComponent(token)}` : "/api/admin/users"
      const res = await fetch(url, {
        method: "GET",
        // иногда прокси режут кастомные headers — дублируем токен в query
        headers: { "X-Admin-Token": token },
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data.users)) {
        setServerError(
          `Сервер не отдал список пользователей: ${res.status} ${(data?.error as string) ?? ""}`.trim(),
        )
        return
      }
      setUsers(data.users)
    } catch {
      setServerError("Ошибка сети при запросе списка пользователей")
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      refresh()
    }
  }, [authenticated, refresh])

  if (!authenticated) {
    return (
      <div
        className="flex min-h-app flex-col items-center justify-center p-6"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "#e2e8f0",
        }}
      >
        <div
          className="w-full max-w-xs rounded-2xl border border-slate-600 bg-slate-800/60 p-6 shadow-xl"
          style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
        >
          <h1 className="mb-4 text-center text-lg font-bold text-amber-400">admin-lemnity</h1>
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Логин</label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full rounded-lg border border-slate-500 bg-slate-900/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Логин"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-500 bg-slate-900/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Пароль"
                autoComplete="current-password"
              />
            </div>
            {authError && <p className="text-sm text-red-400">{authError}</p>}
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white transition hover:bg-amber-500"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    )
  }

  const doAdminAction = async (
    u: {
      userId: string
      vkUserId?: number
      displayName: string
      live?: { playerId: number } | null
    },
    action: string,
  ) => {
    if (busyUserId != null) return
    const ok =
      typeof window === "undefined"
        ? true
        : action === "delete_forever"
          ? window.confirm(`Удалить НАВСЕГДА пользователя ${u.displayName ?? u.userId}?`)
          : true
    if (!ok) return
    try {
      setBusyUserId(u.userId)
      await fetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": getAdminToken() },
        cache: "no-store",
        body: JSON.stringify({
          userId: u.userId,
          vkUserId: u.vkUserId,
          playerId: u.live?.playerId ?? null,
          action,
        }),
      })
    } catch {
      // ignore
    } finally {
      setBusyUserId(null)
      await refresh()
    }
  }

  return (
    <div
      className="min-h-app overflow-auto p-4 pb-12"
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "#e2e8f0",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-600 pb-4">
          <div>
            <h1 className="text-xl font-bold text-amber-400">Панель разработчика</h1>
            <p className="mt-1 text-sm text-slate-400">
              Серверная админка: блок/бан/удаление + live-столы. Доступ: /admin-lemnity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Выйти
            </button>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Обновить
            </button>
            <Link
              href="/#"
              className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              В игру
            </Link>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {serverError}
          </div>
        )}

        <div className="max-h-[78dvh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-600 bg-slate-800/40">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-600 bg-slate-800/90 backdrop-blur">
                <th className="px-3 py-3 font-semibold text-slate-300">ID</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Имя</th>
                <th className="px-3 py-3 font-semibold text-slate-300">VK имя</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Возраст</th>
                <th className="px-3 py-3 font-semibold text-slate-300">❤</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Live</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Статистика</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                    Пока ни один пользователь не заходил. Регистрации появятся здесь после входа.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const now = Date.now()
                const blockedUntil = u.flags?.blockedUntil ?? null
                const bannedUntil = u.flags?.bannedUntil ?? null
                const isBlocked = blockedUntil != null && blockedUntil > now
                const isBanned = bannedUntil != null && bannedUntil > now
                const isDeleted = u.flags?.deleted === true
                return (
                  <tr key={u.userId} className="border-b border-slate-700/80 hover:bg-slate-700/30">
                    <td className="px-3 py-2.5 font-mono text-slate-400">{u.vkUserId ?? u.userId.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-100">{u.displayName}</td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {u.vkUserId ? (
                        <a
                          href={`https://vk.com/id${u.vkUserId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300/90 hover:text-sky-200 underline underline-offset-2"
                          title="Открыть профиль VK"
                        >
                          {u.displayName}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{u.age ?? "—"}</td>
                    <td className="px-3 py-2.5 text-slate-300 tabular-nums">{u.voiceBalance}</td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {u.live ? <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">#{u.live.tableId}</span> : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {u.stats ? (
                        <span className="text-xs tabular-nums text-slate-300">
                          {u.stats.totalActions} ·{" "}
                          <span className="text-slate-400">
                            care {(u.stats.counts["care"] ?? 0)}, gifts {(u.stats.counts["rose"] ?? 0) + (u.stats.counts["flowers"] ?? 0) + (u.stats.counts["diamond"] ?? 0)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {!isDeleted && (
                          <>
                            <button
                              type="button"
                              onClick={() => void doAdminAction(u, isBlocked ? "clear_block" : "block_1w")}
                              disabled={busyUserId === u.userId}
                              className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                                isBlocked
                                  ? "border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                                  : "border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/30"
                              }`}
                            >
                              {isBlocked ? "Разблок (1н)" : "Блок (1н)"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void doAdminAction(u, isBanned ? "clear_ban" : "ban_2h")}
                              disabled={busyUserId === u.userId}
                              className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                                isBanned
                                  ? "border-slate-500 bg-slate-600/50 text-slate-300 hover:bg-slate-500/50"
                                  : "border-orange-500/50 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30"
                              }`}
                            >
                              {isBanned ? "Снять бан" : "Бан 2ч"}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void doAdminAction(u, "delete_forever")}
                          disabled={busyUserId === u.userId || isDeleted}
                          className="rounded border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-1 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/25 disabled:opacity-50"
                          title="Удалить навсегда + выкинуть из live"
                        >
                          {isDeleted ? "Удалён" : busyUserId === u.userId ? "Удаляю…" : "Удалить навсегда"}
                        </button>
                      </div>
                      {isBlocked && blockedUntil && (
                        <p className="mt-1 text-xs text-red-400/90">
                          Блок до {new Date(blockedUntil).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                      {isBanned && bannedUntil && (
                        <p className="mt-1 text-xs text-orange-400/90">
                          Бан до {new Date(bannedUntil).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Заблокировать — игрок удаляется из игры, при попытке входа видит сообщение. Забанить на сутки — доступ
          закрыт на 24 часа. Логин отображается только для входа через логин/пароль; пароль на клиенте не хранится.
        </p>
      </div>
    </div>
  )
}
