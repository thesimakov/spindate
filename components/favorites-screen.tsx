"use client"

import { ArrowLeft, Heart, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"

type FavoritesScreenProps = {
  variant?: "page" | "panel"
  onClose?: () => void
}

export function FavoritesScreen({ variant = "page", onClose }: FavoritesScreenProps = {}) {
  const { state, dispatch } = useGame()
  const { favorites } = state

  const handleBack = () => {
    if (variant === "panel" && onClose) onClose()
    else dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const handleChat = (player: (typeof favorites)[0]) => {
    dispatch({ type: "OPEN_CHAT", player })
  }

  const listBody =
    favorites.length === 0 ? (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Heart className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center text-pretty">
          {"Пока нет избранных. Крутите бутылочку и начинайте общение!"}
        </p>
        <Button onClick={handleBack} variant="outline" className="rounded-xl">
          {"К игре"}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {favorites.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-primary/20">
              <img
                src={player.avatar}
                alt={player.name}
                className="h-full w-full object-cover bg-muted"
                crossOrigin="anonymous"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-card-foreground">{player.name}</p>
              <p className="text-xs text-muted-foreground">
                {player.age}
                {" лет"}{" "}
                {player.gender === "female" ? "Ж" : "М"}
                {" / "}
                {player.purpose === "relationships" && "Отношения"}
                {player.purpose === "communication" && "Общение"}
                {player.purpose === "love" && "Любовь"}
              </p>
            </div>
            <Button onClick={() => handleChat(player)} size="sm" className="rounded-xl">
              <MessageCircle className="mr-1 h-4 w-4" />
              {"Чат"}
            </Button>
          </div>
        ))}
      </div>
    )

  if (variant === "panel") {
    return (
      <GameSidePanelShell
        title="Избранные"
        onClose={onClose!}
        headerRight={<span className="text-sm text-slate-400">{favorites.length}</span>}
      >
        {listBody}
      </GameSidePanelShell>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-2 sm:gap-3 border-b border-border px-3 py-3 shrink-0">
        <button onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
          <span className="sr-only">{"Назад"}</span>
        </button>
        <h2 className="text-base font-bold text-foreground">{"Избранные"}</h2>
        <span className="ml-auto text-sm text-muted-foreground">{favorites.length}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">{listBody}</div>
    </div>
  )
}
