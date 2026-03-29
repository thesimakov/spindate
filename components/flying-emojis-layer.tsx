"use client"

import React from "react"

interface FlyingEmoji {
  id: string
  emoji?: string
  imgSrc?: string
  thanksCloud: boolean
  fromX: number
  fromY: number
  toX: number
  toY: number
}

interface FlyingEmojiContentProps {
  fe: FlyingEmoji
}

function FlyingEmojiContentInner({ fe }: FlyingEmojiContentProps) {
  if (fe.thanksCloud) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-lg ring-1 ring-amber-400/30">
        {"Спасибо! 🎉"}
      </span>
    )
  }
  if (fe.imgSrc) {
    return (
      <img
        src={fe.imgSrc}
        alt=""
        className="h-10 w-10 object-contain drop-shadow-md"
        draggable={false}
      />
    )
  }
  return <span className="text-3xl drop-shadow-md">{fe.emoji ?? "💖"}</span>
}

const FlyingEmojiContent = React.memo(FlyingEmojiContentInner)

interface FlyingEmojisLayerProps {
  flyingEmojis: FlyingEmoji[]
}

function FlyingEmojisLayerInner({ flyingEmojis }: FlyingEmojisLayerProps) {
  if (flyingEmojis.length === 0) return null
  return (
    <>
      {flyingEmojis.map((fe) => {
        const midX = (fe.fromX + fe.toX) / 2
        const arcLift = fe.thanksCloud ? 14 : 5
        const midY = (fe.fromY + fe.toY) / 2 - arcLift
        return (
          <div
            key={fe.id}
            className="pointer-events-none absolute z-[90]"
            style={{
              left: `${fe.fromX}%`,
              top: `${fe.fromY}%`,
              animation: fe.thanksCloud
                ? "flyThanksCloud 2.35s cubic-bezier(0.22, 1, 0.36, 1) forwards"
                : "flyEmoji 1.8s ease-in-out forwards",
              // @ts-expect-error CSS custom properties
              "--fly-from-left": `${fe.fromX}%`,
              "--fly-from-top": `${fe.fromY}%`,
              "--fly-mid-left": `${midX}%`,
              "--fly-mid-top": `${midY}%`,
              "--fly-to-left": `${fe.toX}%`,
              "--fly-to-top": `${fe.toY}%`,
            }}
          >
            <FlyingEmojiContent fe={fe} />
          </div>
        )
      })}
    </>
  )
}

export type { FlyingEmoji }
export const FlyingEmojisLayer = React.memo(FlyingEmojisLayerInner)
