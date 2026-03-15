"use client"

import { useMemo, useState } from "react"
import { Trophy, X } from "lucide-react"
import { useGame } from "@/lib/game-context"
import type { GameLogEntry } from "@/lib/game-types"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Стоимость действий для рейтинга «Самые добрые» */
const KIND_ACTION_COST: Record<string, number> = {
  beer: 1,
  banya: 5,
  flowers: 5,
  diamond: 20,
  tools: 1,
  lipstick: 5,
}

const GIFT_TYPES = new Set(["rose", "flowers", "song", "diamond", "gift_voice", "tools", "lipstick"])

function useWeekLog(gameLog: GameLogEntry[]) {
  return useMemo(() => {
    const weekAgo = Date.now() - WEEK_MS
    return gameLog.filter((e) => e.timestamp >= weekAgo && e.fromPlayer)
  }, [gameLog])
}

function useLoveLeaderboard(weekLog: GameLogEntry[]) {
  return useMemo(() => {
    const counts: Record<number, { name: string; avatar: string; count: number }> = {}
    for (const e of weekLog) {
      if (e.type !== "kiss" || !e.fromPlayer) continue
      const id = e.fromPlayer.id
      if (!counts[id]) counts[id] = { name: e.fromPlayer.name, avatar: e.fromPlayer.avatar ?? "", count: 0 }
      counts[id].count++
    }
    return Object.entries(counts)
      .map(([id, data]) => ({ playerId: Number(id), ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [weekLog])
}

function useGiftsLeaderboard(weekLog: GameLogEntry[]) {
  return useMemo(() => {
    const counts: Record<number, { name: string; avatar: string; count: number }> = {}
    for (const e of weekLog) {
      if (!GIFT_TYPES.has(e.type) || !e.fromPlayer) continue
      const id = e.fromPlayer.id
      if (!counts[id]) counts[id] = { name: e.fromPlayer.name, avatar: e.fromPlayer.avatar ?? "", count: 0 }
      counts[id].count++
    }
    return Object.entries(counts)
      .map(([id, data]) => ({ playerId: Number(id), ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [weekLog])
}

function useKindLeaderboard(weekLog: GameLogEntry[]) {
  return useMemo(() => {
    const sums: Record<number, { name: string; avatar: string; sum: number }> = {}
    for (const e of weekLog) {
      const cost = KIND_ACTION_COST[e.type]
      if (cost == null || !e.fromPlayer) continue
      const id = e.fromPlayer.id
      if (!sums[id]) sums[id] = { name: e.fromPlayer.name, avatar: e.fromPlayer.avatar ?? "", sum: 0 }
      sums[id].sum += cost
    }
    return Object.entries(sums)
      .map(([id, data]) => ({ playerId: Number(id), ...data }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10)
  }, [weekLog])
}

type TabId = "love" | "gifts" | "kind"

const TABS: { id: TabId; label: string }[] = [
  { id: "love", label: "Любвеобильные" },
  { id: "gifts", label: "Щедрые" },
  { id: "kind", label: "Добрые" },
]

export function RatingModal({ onClose }: { onClose: () => void }) {
  const { state } = useGame()
  const { gameLog } = state
  const [activeTab, setActiveTab] = useState<TabId>("love")
  const weekLog = useWeekLog(gameLog)
  const love = useLoveLeaderboard(weekLog)
  const gifts = useGiftsLeaderboard(weekLog)
  const kind = useKindLeaderboard(weekLog)

  const content = () => {
    const avatarEl = (avatar: string, name: string) => (
      <span className="flex items-center gap-2 min-w-0">
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-600 bg-slate-700">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-slate-400">?</span>
          )}
        </span>
        <span className="text-amber-50 truncate">{name}</span>
      </span>
    )
    if (activeTab === "love") {
      if (love.length === 0) return <p className="text-sm text-amber-300/70 py-4">Пока ни одного поцелуя за неделю</p>
      return (
        <ul className="space-y-2">
          {love.map((item, i) => (
            <li key={item.playerId} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-amber-400/90 font-medium w-6 shrink-0">{i + 1}.</span>
                {avatarEl(item.avatar, item.name)}
              </span>
              <span className="text-amber-200 font-semibold shrink-0">{item.count}</span>
            </li>
          ))}
        </ul>
      )
    }
    if (activeTab === "gifts") {
      if (gifts.length === 0) return <p className="text-sm text-amber-300/70 py-4">Пока нет подарков за неделю</p>
      return (
        <ul className="space-y-2">
          {gifts.map((item, i) => (
            <li key={item.playerId} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-amber-400/90 font-medium w-6 shrink-0">{i + 1}.</span>
                {avatarEl(item.avatar, item.name)}
              </span>
              <span className="text-amber-200 font-semibold shrink-0">{item.count}</span>
            </li>
          ))}
        </ul>
      )
    }
    if (activeTab === "kind") {
      if (kind.length === 0) return <p className="text-sm text-amber-300/70 py-4">Пока нет трат за неделю</p>
      return (
        <ul className="space-y-2">
          {kind.map((item, i) => (
            <li key={item.playerId} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-amber-400/90 font-medium w-6 shrink-0">{i + 1}.</span>
                {avatarEl(item.avatar, item.name)}
              </span>
              <span className="text-amber-200 font-semibold shrink-0">{item.sum} ❤</span>
            </li>
          ))}
        </ul>
      )
    }
    return null
  }

  const subtitle = activeTab === "love"
    ? "Количество поцелуев"
    : activeTab === "gifts"
      ? "Кто больше всего подарил подарков"
      : "Кто больше всего потратил на пиво, парить, бриллианты, цветы"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md max-h-[85vh] flex-col rounded-2xl border shadow-xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          borderColor: "#334155",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "#334155" }}>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
                boxShadow: "0 0 10px rgba(250,204,21,0.35)",
              }}
            >
              <Trophy className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Рейтинг</h2>
              <p className="text-[11px] text-slate-400">За последние 7 дней</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Табы */}
        <div className="flex shrink-0 border-b px-2" style={{ borderColor: "#334155" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 py-2.5 text-center text-sm font-medium transition-colors"
              style={{
                color: activeTab === tab.id ? "#facc15" : "#94a3b8",
                borderBottom: activeTab === tab.id ? "2px solid #facc15" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент выбранного таба */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-3 text-xs text-slate-400">{subtitle}</p>
          {content()}
        </div>
      </div>
    </div>
  )
}
