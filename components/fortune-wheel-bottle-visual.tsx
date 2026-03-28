"use client"

import { useId, type CSSProperties } from "react"

const CX = 60
const CY = 60
const R = 50

const SEGMENT_COLORS = [
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#6366f1",
  "#ec4899",
  "#a855f7",
  "#ef4444",
]

function useFilterId() {
  return useId().replace(/:/g, "")
}

function clampSegmentCount(n: number | undefined): number {
  if (n == null || n < 1) return 8
  return Math.min(48, n)
}

/** Статичное колесо (сегменты + обод), без стрелки. Число секторов = числу игроков за столом. */
export function FortuneWheelStatic({
  className,
  segmentCount: rawCount,
}: {
  className?: string
  /** Сколько цветных секторов (обычно = число игроков). По умолчанию 8. */
  segmentCount?: number
}) {
  const filterId = useFilterId()
  const n = clampSegmentCount(rawCount)
  const slice = (2 * Math.PI) / n
  const strokeW = n > 16 ? 1 : 1.5
  const periodSec = Math.max(1.25, n * 0.13)

  const segStyle = (i: number): CSSProperties =>
    ({
      "--fw-period": `${periodSec}s`,
      "--fw-delay": `${(i / n) * periodSec}s`,
    }) as CSSProperties

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.45" />
        </filter>
      </defs>
      <ellipse cx="60" cy="112" rx="22" ry="5.5" fill="#020617" opacity="0.55" />
      <g filter={`url(#${filterId})`}>
        <circle cx={CX} cy={CY} r={R + 2} fill="#0f172a" />
      </g>

      <g>
        {n === 1 ? (
          <circle
            className="fortune-wheel-seg"
            style={segStyle(0)}
            cx={CX}
            cy={CY}
            r={R}
            fill={SEGMENT_COLORS[0]}
            stroke="#0f172a"
            strokeWidth={strokeW}
          />
        ) : (
          // −180/n°: центр сектора i совпадает с аватаром i (circlePositions: игрок 0 сверху).
          <g transform={`rotate(${-180 / n}, ${CX}, ${CY})`}>
            {Array.from({ length: n }, (_, i) => {
              const fill = SEGMENT_COLORS[i % SEGMENT_COLORS.length]
              const a0 = i * slice - Math.PI / 2
              const a1 = (i + 1) * slice - Math.PI / 2
              const x0 = CX + R * Math.cos(a0)
              const y0 = CY + R * Math.sin(a0)
              const x1 = CX + R * Math.cos(a1)
              const y1 = CY + R * Math.sin(a1)
              const largeArc = slice > Math.PI ? 1 : 0
              return (
                <path
                  key={i}
                  className="fortune-wheel-seg"
                  style={segStyle(i)}
                  d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`}
                  fill={fill}
                  stroke="#0f172a"
                  strokeWidth={strokeW}
                />
              )
            })}
          </g>
        )}
      </g>

      <g filter={`url(#${filterId})`}>
        <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.95" />
      </g>
    </svg>
  )
}

/** Стрелка-указатель и ось (крутится с углом бутылочки поверх статичного колеса) */
export function FortuneWheelArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g>
        <path
          d="M 60 12 L 50 58 L 70 58 Z"
          fill="#fde047"
          stroke="#ca8a04"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M 60 18 L 54 52 L 66 52 Z" fill="#fef9c3" opacity="0.9" />
      </g>
      <circle cx={CX} cy={CY} r="12" fill="#1e293b" stroke="#fbbf24" strokeWidth="2.5" />
      <circle cx={CX} cy={CY} r="5" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
    </svg>
  )
}

/** Превью в каталоге: статичное колесо + стрелка вверх (без игрового угла) */
export function FortuneWheelBottleVisual({
  className,
  segmentCount,
}: {
  className?: string
  segmentCount?: number
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <FortuneWheelStatic className="h-full w-full" segmentCount={segmentCount} />
      <div className="pointer-events-none absolute inset-0">
        <FortuneWheelArrow className="h-full w-full" />
      </div>
    </div>
  )
}
