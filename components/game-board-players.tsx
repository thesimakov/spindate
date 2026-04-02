"use client"

import React from "react"
import { X, Sparkles, Gift, User } from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import type { Player, GameAction } from "@/lib/game-types"
import type { AvatarSteamFog } from "@/hooks/use-game-timers"

interface SteamPuff {
  id: string
  targetIdx: number
  delayMs: number
  spreadX: number
  spreadY: number
}

interface Position {
  x: number
  y: number
  angleDeg: number
}

interface GameBoardPlayersProps {
  players: Player[]
  positions: Position[]
  currentUser: Player | null
  currentTurnPlayer: Player | undefined
  targetPlayer: Player | null
  targetPlayer2: Player | null
  predictionTarget: Player | null
  predictionTarget2: Player | null
  predictionPhase: boolean
  predictionMade: boolean
  isSpinning: boolean
  showResult: boolean
  isMobile: boolean
  manyPlayersOnMobile: boolean
  avatarFrames: Record<string, string> | undefined
  rosesGiven: { toPlayerId: number }[] | undefined
  spinSkips: Record<string, number> | undefined
  /** Временный уход со вкладки (синхронизируется) — zzz как при spinSkips */
  clientTabAway?: Record<number, boolean>
  playerInUgadaika: number | null | undefined
  steamFogTick: number
  avatarSteamFog: Record<string, AvatarSteamFog>
  steamPuffs: SteamPuff[]
  sidebarTargetPlayer: Player | null
  sidebarGiftMode: boolean
  dispatch: (action: GameAction) => void
  onPlayerClick: (player: Player) => void
  setSidebarTargetPlayer: (p: Player | null) => void
  setSidebarGiftMode: (v: boolean) => void
  setGiftCatalogDrawerPlayer: (p: Player | null) => void
  getKissCountForPlayer: (id: number) => number
  getGiftsForPlayer: (id: number) => Array<"kiss" | "flowers" | "song" | "rose" | "diamond">
  getBigGiftSequenceForPlayer: (id: number) => string[]
  giftDisplayById?: Map<string, { emoji: string; img: string }>
}

function GameBoardPlayersInner({
  players,
  positions,
  currentUser,
  currentTurnPlayer,
  targetPlayer,
  targetPlayer2,
  predictionTarget,
  predictionTarget2,
  predictionPhase,
  predictionMade,
  isSpinning,
  showResult,
  isMobile,
  manyPlayersOnMobile,
  avatarFrames,
  rosesGiven,
  spinSkips,
  clientTabAway,
  playerInUgadaika,
  steamFogTick,
  avatarSteamFog,
  steamPuffs,
  sidebarTargetPlayer,
  sidebarGiftMode,
  dispatch,
  onPlayerClick,
  setSidebarTargetPlayer,
  setSidebarGiftMode,
  setGiftCatalogDrawerPlayer,
  getKissCountForPlayer,
  getGiftsForPlayer,
  getBigGiftSequenceForPlayer,
  giftDisplayById,
}: GameBoardPlayersProps) {
  return (
    <>
      {players.map((player, i) => {
        const pos = positions[i]
        if (!pos) return null
        const isAvatarMenuOpen = sidebarTargetPlayer?.id === player.id
        const isClickableForPrediction =
          predictionPhase && !predictionMade && !isSpinning && !showResult &&
          player.id !== currentUser?.id
        const bigGiftSequence = getBigGiftSequenceForPlayer(player.id)
        const hasRoseGiven = (rosesGiven ?? []).some((r) => r.toPlayerId === player.id)
        const giftIcons = hasRoseGiven
          ? [...getGiftsForPlayer(player.id), "rose" as const]
          : getGiftsForPlayer(player.id)
        const steamAvatarSize = manyPlayersOnMobile ? 42 : isMobile ? 52 : 70
        const steamBorder = steamAvatarSize <= 52 ? 3 : 4
        const steamOuterPx = steamAvatarSize + steamBorder * 2 + 4
        const avatarMenuOpenUpward = pos.y >= 50
        return (
          <div
            key={player.id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${isAvatarMenuOpen ? "z-50" : "z-10"}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              cursor: isClickableForPrediction ? "pointer" : player.id !== currentUser?.id ? "pointer" : "default",
              filter: isClickableForPrediction && !predictionTarget?.id && !predictionTarget2?.id
                ? "drop-shadow(0 0 6px rgba(46, 204, 113, 0.4))"
                : "none",
              transition: "filter 0.3s ease",
            }}
            onClick={() => onPlayerClick(player)}
          >
            <div className="relative inline-flex flex-col items-center">
              <PlayerAvatar
                player={player}
                tableRingLayout
                compact={isMobile || manyPlayersOnMobile}
                size={manyPlayersOnMobile ? 42 : isMobile ? 52 : undefined}
                isCurrentTurn={player.id === currentTurnPlayer?.id && !showResult}
                isTarget={
                  showResult &&
                  (targetPlayer?.id === player.id || targetPlayer2?.id === player.id)
                }
                isPredictionTarget={
                  predictionPhase && !isSpinning && !showResult &&
                  (predictionTarget?.id === player.id || predictionTarget2?.id === player.id)
                }
                kissCount={getKissCountForPlayer(player.id)}
                giftIcons={giftIcons}
                bigGiftSequence={bigGiftSequence.length > 0 ? bigGiftSequence : undefined}
                giftDisplayById={giftDisplayById}
                frameId={avatarFrames?.[player.id]}
                inGame={playerInUgadaika != null && player.id === playerInUgadaika}
                showAsleep={
                  (spinSkips?.[player.id] ?? 0) >= 3 || clientTabAway?.[player.id] === true
                }
              />
              {(() => {
                void steamFogTick
                const fog = avatarSteamFog[player.id]
                const nowFog = Date.now()
                if (!fog || fog.until <= nowFog) return null
                const timeLeft01 = Math.max(0, Math.min(1, (fog.until - nowFog) / 60_000))
                const wet = fog.level
                const blurPx = 1.2 + wet * (5 + 9 * timeLeft01)
                const gloss = 0.1 + wet * (0.22 + 0.2 * timeLeft01)
                const frost = 0.12 + wet * (0.28 + 0.25 * timeLeft01)
                return (
                  <div
                    className="pointer-events-none absolute z-[32] overflow-hidden rounded-full"
                    style={{
                      width: steamOuterPx,
                      height: steamOuterPx,
                      left: "50%",
                      top: 0,
                      transform: "translateX(-50%)",
                      WebkitBackdropFilter: `blur(${blurPx}px) saturate(${1.05 + wet * 0.12})`,
                      backdropFilter: `blur(${blurPx}px) saturate(${1.05 + wet * 0.12})`,
                      background: `linear-gradient(200deg, rgba(255,255,255,${gloss}) 0%, rgba(186,230,253,${frost * 0.55}) 38%, rgba(148,163,184,${frost * 0.45}) 100%)`,
                      opacity: Math.min(0.98, wet * (0.35 + 0.55 * timeLeft01)),
                      boxShadow: `inset 0 0 ${14 + wet * 28}px rgba(255,255,255,${0.12 + wet * 0.2 * timeLeft01})`,
                      mixBlendMode: "soft-light",
                    }}
                    aria-hidden
                  />
                )
              })()}
              {steamPuffs
                .filter((p) => p.targetIdx === i)
                .map((p) => {
                  const spreadR = steamOuterPx * 0.42
                  const leftPx = p.spreadX * spreadR
                  const topPx = steamOuterPx / 2 + p.spreadY * spreadR
                  return (
                    <div
                      key={p.id}
                      className="pointer-events-none absolute z-[35]"
                      style={{
                        left: `calc(50% + ${leftPx}px)`,
                        top: topPx,
                        opacity: 0,
                        animation: `steamRise 1.4s ease-out forwards`,
                        animationDelay: `${p.delayMs}ms`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: steamOuterPx <= 56 ? "22px" : steamOuterPx <= 70 ? "26px" : "30px",
                          color: "rgba(226, 232, 240, 0.9)",
                          textShadow: "0 0 12px rgba(226,232,240,0.55)",
                          filter: "blur(0.2px)",
                        }}
                      >
                        {"💨"}
                      </span>
                    </div>
                  )
                })}
            </div>
            {isAvatarMenuOpen && (
              <div
                className="absolute left-1/2 z-40 w-[min(92vw,184px)] -translate-x-1/2"
                style={
                  avatarMenuOpenUpward
                    ? { bottom: "100%", marginBottom: "0.5rem" }
                    : { top: "100%", marginTop: "0.5rem" }
                }
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="relative rounded-2xl border p-2 pt-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_0_1px_rgba(56,189,248,0.12),0_0_28px_rgba(251,191,36,0.08)]"
                  style={{
                    background: "linear-gradient(165deg, rgba(22, 32, 52, 0.98) 0%, rgba(8, 15, 32, 0.99) 100%)",
                    borderColor: "rgba(251, 191, 36, 0.28)",
                    boxShadow:
                      "0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  <button
                    type="button"
                    aria-label="Закрыть мини-меню"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSidebarTargetPlayer(null)
                      setSidebarGiftMode(false)
                    }}
                    className="absolute -right-1 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-slate-900/80 transition-all hover:brightness-110 hover:scale-105"
                    style={{
                      background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                      color: "#ffffff",
                      border: "1px solid rgba(254, 202, 202, 0.95)",
                      boxShadow: "0 4px 14px rgba(127, 29, 29, 0.7), inset 0 1px 0 rgba(255,255,255,0.35)",
                    }}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSidebarGiftMode(true)
                      }}
                      className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:brightness-110 active:scale-[0.98] ${
                        sidebarGiftMode
                          ? "border-cyan-400/45 bg-slate-950/90 ring-1 ring-cyan-400/25"
                          : "border-slate-500/30 bg-slate-950/70 hover:border-slate-400/35 hover:bg-slate-900/85"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
                        <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-white antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.65)] sm:text-xs">
                        Подарить эмоцию
                      </span>
                    </button>
                    {currentUser && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSidebarGiftMode(false)
                          setSidebarTargetPlayer(null)
                          setGiftCatalogDrawerPlayer(player)
                        }}
                        className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-slate-500/30 bg-slate-950/70 px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-400/35 hover:bg-slate-900/85 hover:brightness-110 active:scale-[0.98]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.1)]">
                          <Gift className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-white antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.65)] sm:text-xs">
                          Подарить подарок
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSidebarTargetPlayer(null)
                        setSidebarGiftMode(false)
                        dispatch({ type: "OPEN_PLAYER_MENU", player })
                      }}
                      className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-amber-400/35 bg-slate-950/70 px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/15 transition-all hover:border-amber-400/50 hover:bg-slate-900/85 hover:ring-amber-400/25 active:scale-[0.98]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-gradient-to-b from-amber-400/25 to-amber-600/15 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.2)]">
                        <User className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-amber-50 antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.7),0_0_12px_rgba(251,191,36,0.15)] sm:text-xs">
                        Профиль
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export type { SteamPuff, Position }
export const GameBoardPlayers = React.memo(GameBoardPlayersInner)
