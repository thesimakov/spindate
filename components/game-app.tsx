"use client"

import { useState, useEffect } from "react"
import { useGame } from "@/lib/game-context"
import { initVkResilient, isVkMiniApp, resizeVkWindowToViewport, subscribeVkViewportResize } from "@/lib/vk-bridge"
import { getLayoutConstraintDebug } from "@/lib/use-media-query"
import { isUserBlocked, isUserBanned } from "@/lib/dev-registry"
import { AppLoader } from "@/components/app-loader"
import { RegistrationScreen } from "@/components/registration-screen"
import { GameRoom } from "@/components/game-room"
import { ChatScreen } from "@/components/chat-screen"
import { FavoritesScreen } from "@/components/favorites-screen"
import { ShopScreen } from "@/components/shop-screen"
import { ProfileScreen } from "@/components/profile-screen"
import { UgadaikaScreen } from "@/components/ugadaika-screen"
import { IntergameChatScreen } from "@/components/intergame-chat-screen"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { RatingLeaderboardBody } from "@/components/rating-screen"

/** Задержка после готовности стола, чтобы интерфейс успел стабилизироваться */
const NORMALIZE_DELAY_MS = 500

export function GameApp() {
  const { state, dispatch } = useGame()
  const [normalized, setNormalized] = useState(false)
  const [blockStatus, setBlockStatus] = useState<"blocked" | { until: number } | null>(null)

  const tableReady =
    state.screen === "game" &&
    state.currentUser != null &&
    (state.players?.length ?? 0) > 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await initVkResilient()
      if (cancelled) return
      if (isVkMiniApp()) {
        await resizeVkWindowToViewport()
      }
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
    if (state.screen !== "game" || !state.currentUser) {
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
    if (state.screen !== "game") {
      setNormalized(false)
      return
    }
    if (!tableReady) return
    const t = setTimeout(() => setNormalized(true), NORMALIZE_DELAY_MS)
    return () => clearTimeout(t)
  }, [state.screen, tableReady])

  const showEntryLoader = state.screen === "game" && (!tableReady || !normalized)

  if (state.screen === "game" && state.currentUser && blockStatus) {
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
    case "game":
      return (
        <>
          <GameRoom />
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
          {state.gameSidePanel === "rating" && (
            <GameSidePanelShell
              title="Рейтинг"
              subtitle="За последние 7 дней"
              onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
            >
              <RatingLeaderboardBody />
            </GameSidePanelShell>
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
