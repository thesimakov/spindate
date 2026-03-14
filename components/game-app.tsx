"use client"

import { useState, useEffect } from "react"
import { useGame } from "@/lib/game-context"
import { initVk } from "@/lib/vk-bridge"
import { AppLoader } from "@/components/app-loader"
import { RegistrationScreen } from "@/components/registration-screen"
import { GameRoom } from "@/components/game-room"
import { ChatScreen } from "@/components/chat-screen"
import { FavoritesScreen } from "@/components/favorites-screen"
import { ShopScreen } from "@/components/shop-screen"
import { ProfileScreen } from "@/components/profile-screen"
import { UgadaikaScreen } from "@/components/ugadaika-screen"

/** Задержка после готовности стола, чтобы интерфейс успел стабилизироваться */
const NORMALIZE_DELAY_MS = 500

export function GameApp() {
  const { state } = useGame()
  const [normalized, setNormalized] = useState(false)

  const tableReady =
    state.screen === "game" &&
    state.currentUser != null &&
    (state.players?.length ?? 0) > 0

  useEffect(() => {
    initVk()
  }, [])

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
      return <GameRoom />
    case "chat":
      return <ChatScreen />
    case "favorites":
      return <FavoritesScreen />
    case "shop":
      return <ShopScreen />
    case "profile":
      return <ProfileScreen />
    case "ugadaika":
      return <UgadaikaScreen />
    default:
      return <RegistrationScreen />
  }
}
