"use client"

import type { Player } from "@/lib/game-types"
import { assetUrl, FRAME_SVG } from "@/lib/assets"

const FRAME_STYLES: Record<string, { border: string; boxShadow: string }> = {
  none: { border: "2px solid #475569", boxShadow: "none" },
  gold: { border: "3px solid #e8c06a", boxShadow: "0 0 12px rgba(232,192,106,0.8)" },
  silver: { border: "3px solid #c0c0c0", boxShadow: "0 0 12px rgba(192,192,192,0.7)" },
  hearts: { border: "3px solid #e74c3c", boxShadow: "0 0 14px rgba(231,76,60,0.7)" },
  roses: { border: "3px solid #be123c", boxShadow: "0 0 14px rgba(190,18,60,0.6)" },
  gradient: { border: "3px solid #8b5cf6", boxShadow: "0 0 16px rgba(139,92,246,0.6)" },
  neon: { border: "3px solid rgba(0, 255, 255, 0.95)", boxShadow: "none" },
  snow: { border: "3px solid rgba(186, 230, 253, 0.95)", boxShadow: "0 0 12px rgba(186, 230, 253, 0.5)" },
  rabbit: { border: "2px solid transparent", boxShadow: "none" },
  fairy: { border: "2px solid transparent", boxShadow: "none" },
  fox: { border: "2px solid transparent", boxShadow: "none" },
}

const FRAME_SVG_IDS = Object.keys(FRAME_SVG) as (keyof typeof FRAME_SVG)[]

interface PlayerAvatarProps {
  player: Player
  isCurrentTurn?: boolean
  isTarget?: boolean
  isPredictionTarget?: boolean
  compact?: boolean
  kissCount?: number
  giftIcons?: Array<"rose" | "flowers" | "song" | "diamond" | "kiss">
  bigGiftIcon?:
    | "toy_bear"
    | "toy_car"
    | "toy_ball"
    | "souvenir_magnet"
    | "souvenir_keychain"
    | "plush_heart"
    | "chocolate_box"
  bigGiftHasMany?: boolean
  /** Рамка на аватарке (подаренная) — отображается на столе */
  frameId?: string
  /** Игрок сейчас в мини-игре «Угадай-ка» — показывать статус «в игре» */
  inGame?: boolean
  /** Не крутил бутылочку 3+ хода — показывать «уснул» (zzz из центра аватарки) */
  showAsleep?: boolean
}

export function PlayerAvatar({
  player,
  isCurrentTurn = false,
  isTarget = false,
  isPredictionTarget = false,
  compact = false,
  kissCount,
  giftIcons,
  bigGiftIcon,
  bigGiftHasMany,
  frameId,
  inGame = false,
  showAsleep = false,
}: PlayerAvatarProps) {
  const frameStyle = frameId && frameId !== "none" ? FRAME_STYLES[frameId] ?? FRAME_STYLES.none : null
  const useFrameOnRim = frameStyle && !isTarget && !isCurrentTurn
  const isSvgFrame = frameId && FRAME_SVG_IDS.includes(frameId as keyof typeof FRAME_SVG)
  const svgFrameSrc = isSvgFrame && frameId in FRAME_SVG ? assetUrl((FRAME_SVG as Record<string, string>)[frameId]) : null
  const size = compact ? 52 : 72
  const borderSize = compact ? 3 : 4
  const outerSize = size + borderSize * 2 + 4
  const isVip = !!player.isVip

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: outerSize, height: outerSize }}
      >
        {/* zzz — игрок «уснул» / отошёл (не крутил 3+ хода), но онлайн */}
        {showAsleep && !isCurrentTurn && !isTarget && (
          <div
            className="avatar-asleep-zzz absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none flex items-center justify-center gap-0.5"
            style={{ width: outerSize, height: outerSize }}
            aria-hidden
          >
            <span className="avatar-asleep-zzz-letter">z</span>
            <span className="avatar-asleep-zzz-letter avatar-asleep-zzz-letter-2">z</span>
            <span className="avatar-asleep-zzz-letter avatar-asleep-zzz-letter-3">z</span>
          </div>
        )}

        {/* Неоновый подсвет рамки для текущего хода / цели */}
        {(isCurrentTurn || isTarget) && (
          <div
            className="absolute inset-[-4px] rounded-full"
            style={{
              border: isCurrentTurn
                ? "3px solid rgba(80, 250, 255, 0.95)"
                : "3px solid rgba(196, 148, 58, 0.9)",
              boxShadow: isCurrentTurn
                ? "0 0 18px rgba(80, 250, 255, 0.95), 0 0 32px rgba(80, 250, 255, 0.7)"
                : "0 0 18px rgba(196, 148, 58, 0.8)",
              animation: isTarget
                ? "targetPulse 1.5s ease-in-out infinite"
                : "glowPulse 2s ease-in-out infinite",
            }}
          />
        )}

        {/* Сердечки вокруг рамки «Сердечки» */}
        {frameId === "hearts" && useFrameOnRim && (
          <div
            className="pointer-events-none absolute"
            style={{
              inset: -16,
              zIndex: 0,
            }}
            aria-hidden
          >
            <div
              className="frame-hearts-orbit absolute left-1/2 top-1/2"
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angleDeg = i * 45
                const radius = outerSize / 2 + 4
                const heartSize = compact ? 10 : 14
                return (
                  <span
                    key={i}
                    className="absolute inline-flex items-center justify-center"
                    style={{
                      left: "50%",
                      top: "50%",
                      width: heartSize,
                      height: heartSize,
                      marginLeft: -heartSize / 2,
                      marginTop: -heartSize / 2,
                      transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                      filter: "drop-shadow(0 0 4px rgba(231,76,60,0.8))",
                      color: "#e74c3c",
                    }}
                  >
                    <span
                      className="frame-heart-pulse inline-block"
                      style={{
                        fontSize: heartSize,
                        lineHeight: 1,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    >
                      ❤
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Розы вокруг рамки «Розы» — стартуют от рамки и вылетают наружу (без обрезки) */}
        {frameId === "roses" && useFrameOnRim && (
          <div
            className="pointer-events-none absolute"
            style={{
              inset: -28,
              zIndex: 0,
            }}
            aria-hidden
          >
            {/* Точка центра совпадает с центром аватарки */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 0, height: 0 }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angleDeg = i * 45
                const roseSize = compact ? 14 : 18
                const radius = outerSize / 2 + 2
                return (
                  <div
                    key={i}
                    className="absolute left-0 top-0 inline-flex items-center justify-center"
                    style={{
                      width: roseSize * 2,
                      height: roseSize * 2,
                      marginLeft: -roseSize,
                      marginTop: -roseSize,
                      transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                      border: "none",
                      outline: "none",
                      boxShadow: "none",
                    }}
                  >
                    <span
                      className="frame-rose-petal-out inline-block"
                      style={{
                        fontSize: roseSize,
                        lineHeight: 1,
                        animationDelay: `${i * 0.28}s`,
                        border: "none",
                        outline: "none",
                        boxShadow: "none",
                      }}
                    >
                      🌹
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Снежинки вокруг рамки «Снежная» — стартуют от рамки и вылетают наружу */}
        {frameId === "snow" && useFrameOnRim && (
          <div
            className="pointer-events-none absolute"
            style={{
              inset: -28,
              zIndex: 0,
            }}
            aria-hidden
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 0, height: 0 }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angleDeg = i * 45
                const flakeSize = compact ? 12 : 16
                const radius = outerSize / 2 + 2
                return (
                  <div
                    key={i}
                    className="absolute left-0 top-0 inline-flex items-center justify-center"
                    style={{
                      width: flakeSize * 2,
                      height: flakeSize * 2,
                      marginLeft: -flakeSize,
                      marginTop: -flakeSize,
                      transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                      border: "none",
                      outline: "none",
                      boxShadow: "none",
                    }}
                  >
                    <span
                      className="inline-block"
                      style={{
                        fontSize: flakeSize,
                        lineHeight: 1,
                        border: "none",
                        outline: "none",
                        boxShadow: "none",
                        animation: "frameSnowflakeOut 2.4s ease-out infinite",
                        animationDelay: `${i * 0.3}s`,
                      }}
                    >
                      ❄
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Rim outer: рамка (подаренная) или градиент по умолчанию */}
        <div
          className={`absolute inset-0 rounded-full ${frameId === "neon" && useFrameOnRim ? "frame-neon-flicker" : ""}`}
          style={{
            ...(useFrameOnRim
              ? { border: frameStyle!.border, boxShadow: frameStyle!.boxShadow, background: "transparent", padding: borderSize }
              : {
                  background: isTarget
                    ? "linear-gradient(135deg, #e74c3c 0%, #c0392b 50%, #e74c3c 100%)"
                    : isPredictionTarget
                      ? "linear-gradient(135deg, #2ecc71 0%, #27ae60 50%, #2ecc71 100%)"
                      : isCurrentTurn
                        ? "linear-gradient(135deg, #f1c40f 0%, #c4943a 30%, #e8c06a 60%, #c4943a 100%)"
                        : "linear-gradient(135deg, #334155 0%, #475569 30%, #64748b 60%, #334155 100%)",
                  padding: borderSize,
                }),
          }}
        >
          {/* Inner dark border */}
          <div
            className="h-full w-full rounded-full"
            style={{
              padding: 2,
              background: isTarget ? "#8b1a1a" : "#0f172a",
            }}
          >
            {/* Photo container */}
            <div className="h-full w-full overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={player.avatar}
                alt={player.name}
                className="h-full w-full object-cover"
                style={{ background: "#1e293b" }}
              />
            </div>
          </div>
        </div>

        {/* Рамка-картинка (кролик, фея, лиса) — SVG поверх аватарки, показываем всегда когда выбрана */}
        {svgFrameSrc && (useFrameOnRim || isCurrentTurn || isTarget) && (
          <div
            className="pointer-events-none absolute inset-[-8px] z-[1] flex items-center justify-center"
            aria-hidden
          >
            <img
              src={svgFrameSrc}
              alt=""
              className="h-full w-full object-contain"
              style={
                frameId === "rabbit"
                  ? { objectPosition: "center center", transform: "scale(1.15) translateY(-12px)" }
                  : frameId === "fairy"
                    ? { objectPosition: "center center", transform: "scale(1.5) translateY(-2px)" }
                    : frameId === "fox"
                      ? { objectPosition: "center center", transform: "scale(1.06) translateY(6px)" }
                      : undefined
              }
              aria-hidden
            />
          </div>
        )}

        {/* Статус «в игре» (мини-игра Угадай-ка) — снизу по центру */}
        {inGame && !isTarget && (
          <div
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              bottom: compact ? -14 : -16,
              background: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
              color: "#fff",
              boxShadow: "0 0 8px rgba(14,165,233,0.6)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
          >
            в игре
          </div>
        )}

        {/* VIP badge (top-right, немного заходя на рамку) */}
        {isVip && !isTarget && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: compact ? 18 : 20,
              height: compact ? 18 : 20,
              background: "linear-gradient(135deg,#facc15,#f97316)",
              border: "2px solid #b45309",
              top: 2,
              right: 2,
              boxShadow: "0 0 10px rgba(250,204,21,0.95)",
            }}
          >
            <svg
              width={compact ? 10 : 11}
              height={compact ? 10 : 11}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M4 18h16l-1.5-7.5-3.5 3-3-6.5-3 6.5-3.5-3L4 18z"
                fill="#111827"
              />
            </svg>
          </div>
        )}

        {/* Kiss counter (top-left, на уровне с VIP) */}
        {typeof kissCount === "number" && kissCount > 0 && !isTarget && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              minWidth: compact ? 20 : 22,
              height: compact ? 18 : 20,
              padding: compact ? "0 4px" : "0 5px",
              background: "linear-gradient(135deg,#f97316,#ec4899)",
              border: "2px solid #7c2d12",
              top: 2,
              left: 2,
              boxShadow: "0 0 10px rgba(248,113,113,0.9)",
            }}
          >
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: "#fff" }}
            >
              {"💋 "}
              {kissCount}
            </span>
          </div>
        )}

        {/* Gift icons (снизу слева): только поцелуи и розы, без цветов, бриллиантов и песни */}
        {giftIcons && (() => {
          const filtered = giftIcons.filter((icon) => icon !== "flowers" && icon !== "diamond" && icon !== "song")
          return filtered.length > 0 && !isTarget && (
            <div
              className="absolute flex items-center"
              style={{
                bottom: -4,
                left: -6,
              }}
            >
              {filtered.map((icon, index) => (
                <span
                  key={`${icon}_${index}`}
                  className="drop-shadow-lg"
                  aria-hidden="true"
                  style={{
                    fontSize: compact ? "20px" : "24px",
                    marginLeft: index === 0 ? 0 : -8,
                  }}
                >
                  {icon === "rose" && "🌹"}
                  {icon === "kiss" && "💋"}
                </span>
              ))}
            </div>
          )
        })()}

        {/* Big gift overlay (нижняя правая часть, ~70x70 поверх аватарки, без фона и рамки) */}
        {bigGiftIcon && !isTarget && !compact && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: 70,
              height: 70,
              right: -20,
              bottom: -20,
              animation: bigGiftHasMany ? "giftFade 5s ease-in-out" : undefined,
            }}
          >
            <span
              className="drop-shadow-lg"
              aria-hidden="true"
              style={{ fontSize: "40px" }}
            >
              {bigGiftIcon === "toy_bear" && "🧸"}
              {bigGiftIcon === "plush_heart" && "❤️"}
              {bigGiftIcon === "toy_car" && "🚗"}
              {bigGiftIcon === "toy_ball" && "⚽️"}
              {bigGiftIcon === "souvenir_magnet" && "🧲"}
              {bigGiftIcon === "souvenir_keychain" && "🔑"}
              {bigGiftIcon === "chocolate_box" && "🍫"}
            </span>
          </div>
        )}

        {/* Heart indicator for target */}
        {isTarget && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              backgroundColor: "#e74c3c",
              border: "2px solid #0f172a",
              top: -4,
              right: -4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        )}

        {/* Prediction target glow ring */}
        {isPredictionTarget && !isTarget && (
          <div
            className="absolute inset-[-6px] rounded-full"
            style={{
              border: "3px solid #2ecc71",
              boxShadow: "0 0 12px rgba(46, 204, 113, 0.6), inset 0 0 8px rgba(46, 204, 113, 0.2)",
              animation: "targetPulse 1.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Prediction target check badge */}
        {isPredictionTarget && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              backgroundColor: "#2ecc71",
              border: "2px solid #0f172a",
              top: -4,
              left: -4,
              zIndex: 10,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        )}
      </div>

      {/* Name label - dark badge style like reference */}
      <div
        className="flex items-center justify-center rounded-full px-3 py-0.5"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          minWidth: compact ? 48 : 60,
          maxWidth: compact ? 64 : 84,
        }}
      >
        <span
          className="truncate text-center font-semibold leading-tight"
          style={{
            fontSize: compact ? 9 : 11,
            color: "#f0e0c8",
          }}
        >
          {player.name}
        </span>
      </div>

      {/* "ваш выбор" label for prediction target */}
      {isPredictionTarget && (
        <div
          className="flex items-center justify-center rounded-full px-2 py-0.5 animate-in fade-in zoom-in duration-300"
          style={{
            backgroundColor: "rgba(46, 204, 113, 0.9)",
            minWidth: compact ? 48 : 60,
            boxShadow: "0 2px 6px rgba(46, 204, 113, 0.4)",
            marginTop: -2,
          }}
        >
          <span
            className="truncate text-center font-bold leading-tight"
            style={{
              fontSize: compact ? 8 : 9,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {"ваш выбор"}
          </span>
        </div>
      )}
    </div>
  )
}
