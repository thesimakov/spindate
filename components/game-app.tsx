"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useGame } from "@/lib/game-context"
import { initVkResilient, isVkMiniApp, subscribeVkViewportResize } from "@/lib/vk-bridge"
import { getLayoutConstraintDebug, useGameLayoutMode } from "@/lib/use-media-query"
import { isUserBlocked, isUserBanned } from "@/lib/dev-registry"
import { usePmNotifications, markChatRead } from "@/lib/use-pm-notifications"
import { mergePeersForUnreadPoll } from "@/lib/merge-peers-for-pm"
import { AppLoader } from "@/components/app-loader"
import { RegistrationScreen } from "@/components/registration-screen"
import { RoomLobbyScreen } from "@/components/room-lobby-screen"
import { DailyStreakGateScreen } from "@/components/daily-streak-gate-screen"
import { UiTourScreen } from "@/components/ui-tour-screen"
import { GameRoom } from "@/components/game-room"
import { ChatScreen } from "@/components/chat-screen"
import { FavoritesScreen } from "@/components/favorites-screen"
import { ShopScreen } from "@/components/shop-screen"
import { ProfileScreen } from "@/components/profile-screen"
import { UgadaikaScreen } from "@/components/ugadaika-screen"
import { IntergameChatScreen } from "@/components/intergame-chat-screen"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { PlayerChatPanel } from "@/components/player-chat-panel"
import { PmNotificationToasts } from "@/components/pm-notification-toast"
import { RatingLeaderboardBody } from "@/components/rating-screen"
import { ZeroBalanceDialog } from "@/components/zero-balance-dialog"
import { PrivateInboxPanel } from "@/components/private-inbox-panel"
import { MobileAppBlockedScreen } from "@/components/mobile-app-blocked-screen"
import { useVkMiniAppPersistentHorizontalBanner } from "@/hooks/use-vk-overlay-banner"
import { reportGameClientError } from "@/lib/report-game-client-error"

const AUTO_ERROR_THROTTLE_MS = 25_000

export function GameApp() {
  /** Один раз на всё приложение в VK: лобби/регистрация/магазин не монтируют GameRoom — баннер только так показывается «везде». */
  useVkMiniAppPersistentHorizontalBanner()

  const { state, dispatch } = useGame()
  const { isDesktopUser, deviceClassResolved } = useGameLayoutMode()

  const gameCtxRef = useRef({
    tableId: state.tableId,
    screen: state.screen,
    currentUserId: state.currentUser?.id as number | undefined,
  })
  gameCtxRef.current.tableId = state.tableId
  gameCtxRef.current.screen = state.screen
  gameCtxRef.current.currentUserId = state.currentUser?.id

  const lastAutoClientErrorAt = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return

    const buildPayload = (extra: Record<string, unknown>) => ({
      t: new Date().toISOString(),
      href: window.location.href,
      ua: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      tableId: gameCtxRef.current.tableId,
      screen: gameCtxRef.current.screen,
      currentUserId: gameCtxRef.current.currentUserId,
      ...extra,
    })

    const maybeReport = (source: "window_error" | "unhandledrejection", message: string, stack: string | null) => {
      const now = Date.now()
      if (now - lastAutoClientErrorAt.current < AUTO_ERROR_THROTTLE_MS) return
      lastAutoClientErrorAt.current = now
      void reportGameClientError({
        source,
        message: message.slice(0, 2000),
        stack: stack ? stack.slice(0, 12000) : null,
        payload: buildPayload({ auto: true }),
      })
    }

    const onWindowError = (ev: ErrorEvent) => {
      const msg = ev.message || "script error"
      const stack =
        ev.error && typeof ev.error === "object" && "stack" in ev.error
          ? String((ev.error as Error).stack)
          : `${ev.filename ?? "?"}:${ev.lineno}:${ev.colno}`
      maybeReport("window_error", msg, stack)
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason
      let msg: string
      let stack: string | null = null
      if (r instanceof Error) {
        msg = r.message || "Unhandled rejection"
        stack = r.stack ?? null
      } else if (typeof r === "string") {
        msg = r
      } else {
        try {
          msg = JSON.stringify(r)
        } catch {
          msg = String(r)
        }
      }
      maybeReport("unhandledrejection", msg, stack)
    }

    window.addEventListener("error", onWindowError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onWindowError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  const [blockStatus, setBlockStatus] = useState<"blocked" | { until: number } | null>(null)
  const [layoutDebugEnabled, setLayoutDebugEnabled] = useState(false)
  const [layoutDebugSnapshot, setLayoutDebugSnapshot] = useState<Record<string, string | number | boolean | null> | null>(null)

  const pmPeers = useMemo(
    () => mergePeersForUnreadPoll(state.favorites ?? [], state.admirers ?? []),
    [state.favorites, state.admirers],
  )

  const { notifications, totalUnread: pmUnreadCount, dismiss } = usePmNotifications(state.currentUser?.id, pmPeers)

  const handleOpenPmFromNotification = useCallback(
    (peerId: number) => {
      const peer =
        pmPeers.find((p) => p.id === peerId) ?? state.players.find((p) => p.id === peerId)
      if (!peer) return
      if (state.currentUser) markChatRead(state.currentUser.id, peerId)
      dismiss(peerId)
      dispatch({ type: "OPEN_SIDE_CHAT", player: peer })
    },
    [pmPeers, state.players, state.currentUser, dispatch, dismiss],
  )

  const tableReady =
    state.screen === "game" &&
    state.currentUser != null &&
    (state.players?.length ?? 0) > 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await initVkResilient()
      if (cancelled) return
    })()
    const unsub = isVkMiniApp() ? subscribeVkViewportResize() : () => {}
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  /** В консоли DevTools: `window.spindateLayoutDebug()` — что сдерживает ширину / «планшет». */
  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as unknown as { spindateLayoutDebug?: typeof getLayoutConstraintDebug }
    w.spindateLayoutDebug = getLayoutConstraintDebug
    return () => {
      delete w.spindateLayoutDebug
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const readFlag = () => {
      const fromSearch = /(^|[?&])layout_debug=1(&|$)/.test(window.location.search)
      const hash = window.location.hash
      const fromHash =
        /([#?&])layout_debug=1(&|$)/.test(hash) ||
        /([#?&])layout_debug=1(&|$)/.test(hash.includes("?") ? hash.slice(hash.indexOf("?")) : "")
      const fromStorage = window.localStorage.getItem("spindate_layout_debug") === "1"
      return fromSearch || fromHash || fromStorage
    }
    const enabled = readFlag()
    setLayoutDebugEnabled(enabled)
  }, [])

  useEffect(() => {
    if (!layoutDebugEnabled || typeof window === "undefined") return
    const update = () => setLayoutDebugSnapshot(getLayoutConstraintDebug())
    update()

    const onResize = () => update()
    window.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("scroll", onResize)
    const intervalId = window.setInterval(update, 1000)

    return () => {
      window.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("scroll", onResize)
      window.clearInterval(intervalId)
    }
  }, [layoutDebugEnabled])

  const handleHideLayoutDebug = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("spindate_layout_debug")
    }
    setLayoutDebugEnabled(false)
  }, [])

  useEffect(() => {
    if (
      (state.screen !== "game" &&
        state.screen !== "lobby" &&
        state.screen !== "daily-streak" &&
        state.screen !== "ui-tour") ||
      !state.currentUser
    ) {
      setBlockStatus(null)
      return
    }
    const id = state.currentUser.id
    if (isUserBlocked(id)) {
      setBlockStatus("blocked")
      return
    }
    const ban = isUserBanned(id)
    if (ban.banned && ban.until) {
      setBlockStatus({ until: ban.until })
      return
    }
    setBlockStatus(null)
  }, [state.screen, state.currentUser?.id])

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const enabled = state.tableStyle === "light_day"
    root.classList.toggle("theme-light-day", enabled)
    return () => {
      root.classList.remove("theme-light-day")
    }
  }, [state.tableStyle])

  // Лоадер с цитатой находится внутри GameRoom (tableLoading), поэтому
  // общий AppLoader показываем только до появления пользователя.
  const showEntryLoader = state.screen === "game" && !state.currentUser
  const showLayoutDebugOverlay = layoutDebugEnabled && !!layoutDebugSnapshot

  const mobileAppBlocked = process.env.NEXT_PUBLIC_MOBILE_APP_BLOCKED !== "0"
  if (mobileAppBlocked && !layoutDebugEnabled) {
    if (!deviceClassResolved) {
      return (
        <AppLoader
          title="Загрузка…"
          subtitle='Игра «Крути и знакомься: Бутылочка» собирает для тебя стол судьбы'
          hint="Определяем тип устройства"
        />
      )
    }
    if (!isDesktopUser) {
      return <MobileAppBlockedScreen />
    }
  }

  if (
    (state.screen === "game" || state.screen === "ui-tour") &&
    state.currentUser &&
    blockStatus
  ) {
    const isBlocked = blockStatus === "blocked"
    const until = !isBlocked && typeof blockStatus === "object" ? blockStatus.until : null
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          color: "#e2e8f0",
        }}
      >
        <p className="text-center text-lg font-semibold">
          {isBlocked
            ? "Вы заблокированы. Обратитесь в поддержку."
            : until
              ? `Вы забанены до ${new Date(until).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}. Обратитесь в поддержку.`
              : "Доступ ограничен."}
        </p>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "CLEAR_USER" })
            dispatch({ type: "SET_SCREEN", screen: "registration" })
          }}
          className="rounded-xl border border-slate-500 bg-slate-700/80 px-6 py-3 font-medium text-slate-100 transition hover:bg-slate-600"
        >
          На страницу входа
        </button>
      </div>
    )
  }

  if (showEntryLoader) {
    return (
      <AppLoader
        title={tableReady ? "Почти готово..." : "Подготовка стола..."}
        subtitle="Собираем игроков и настраиваем игру"
        hint="Крути и знакомься"
      />
    )
  }

  switch (state.screen) {
    case "registration":
      return <RegistrationScreen />
    case "daily-streak":
      return <DailyStreakGateScreen />
    case "ui-tour":
      return <UiTourScreen />
    case "lobby":
      return <RoomLobbyScreen />
    case "game":
      return (
        <>
          <GameRoom pmUnreadCount={pmUnreadCount} />
          <ZeroBalanceDialog />
          {showLayoutDebugOverlay && layoutDebugSnapshot && (
            <div className="fixed bottom-2 left-2 z-[110] w-[min(92vw,26rem)] rounded-xl border border-cyan-300/50 bg-slate-950/90 p-2 font-mono text-[11px] leading-tight text-cyan-100 shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold text-cyan-200">Layout debug</span>
                <button
                  type="button"
                  onClick={handleHideLayoutDebug}
                  className="rounded border border-cyan-300/40 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-300/10"
                >
                  скрыть
                </button>
              </div>
              <div>{`innerWidth: ${layoutDebugSnapshot.innerWidth ?? "-"}`}</div>
              <div>{`visualViewport: ${layoutDebugSnapshot.visualViewportWidth ?? "-"}`}</div>
              <div>{`screen: ${layoutDebugSnapshot.screenWidth ?? "-"}`}</div>
              <div>{`inIframe: ${String(layoutDebugSnapshot.inIframe ?? "-")}`}</div>
              <div>{`vk_platform: ${String(layoutDebugSnapshot.vk_platform ?? "-")}`}</div>
              <div>{`desktopUser: ${String(layoutDebugSnapshot.computeIsDesktopUser ?? "-")}`}</div>
              <div className="mt-1 text-[10px] text-cyan-300/90">?layout_debug=1 или localStorage spindate_layout_debug=1</div>
            </div>
          )}
          {state.gameSidePanel !== "player-chat" && (
            <PmNotificationToasts
              notifications={notifications}
              onOpen={handleOpenPmFromNotification}
              onDismiss={dismiss}
            />
          )}
          {state.gameSidePanel === "profile" && (
            <ProfileScreen
              variant="panel"
              onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
            />
          )}
          {state.gameSidePanel === "shop" && (
            <ShopScreen
              variant="panel"
              onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
            />
          )}
          {state.gameSidePanel === "favorites" && (
            <FavoritesScreen
              variant="panel"
              onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
            />
          )}
          {state.gameSidePanel === "private-inbox" && (
            <PrivateInboxPanel onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })} />
          )}
          {state.gameSidePanel === "rating" && (
            <GameSidePanelShell
              title="Рейтинг"
              subtitle="Все столы · периоды по МСК"
              onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
            >
              <RatingLeaderboardBody />
            </GameSidePanelShell>
          )}
          {state.gameSidePanel === "player-chat" && state.chatPanelPlayer && (
            <PlayerChatPanel
              player={state.chatPanelPlayer}
              onClose={() => {
                if (state.currentUser && state.chatPanelPlayer) {
                  markChatRead(state.currentUser.id, state.chatPanelPlayer.id)
                  dismiss(state.chatPanelPlayer.id)
                }
                dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })
              }}
              onOpenProfile={() => {
                dispatch({ type: "OPEN_PLAYER_MENU", player: state.chatPanelPlayer! })
                dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })
              }}
            />
          )}
        </>
      )
    case "chat":
      return <ChatScreen />
    case "favorites":
      return <FavoritesScreen />
    case "shop":
      return <ShopScreen />
    case "ugadaika":
      return <UgadaikaScreen />
    case "intergame-chat":
      return <IntergameChatScreen />
    default:
      return <RegistrationScreen />
  }
}
