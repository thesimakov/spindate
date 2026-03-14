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
    <>
      {/* В киберпанк-столе убираем «казино»-декор, оставляем только пару неоновых акцентов при необходимости */}
      <svg
        className="pointer-events-none absolute bottom-[18%] left-[15%] rotate-[-15deg] opacity-60"
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="28" height="36" rx="3" fill="#fff" />
        <rect x="1" y="1" width="26" height="34" rx="2" stroke="#ddd" strokeWidth="0.5" fill="none" />
        <text x="4" y="12" fontSize="8" fill="#c0392b" fontFamily="serif">{"A"}</text>
        <text x="14" y="24" fontSize="12" fill="#c0392b" fontFamily="serif">{"♥"}</text>
      </svg>
      <svg
        className="pointer-events-none absolute bottom-[20%] left-[17%] rotate-[8deg] opacity-50"
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="28" height="36" rx="3" fill="#fff" />
        <rect x="1" y="1" width="26" height="34" rx="2" stroke="#ddd" strokeWidth="0.5" fill="none" />
        <text x="4" y="12" fontSize="8" fill="#222" fontFamily="serif">{"K"}</text>
        <text x="14" y="24" fontSize="12" fill="#222" fontFamily="serif">{"♠"}</text>
      </svg>

      {/* Dice */}
      <svg
        className="pointer-events-none absolute bottom-[25%] left-[8%] rotate-[12deg] opacity-55"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="18" height="18" rx="3" fill="#f5f0e8" />
        <circle cx="5" cy="5" r="1.5" fill="#c0392b" />
        <circle cx="13" cy="5" r="1.5" fill="#c0392b" />
        <circle cx="5" cy="13" r="1.5" fill="#c0392b" />
        <circle cx="13" cy="13" r="1.5" fill="#c0392b" />
        <circle cx="9" cy="9" r="1.5" fill="#c0392b" />
      </svg>

      {/* Poker chips cluster */}
      <svg
        className="pointer-events-none absolute top-[15%] right-[12%] opacity-50"
        width="30"
        height="25"
        viewBox="0 0 30 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="10" cy="15" rx="8" ry="5" fill="#c0392b" />
        <ellipse cx="10" cy="14" rx="8" ry="5" fill="#e74c3c" />
        <ellipse cx="20" cy="13" rx="8" ry="5" fill="#2980b9" />
        <ellipse cx="20" cy="12" rx="8" ry="5" fill="#3498db" />
        <ellipse cx="15" cy="10" rx="8" ry="5" fill="#27ae60" />
        <ellipse cx="15" cy="9" rx="8" ry="5" fill="#2ecc71" />
      </svg>

      {/* Small notepad */}
      <svg
        className="pointer-events-none absolute bottom-[12%] right-[10%] rotate-[5deg] opacity-45"
        width="24"
        height="28"
        viewBox="0 0 24 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="24" rx="1" fill="#fdf5e0" />
        <line x1="6" y1="8" x2="18" y2="8" stroke="#ccc" strokeWidth="0.5" />
        <line x1="6" y1="12" x2="18" y2="12" stroke="#ccc" strokeWidth="0.5" />
        <line x1="6" y1="16" x2="18" y2="16" stroke="#ccc" strokeWidth="0.5" />
        <line x1="6" y1="20" x2="14" y2="20" stroke="#ccc" strokeWidth="0.5" />
      </svg>

      {/* Pencil */}
      <svg
        className="pointer-events-none absolute bottom-[15%] right-[7%] rotate-[35deg] opacity-40"
        width="6"
        height="32"
        viewBox="0 0 6 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect y="4" width="6" height="24" rx="1" fill="#2ecc71" />
        <polygon points="0,28 6,28 3,32" fill="#f5d6a8" />
        <rect y="0" width="6" height="4" rx="1" fill="#e8c06a" />
      </svg>
    </>
  )
}
