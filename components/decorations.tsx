"use client"

export function StringLights() {
  const bulbCount = 12
  const colors = ["#ff5252", "#ffb020", "#2ecc71", "#3498db"]

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 w-full"
      height="42"
      viewBox="0 0 800 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Тонкая верхняя полоска-крепление */}
      <rect x="-40" y="0" width="880" height="4" fill="#7a2619" opacity="0.9" />

      {/* Одно простое провисание провода */}
      <path
        d="M-40 8 C 140 28, 320 4, 480 24 S 720 6, 840 20"
        stroke="#7a2619"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Лампочки в стилистике примера */}
      {Array.from({ length: bulbCount }, (_, i) => {
        const t = (i + 1) / (bulbCount + 1)
        const x = 40 + t * 720
        const baseY = 24 + (i % 2 === 0 ? 2 : -1)
        const color = colors[i % colors.length]
        const duration = 1.6 + (i % 3) * 0.4
        const delay = i * 0.15
        return (
          <g key={i}>
            {/* Короткий подвес */}
            <path
              d={`M${x} 4 L ${x} ${baseY - 10}`}
              stroke="#7a2619"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Патрон */}
            <rect
              x={x - 6}
              y={baseY - 10}
              width="12"
              height="7"
              rx="2"
              fill="#7a2619"
            />
            {/* Лампочка - капля */}
            <path
              d={`
                M ${x} ${baseY - 9}
                C ${x - 7} ${baseY - 3}, ${x - 5} ${baseY + 9}, ${x} ${baseY + 12}
                C ${x + 5} ${baseY + 9}, ${x + 7} ${baseY - 3}, ${x} ${baseY - 9}
              `}
              fill={color}
              style={{
                animation: `shimmer ${duration}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function Candle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="32"
      viewBox="0 0 20 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Candle body */}
      <rect x="6" y="14" width="8" height="16" rx="1" fill="#f5e6c8" />
      <rect x="6" y="14" width="8" height="16" rx="1" fill="url(#candleShine)" opacity="0.3" />
      {/* Wick */}
      <line x1="10" y1="8" x2="10" y2="14" stroke="#4a3520" strokeWidth="1" />
      {/* Flame */}
      <ellipse
        cx="10"
        cy="6"
        rx="3"
        ry="5"
        fill="#ffaa00"
        style={{ animation: "flicker 1.2s ease-in-out infinite" }}
      />
      <ellipse
        cx="10"
        cy="6"
        rx="1.5"
        ry="3"
        fill="#ffee88"
        style={{ animation: "flicker 0.8s ease-in-out infinite" }}
      />
      {/* Glow */}
      <ellipse cx="10" cy="6" rx="6" ry="8" fill="#ffaa00" opacity="0.15" />
      <defs>
        <linearGradient id="candleShine" x1="6" y1="14" x2="14" y2="14">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function TableDecorations() {
  return (
    null
  )
}
