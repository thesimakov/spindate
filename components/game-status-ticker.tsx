"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { useTickerFeed } from "@/lib/use-ticker-feed"
import { cn } from "@/lib/utils"

/** Целевая скорость ленты (px/s): длинный текст → дольше duration, а не быстрее бег. */
const MARQUEE_PX_PER_SEC = 42
const MARQUEE_DURATION_MIN_S = 16
const MARQUEE_DURATION_MAX_S = 420

type GameStatusTickerProps = {
  className?: string
  /** Показать кнопку «добавить объявление» (только при авторизации). */
  showAnnouncementCta?: boolean
  onOpenAnnouncement?: () => void
}

export function GameStatusTicker({ className, showAnnouncementCta, onOpenAnnouncement }: GameStatusTickerProps) {
  const { editorial, player } = useTickerFeed(12_000)

  const displayText = (player?.text ?? editorial?.text ?? "").trim()
  const linkUrl = player?.linkUrl?.trim() ?? ""

  const marqueeRef = useRef<HTMLDivElement>(null)
  const [marqueeDurationSec, setMarqueeDurationSec] = useState(34)

  const repeated = useMemo(() => `${displayText}   •   ${displayText}   •   ${displayText}   •   `, [displayText])

  useLayoutEffect(() => {
    const el = marqueeRef.current
    if (!el) return
    const measure = () => {
      const total = el.scrollWidth
      if (total <= 0) return
      const loopPx = total / 2
      const sec = loopPx / MARQUEE_PX_PER_SEC
      setMarqueeDurationSec(Math.min(MARQUEE_DURATION_MAX_S, Math.max(MARQUEE_DURATION_MIN_S, sec)))
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [repeated])

  if (!displayText) return null

  const marqueeInteractive = Boolean(linkUrl)
  const showPlus = Boolean(showAnnouncementCta && onOpenAnnouncement)

  const MarqueeInner = () => (
    <>
      <span className={cn("status-line-item pr-8", marqueeInteractive && "relative")}>{repeated}</span>
      <span className="status-line-item pr-8" aria-hidden>
        {repeated}
      </span>
    </>
  )

  return (
    <div
      className={cn(
        "status-board z-40 border border-cyan-300/30 bg-slate-950/90 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur",
        !marqueeInteractive && !showPlus && "pointer-events-none",
        className,
      )}
    >
      <div className="status-board-glow" />
      <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
        <span className="status-pill shrink-0 rounded border border-cyan-300/50 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
          Табло
        </span>
        <div
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden",
            marqueeInteractive && "cursor-pointer pointer-events-auto",
          )}
        >
          <div
            ref={marqueeRef}
            className="status-line-marquee status-line-text flex w-max whitespace-nowrap text-xs font-medium text-cyan-100 sm:text-sm"
            style={{ animationDuration: `${marqueeDurationSec}s` }}
          >
            {marqueeInteractive ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-max text-inherit no-underline hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <MarqueeInner />
              </a>
            ) : (
              <MarqueeInner />
            )}
          </div>
        </div>
        {showPlus ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenAnnouncement?.()
            }}
            className="pointer-events-auto shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-500/15 p-1.5 text-cyan-100 transition hover:bg-cyan-500/25"
            title="Добавить объявление в бегущую строку"
            aria-label="Добавить объявление"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <style jsx>{`
        .status-board {
          overflow: hidden;
          border-radius: 10px;
          position: relative;
        }
        .status-board-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at center, rgba(34, 211, 238, 0.08) 0, rgba(34, 211, 238, 0.08) 1px, transparent 1.2px) 0 0 / 8px 8px,
            linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(15, 23, 42, 0) 36%, rgba(34, 211, 238, 0.06) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.045) 0px,
              rgba(255, 255, 255, 0.045) 1px,
              rgba(0, 0, 0, 0) 1px,
              rgba(0, 0, 0, 0) 3px
            );
          animation: board-flicker 4.2s ease-in-out infinite;
          opacity: 0.92;
        }
        .status-pill {
          text-shadow: 0 0 10px rgba(103, 232, 249, 0.65);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 0 14px rgba(34, 211, 238, 0.28);
        }
        .status-line-text {
          font-family: "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          text-shadow:
            0 0 3px rgba(34, 211, 238, 0.8),
            0 0 8px rgba(34, 211, 238, 0.6),
            0 0 18px rgba(34, 211, 238, 0.25);
          color: #67e8f9;
          filter: saturate(1.15);
        }
        .status-line-item {
          position: relative;
        }
        .status-line-item::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at center, rgba(103, 232, 249, 0.4) 0, rgba(103, 232, 249, 0.4) 0.8px, transparent 1px)
            0 0 / 6px 6px;
          mix-blend-mode: screen;
          opacity: 0.45;
        }
        .status-line-marquee {
          animation-name: status-line-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        @keyframes board-flicker {
          0%,
          100% {
            opacity: 0.92;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes status-line-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
