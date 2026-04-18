"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { apiFetch } from "@/lib/api-fetch"
import { AdminBottleContent } from "@/components/admin-bottle-content"
import { AdminFrameContent } from "@/components/admin-frame-content"
import { AdminGiftContent } from "@/components/admin-gift-content"
import { AdminStatusLineContent } from "@/components/admin-status-line-content"
import { AdminTableStyleContent } from "@/components/admin-table-style-content"
import { AdminTickerAnnouncementsContent } from "@/components/admin-ticker-announcements-content"
import { AdminContentPagePlaceholder } from "@/components/admin-content-page-placeholder"
import { AdminAchievementPostsContent } from "@/components/admin-achievement-posts-content"
import { AdminRankingsEventsContent } from "@/components/admin-rankings-events-content"
import { AdminTablesContent } from "@/components/admin-tables-content"
import { AdminGameErrorsContent } from "@/components/admin-game-errors-content"
import { AdminLobbyAnnouncementContent } from "@/components/admin-lobby-announcement-content"
import { AdminMaintenanceContent } from "@/components/admin-maintenance-content"

function formatVkGroupCheckError(err: string | null | undefined): string {
  if (!err) return ""
  if (err === "rate_limit") return "лимит запросов VK — подождите и обновите страницу"
  if (err === "missing_service_token") return "нет VK_SERVICE_ACCESS_TOKEN на сервере"
  if (err === "vk_check_budget") return "проверка VK обрезана по времени — статус частичный"
  if (err === "vk_check_failed") return "ошибка проверки VK"
  if (err === "vk_group_members_access_denied") return "VK: нет доступа к списку участников сообщества (настройки группы/приложения)"
  return err
}

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
    isDbUser?: boolean
    username: string
    vkUserId?: number
    vkGroupMember?: boolean | null
    vkGroupBonusClaimed?: boolean
    vkGroupCheckError?: string | null
    displayName: string
    age?: number
    voiceBalance: number
    flags?: { blockedUntil: number | null; bannedUntil: number | null; deleted: boolean } | null
    live?: { tableId: number; updatedAt: number; playerId: number } | null
    stats?: { totalActions: number; counts: Record<string, number> } | null
  }>>([])
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"users" | "content" | "tables" | "errors">("users")
  const [tablesRefreshNonce, setTablesRefreshNonce] = useState(0)
  const [contentPage, setContentPage] = useState<
    | "bottles"
    | "gifts"
    | "frames"
    | "status"
    | "tickerAnnouncements"
    | "tableStyles"
    | "achievementPosts"
    | "rankingsEvents"
    | "lobbyAnnouncement"
    | "emotions"
    | "vip"
    | "hearts"
  >("bottles")

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

  const loadUsers = useCallback(async (includeVkMembership: boolean) => {
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (token) params.set("admin_token", token)
    if (includeVkMembership) params.set("includeVkMembership", "1")
    const query = params.toString()
    const url = query ? `/api/admin/users?${query}` : "/api/admin/users"
    const res = await apiFetch(url, {
      method: "GET",
      headers: { "X-Admin-Token": token },
      cache: "no-store",
      credentials: "include",
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !Array.isArray(data.users)) {
      throw new Error(`Сервер не отдал список пользователей: ${res.status} ${(data?.error as string) ?? ""}`.trim())
    }
    return data.users as Array<{
      userId: string
      isDbUser?: boolean
      username: string
      vkUserId?: number
      vkGroupMember?: boolean | null
      vkGroupBonusClaimed?: boolean
      vkGroupCheckError?: string | null
      displayName: string
      age?: number
      voiceBalance: number
      flags?: { blockedUntil: number | null; bannedUntil: number | null; deleted: boolean } | null
      live?: { tableId: number; updatedAt: number; playerId: number } | null
      stats?: { totalActions: number; counts: Record<string, number> } | null
    }>
  }, [])

  const refresh = useCallback(async () => {
    setServerError("")
    try {
      const fastUsers = await loadUsers(false)
      setUsers(fastUsers)
      void (async () => {
        try {
          const enrichedUsers = await loadUsers(true)
          setUsers(enrichedUsers)
        } catch {
          // Оставляем быстрый список, даже если VK-обогащение не удалось.
        }
      })()
    } catch {
      setServerError("Ошибка сети при запросе списка пользователей")
    }
  }, [loadUsers])

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
    setServerError("")
    const ok =
      typeof window === "undefined"
        ? true
        : action === "delete_forever"
          ? window.confirm(`Удалить НАВСЕГДА пользователя ${u.displayName ?? u.userId}?`)
          : true
    if (!ok) return
    try {
      setBusyUserId(u.userId)
      const res = await apiFetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": getAdminToken() },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          userId: u.userId,
          vkUserId: u.vkUserId,
          playerId: u.live?.playerId ?? null,
          action,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setServerError(
          `Действие не выполнено: ${res.status} ${(data?.error as string) ?? "unknown_error"}`.trim(),
        )
      }
    } catch {
      setServerError("Ошибка сети при выполнении действия модерации")
    } finally {
      setBusyUserId(null)
      await refresh()
    }
  }

  return (
    <div
      className="min-h-app overflow-y-auto p-4 pb-12"
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
              Серверная админка: пользователи и контент каталога. Доступ: /admin-lemnity
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
            {(activeTab === "users" || activeTab === "tables") && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "users") void refresh()
                  else setTablesRefreshNonce((n) => n + 1)
                }}
                className="rounded-lg border border-slate-500 bg-slate-700/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
              >
                Обновить
              </button>
            )}
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

        <AdminMaintenanceContent token={getAdminToken()} />

        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              activeTab === "users"
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-slate-500 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
            }`}
          >
            Пользователи
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("content")
              setContentPage((prev) => prev ?? "bottles")
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              activeTab === "content"
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-slate-500 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
            }`}
          >
            Контент
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tables")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              activeTab === "tables"
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-slate-500 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
            }`}
          >
            Столы
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("errors")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              activeTab === "errors"
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-slate-500 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
            }`}
          >
            Ошибки
          </button>
        </div>

        <div className="pr-1">
          {activeTab === "errors" ? (
            <AdminGameErrorsContent token={getAdminToken()} />
          ) : activeTab === "tables" ? (
            <AdminTablesContent token={getAdminToken()} refreshTrigger={tablesRefreshNonce} />
          ) : activeTab === "users" ? (
            <>
              <div className="max-h-[78dvh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-600 bg-slate-800/40">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-600 bg-slate-800/90 backdrop-blur">
                    <th className="px-3 py-3 font-semibold text-slate-300">ID</th>
                    <th className="px-3 py-3 font-semibold text-slate-300">Имя</th>
                    <th className="px-3 py-3 font-semibold text-slate-300">VK имя</th>
                    <th className="px-3 py-3 font-semibold text-slate-300">Подписка VK</th>
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
                      <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
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
                    const canModerate = u.isDbUser !== false
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
                        <td className="px-3 py-2.5 text-slate-300">
                          {!u.vkUserId ? (
                            "—"
                          ) : u.vkGroupMember === true ? (
                            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
                              подписан
                            </span>
                          ) : u.vkGroupMember === false ? (
                            <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs text-rose-200">
                              не подписан
                            </span>
                          ) : (
                            <span className="rounded bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300">
                              не проверено
                            </span>
                          )}
                          {u.vkGroupBonusClaimed ? (
                            <p className="mt-1 text-[10px] leading-tight text-amber-300/90">бонус выдан</p>
                          ) : null}
                          {u.vkGroupCheckError ? (
                            <p className="mt-1 text-[10px] leading-tight text-slate-400">
                              {formatVkGroupCheckError(u.vkGroupCheckError)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{u.age ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums">{u.voiceBalance}</td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {u.live ? (
                            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">#{u.live.tableId}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {u.stats ? (
                            <span className="text-xs tabular-nums text-slate-300">
                              {u.stats.totalActions} ·{" "}
                              <span className="text-slate-400">
                                care {(u.stats.counts["care"] ?? 0)}, gifts{" "}
                                {(u.stats.counts["rose"] ?? 0) +
                                  (u.stats.counts["flowers"] ?? 0) +
                                  (u.stats.counts["diamond"] ?? 0)}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => void doAdminAction(u, "send_vk_group_request")}
                              disabled={busyUserId === u.userId || !u.vkUserId}
                              className="rounded border border-sky-500/50 bg-sky-500/20 px-2 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/30 disabled:opacity-50"
                              title={!u.vkUserId ? "Доступно только VK-пользователям" : "Принудительно открыть окно подписки"}
                            >
                              Отправить запрос
                            </button>
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void doAdminAction(u, isBlocked ? "clear_block" : "block_1w")}
                                  disabled={busyUserId === u.userId || !canModerate}
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
                                  disabled={busyUserId === u.userId || !canModerate}
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
                              disabled={busyUserId === u.userId || isDeleted || !canModerate}
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
                закрыт на 24 часа. Удалить навсегда — сброс профиля и прогресса; вход снова возможен, игрок начинает с чистого
                профиля (блок и бан на это не распространяются). Логин отображается только для входа через логин/пароль; пароль
                на клиенте не хранится.
              </p>
            </>
          ) : (
            <div className="max-h-[78dvh] space-y-4 overflow-y-auto pb-8 pr-1">
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700/80 bg-slate-900/50 p-2">
                {(
                  [
                    { id: "bottles", label: "Бутылочки" },
                    { id: "gifts", label: "Подарки" },
                    { id: "frames", label: "Рамки" },
                    { id: "status", label: "Статус" },
                    { id: "tickerAnnouncements", label: "Объявления" },
                    { id: "tableStyles", label: "Стили стола" },
                    { id: "achievementPosts", label: "Посты достижений" },
                    { id: "rankingsEvents", label: "Рейтинги и ивенты" },
                    { id: "lobbyAnnouncement", label: "Новинка" },
                    { id: "emotions", label: "Эмоции" },
                    { id: "vip", label: "VIP" },
                    { id: "hearts", label: "Сердечки" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setContentPage(item.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold sm:text-sm ${
                      contentPage === item.id
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                        : "border-slate-600 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {contentPage === "bottles" && <AdminBottleContent token={getAdminToken()} />}
              {contentPage === "gifts" && <AdminGiftContent token={getAdminToken()} />}
              {contentPage === "frames" && <AdminFrameContent token={getAdminToken()} />}
              {contentPage === "status" && <AdminStatusLineContent token={getAdminToken()} />}
              {contentPage === "tickerAnnouncements" && <AdminTickerAnnouncementsContent token={getAdminToken()} />}
              {contentPage === "tableStyles" && <AdminTableStyleContent token={getAdminToken()} />}
              {contentPage === "achievementPosts" && <AdminAchievementPostsContent token={getAdminToken()} />}
              {contentPage === "rankingsEvents" && <AdminRankingsEventsContent token={getAdminToken()} />}
              {contentPage === "lobbyAnnouncement" && <AdminLobbyAnnouncementContent token={getAdminToken()} />}
              {contentPage === "emotions" && (
                <AdminContentPagePlaceholder
                  title="Контент: эмоции"
                  description="Отдельная страница под управление каталогом эмоций и их стоимостью."
                />
              )}
              {contentPage === "vip" && (
                <AdminContentPagePlaceholder
                  title="Контент: VIP"
                  description="Отдельная страница под тарифы VIP и условия активации."
                />
              )}
              {contentPage === "hearts" && (
                <AdminContentPagePlaceholder
                  title="Контент: сердечки"
                  description="Отдельная страница под пакеты пополнения сердец и цены в голосах."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
