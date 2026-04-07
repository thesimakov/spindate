"use client"

import { Heart, MessageCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { splitFavoritesAndAdmirersPeers } from "@/lib/merge-peers-for-pm"
import type { Player } from "@/lib/game-types"

type PrivateInboxPanelProps = {
  onClose: () => void
}

function PeerRow({ player, onChat }: { player: Player; onChat: (p: Player) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/15 bg-slate-900/60 p-3 transition-colors hover:bg-slate-800/70">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-cyan-500/20">
        {player.avatar ? (
          <img
            src={player.avatar}
            alt=""
            className="h-full w-full object-cover bg-slate-800"
            crossOrigin="anonymous"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-slate-800 text-sm font-bold text-slate-200">
            {(player.name || "?").slice(0, 1)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{player.name}</p>
        <p className="truncate text-[11px] text-slate-500">
          {player.age}
          {" лет · "}
          {purposeLabel(player.purpose)}
        </p>
      </div>
      <Button
        type="button"
        onClick={() => onChat(player)}
        size="sm"
        className="shrink-0 rounded-xl border border-cyan-500/35 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50"
      >
        <MessageCircle className="mr-1 h-3.5 w-3.5" />
        Написать
      </Button>
    </div>
  )
}

function purposeLabel(purpose: Player["purpose"]): string {
  if (purpose === "relationships") return "Отношения"
  if (purpose === "love") return "Любовь"
  return "Общение"
}

function Section({
  title,
  icon: Icon,
  emptyText,
  players,
  onChat,
}: {
  title: string
  icon: typeof Heart
  emptyText: string
  players: Player[]
  onChat: (p: Player) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <Icon className="h-3.5 w-3.5 text-amber-400/90" />
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{title}</h3>
        <span className="ml-auto tabular-nums text-[10px] text-slate-600">{players.length}</span>
      </div>
      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 px-3 py-4 text-center text-xs leading-relaxed text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((player) => (
            <PeerRow key={player.id} player={player} onChat={onChat} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PrivateInboxPanel({ onClose }: PrivateInboxPanelProps) {
  const { state, dispatch } = useGame()
  const { favorites = [], admirers = [] } = state
  const { favoritesRows, admirersRows } = splitFavoritesAndAdmirersPeers(favorites, admirers)
  const totalListed = favoritesRows.length + admirersRows.length

  const openChat = (player: Player) => {
    dispatch({ type: "OPEN_SIDE_CHAT", player })
  }

  return (
    <GameSidePanelShell
      title="Чат"
      subtitle="Личные сообщения с избранными и поклонниками"
      onClose={onClose}
      headerRight={<span className="text-xs tabular-nums text-slate-500">{totalListed}</span>}
    >
      <div className="flex flex-col gap-6">
        <Section
          title="Избранные"
          icon={Heart}
          emptyText="Пока никого в избранном. Добавляйте людей из меню игрока за столом."
          players={favoritesRows}
          onChat={openChat}
        />
        <Section
          title="Поклонники"
          icon={Sparkles}
          emptyText="Когда кто-то поухаживает за вами — он появится здесь."
          players={admirersRows}
          onChat={openChat}
        />
      </div>
    </GameSidePanelShell>
  )
}
