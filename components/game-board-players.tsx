"use client"

import React from "react"
import { CreatorTableHostAura } from "@/components/creator-table-host-aura"
import { PlayerAvatar } from "@/components/player-avatar"
import type { Player } from "@/lib/game-types"
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
  onPlayerClick: (player: Player) => void
  getKissCountForPlayer: (id: number) => number
  getGiftsForPlayer: (id: number) => Array<"kiss" | "flowers" | "song" | "rose" | "diamond">
  getBigGiftSequenceForPlayer: (id: number) => string[]
  giftDisplayById?: Map<string, { emoji: string; img: string }>
  roomCreatorPlayerId?: number | null
  avatarFrameMetaByPlayerId?: Record<number, { border?: string; shadow?: string; svgPath?: string }>
  catalogGiftAvatarHold?: { playerId: number; giftTypeId: string } | null
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
  onPlayerClick,
  getKissCountForPlayer,
  getGiftsForPlayer,
  getBigGiftSequenceForPlayer,
  giftDisplayById,
  roomCreatorPlayerId,
  avatarFrameMetaByPlayerId,
  catalogGiftAvatarHold,
}: GameBoardPlayersProps) {
  return (
    <>
      {players.map((player, i) => {
        const pos = positions[i]
        if (!pos) return null
        const playerFrameId = avatarFrames?.[player.id]
        const playerFrameMeta = avatarFrameMetaByPlayerId?.[player.id]
        const isClickableForPrediction =
          predictionPhase && !predictionMade && !isSpinning && !showResult &&
          player.id !== currentUser?.id
        const bigGiftSequenceRaw = getBigGiftSequenceForPlayer(player.id)
        const bigGiftSequence =
          catalogGiftAvatarHold?.playerId === player.id
            ? (() => {
                const idx = bigGiftSequenceRaw.lastIndexOf(catalogGiftAvatarHold.giftTypeId)
                if (idx === -1) return bigGiftSequenceRaw
                return [...bigGiftSequenceRaw.slice(0, idx), ...bigGiftSequenceRaw.slice(idx + 1)]
              })()
            : bigGiftSequenceRaw
        const hasRoseGiven = (rosesGiven ?? []).some((r) => r.toPlayerId === player.id)
        const giftIcons = hasRoseGiven
          ? [...getGiftsForPlayer(player.id), "rose" as const]
          : getGiftsForPlayer(player.id)
        const steamAvatarSize = manyPlayersOnMobile ? 42 : isMobile ? 52 : 70
        const steamBorder = steamAvatarSize <= 52 ? 3 : 4
        const steamOuterPx = steamAvatarSize + steamBorder * 2 + 4
        const isRoomCreator = roomCreatorPlayerId != null && player.id === roomCreatorPlayerId
        return (
          <div
            key={player.id}
            data-turn-arrow-player-id={player.id}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${isRoomCreator ? "group" : ""}`}
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
              {isRoomCreator ? <CreatorTableHostAura steamOuterPx={steamOuterPx} /> : null}
              <PlayerAvatar
                player={player}
                tableRingLayout
                showStatusBadge
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
                frameId={playerFrameId}
                frameBorder={playerFrameMeta?.border}
                frameShadow={playerFrameMeta?.shadow}
                frameSvgPath={playerFrameMeta?.svgPath}
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
          </div>
        )
      })}
    </>
  )
}

export type { SteamPuff, Position }
export const GameBoardPlayers = React.memo(GameBoardPlayersInner)
