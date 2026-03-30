"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  getDevRegistryUsers,
  getBlockedUserIds,
  getBannedList,
  blockUser,
  unblockUser,
  banUser24h,
  unbanUser,
  type DevUserEntry,
} from "@/lib/dev-registry"

const ADMIN_SESSION_KEY = "admin_lemnity_ok"
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
  const [users, setUsers] = useState<DevUserEntry[]>([])
  const [blockedIds, setBlockedIds] = useState<number[]>([])
  const [bannedList, setBannedList] = useState<{ userId: number; until: number }[]>([])
  const [kickBusyId, setKickBusyId] = useState<number | null>(null)

  useEffect(() => {
    setAuthenticated(getAdminAuthenticated())
  }, [])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      if (typeof window !== "undefined") window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1")
      setAuthenticated(true)
      setPassword("")
    } else {
      setAuthError("Неверный логин или пароль")
    }
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setAuthenticated(false)
    setLogin("")
    setPassword("")
    setAuthError("")
  }

  const refresh = useCallback(() => {
    setUsers(getDevRegistryUsers())
    setBlockedIds(getBlockedUserIds())
    setBannedList(getBannedList())
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

  const now = Date.now()
  const bannedMap = new Map(bannedList.filter((b) => b.until > now).map((b) => [b.userId, b.until]))

  const handleBlock = (id: number) => {
    blockUser(id)
    refresh()
  }

  const handleUnblock = (id: number) => {
    unblockUser(id)
    refresh()
  }

  const handleBan24h = (id: number) => {
    banUser24h(id)
    refresh()
  }

  const handleUnban = (id: number) => {
    unbanUser(id)
    refresh()
  }

  const handleKickFromGame = async (id: number) => {
    if (kickBusyId != null) return
    const ok = typeof window !== "undefined" && window.confirm(`Удалить игрока ${id} из игры (выкинуть со стола)?`)
    if (!ok) return
    try {
      setKickBusyId(id)
      await fetch("/api/table/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "leave", userId: id }),
        // чтобы работало при закрытии/прокси и не упиралось в cache
        cache: "no-store",
        credentials: "include",
      })
    } catch {
      // ignore
    } finally {
      setKickBusyId(null)
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
              Список игроков, блокировка и бан на сутки. Доступ: /admin-lemnity
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

        <div className="overflow-x-auto rounded-xl border border-slate-600 bg-slate-800/40">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-800/80">
                <th className="px-3 py-3 font-semibold text-slate-300">ID</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Имя</th>
                <th className="px-3 py-3 font-semibold text-slate-300">VK имя</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Возраст</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Город</th>
                <th className="px-3 py-3 font-semibold text-slate-300">На чём играют</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Вход</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Логин / пароль</th>
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
                const blocked = blockedIds.includes(u.id)
                const banUntil = bannedMap.get(u.id)
                return (
                  <tr key={u.id} className="border-b border-slate-700/80 hover:bg-slate-700/30">
                    <td className="px-3 py-2.5 font-mono text-slate-400">{u.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-100">{u.name}</td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {u.authProvider === "vk" ? (
                        <a
                          href={`https://vk.com/id${u.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300/90 hover:text-sky-200 underline underline-offset-2"
                          title="Открыть профиль VK"
                        >
                          {u.vkName ?? u.name}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{u.age}</td>
                    <td className="px-3 py-2.5 text-slate-300">{u.city ?? "—"}</td>
                    <td className="px-3 py-2.5 text-slate-300">{u.platform}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-slate-600/80 px-2 py-0.5 text-xs">
                        {u.authProvider === "login" ? "логин" : u.authProvider === "vk" ? "VK" : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {u.authProvider === "login" ? (
                        <span>
                          <span className="font-mono text-amber-300/90">{u.login ?? "—"}</span>
                          <span className="ml-1 text-xs text-slate-500">/ {u.passwordNote}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {blocked ? (
                          <button
                            type="button"
                            onClick={() => handleUnblock(u.id)}
                            className="rounded border border-amber-500/50 bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/30"
                          >
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBlock(u.id)}
                            className="rounded border border-red-500/50 bg-red-500/20 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30"
                          >
                            Заблокировать
                          </button>
                        )}
                        {banUntil ? (
                          <button
                            type="button"
                            onClick={() => handleUnban(u.id)}
                            className="rounded border border-slate-500 bg-slate-600/50 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-500/50"
                          >
                            Снять бан
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBan24h(u.id)}
                            className="rounded border border-orange-500/50 bg-orange-500/20 px-2 py-1 text-xs font-medium text-orange-200 hover:bg-orange-500/30"
                          >
                            Забанить на сутки
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleKickFromGame(u.id)}
                          disabled={kickBusyId === u.id}
                          className="rounded border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-1 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/25 disabled:opacity-50"
                          title="Выкинуть игрока из live-стола (как закрытие вкладки)"
                        >
                          {kickBusyId === u.id ? "Удаляю…" : "Удалить"}
                        </button>
                      </div>
                      {blocked && (
                        <p className="mt-1 text-xs text-red-400/90">Заблокирован — при входе видит сообщение</p>
                      )}
                      {banUntil && (
                        <p className="mt-1 text-xs text-orange-400/90">
                          Бан до {new Date(banUntil).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
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
