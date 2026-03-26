"use client"

import { useState, useEffect } from "react"
import { assetUrl, BOTTLE_IMAGES } from "@/lib/assets"

interface BottleProps {
  angle: number
  isSpinning: boolean
  skin?:
    | "classic"
    | "ruby"
    | "neon"
    | "frost"
    | "baby"
    | "vip"
    | "milk"
    | "frame_69"
    | "frame_70"
    | "frame_71"
    | "frame_72"
    | "frame_73"
    | "frame_74"
    | "frame_75"
    | "frame_76"
    | "frame_77"
    | "frame_78"
    | "frame_79"
    | "frame_80"
  isDrunk?: boolean
}

export function Bottle({ angle, isSpinning, skin = "classic", isDrunk = false }: BottleProps) {
  const [imgError, setImgError] = useState(false)

  const skinToImg: Record<NonNullable<BottleProps["skin"]>, string> = {
    classic: assetUrl(BOTTLE_IMAGES.classic),
    ruby: assetUrl(BOTTLE_IMAGES.ruby),
    neon: assetUrl(BOTTLE_IMAGES.neon),
    frost: assetUrl(BOTTLE_IMAGES.frost),
    baby: assetUrl(BOTTLE_IMAGES.baby),
    vip: assetUrl(BOTTLE_IMAGES.vip),
    milk: assetUrl(BOTTLE_IMAGES.milk),
    frame_69: assetUrl(BOTTLE_IMAGES.frame_69),
    frame_70: assetUrl(BOTTLE_IMAGES.frame_70),
    frame_71: assetUrl(BOTTLE_IMAGES.frame_71),
    frame_72: assetUrl(BOTTLE_IMAGES.frame_72),
    frame_73: assetUrl(BOTTLE_IMAGES.frame_73),
    frame_74: assetUrl(BOTTLE_IMAGES.frame_74),
    frame_75: assetUrl(BOTTLE_IMAGES.frame_75),
    frame_76: assetUrl(BOTTLE_IMAGES.frame_76),
    frame_77: assetUrl(BOTTLE_IMAGES.frame_77),
    frame_78: assetUrl(BOTTLE_IMAGES.frame_78),
    frame_79: assetUrl(BOTTLE_IMAGES.frame_79),
    frame_80: assetUrl(BOTTLE_IMAGES.frame_80),
  }

  const imgSrc = skinToImg[skin]
  useEffect(() => {
    setImgError(false)
  }, [skin, imgSrc])

  return (
    <div
      className={`relative flex items-center justify-center ${!isSpinning && !isDrunk ? "bottle-idle-float" : ""}`}
      style={
        isDrunk
          ? {
              animation: "bottleDrunk 0.6s ease-in-out infinite alternate",
            }
          : undefined
      }
    >
      <div
        style={{
          transform: `rotate(${angle}deg)`,
          transition: isSpinning
            ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
            : "none",
          filter: isSpinning ? "drop-shadow(0 0 12px rgba(74, 154, 53, 0.6))" : "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
          opacity: 1,
        }}
      >
        {/* Реальная бутылочка из файла (адаптивный размер, без прозрачности) */}
        <div
          className="h-20 w-20 sm:h-[120px] sm:w-[120px] md:h-[150px] md:w-[150px]"
          style={{
            display: imgError ? "none" : undefined,
            opacity: 1,
            background: "transparent",
          }}
        >
          { }
          <img
            key={skin}
            src={imgSrc}
            alt="Бутылочка"
            className="h-full w-full object-contain"
            style={{ opacity: 1 }}
            draggable={false}
            loading="eager"
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth === 0 || img.naturalHeight === 0) setImgError(true)
              else setImgError(false)
            }}
            onError={() => setImgError(true)}
          />
        </div>

        {/* SVG показываем при ошибке загрузки картинки или как фолбек */}
        <svg
          className="h-20 w-20 sm:h-[120px] sm:w-[120px] md:h-[150px] md:w-[150px]"
          style={{ display: imgError ? "block" : "none" }}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Бутылочка"
        >
          {/* Shadow on table */}
          <ellipse cx="60" cy="113" rx="18" ry="5" fill="#020617" opacity="0.6" />

          {/* Cap/Cork top */}
          <rect x="56" y="2" width="8" height="6" rx="2" fill="#1a4010" />
          <rect x="55" y="6" width="10" height="3" rx="1" fill="#2d5a1e" />

          {/* Neck */}
          <rect
            x="55.5"
            y="9"
            width="9"
            height="26"
            rx="3.5"
            fill={
              skin === "neon"
                ? "#0ea5e9"
                : skin === "baby" || skin === "milk"
                  ? "#facc15"
                  : skin === "vip"
                    ? "#fbbf24"
                    : "url(#neckGrad)"
            }
          />

          {/* Neck-to-body transition */}
          <path d="M54 35 Q53 42 46 52 L74 52 Q67 42 66 35 Z" fill="url(#neckGrad)" />

          {/* Body */}
          <rect x="40" y="52" width="40" height="28" rx="6" fill={`url(#bodyGrad_${skin ?? "classic"})`} />
          <ellipse cx="60" cy="82" rx="22" ry="30" fill={`url(#bodyGrad_${skin ?? "classic"})`} />

          {/* Label */}
          <rect x="46" y="60" width="28" height="18" rx="2" fill="#f5e6c8" opacity="0.15" />

          {/* Glass shine highlight left */}
          <path
            d="M46 50 Q44 65 46 100"
            stroke="#7acc6a"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M48 55 Q47 65 48 90"
            stroke="#a0e890"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.2"
          />

          {/* Glass shine highlight right subtle */}
          <path
            d="M72 55 Q73 68 72 88"
            stroke="#5aaa48"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.2"
          />

          {/* Top neck shine */}
          <ellipse cx="58" cy="18" rx="1.5" ry="6" fill="#a0e890" opacity="0.25" />

          {/* Bright spot near top */}
          <ellipse cx="52" cy="62" rx="3" ry="7" fill="#a0e890" opacity="0.2" />

          <defs>
            <linearGradient id="neckGrad" x1="54" y1="9" x2="67" y2="9" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2d5a1e" />
              <stop offset="0.3" stopColor="#3a7a28" />
              <stop offset="0.6" stopColor="#4a9a35" />
              <stop offset="1" stopColor="#2d5a1e" />
            </linearGradient>
            {/* classic green / стандарт */}
            <linearGradient id="bodyGrad_classic" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1e4a14" />
              <stop offset="0.2" stopColor="#2d6a1e" />
              <stop offset="0.45" stopColor="#3a8a28" />
              <stop offset="0.65" stopColor="#4a9a35" />
              <stop offset="0.85" stopColor="#3a7a28" />
              <stop offset="1" stopColor="#1e4a14" />
            </linearGradient>
            {/* ruby / лимонад (янтарный) */}
            <linearGradient id="bodyGrad_ruby" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7f1d1d" />
              <stop offset="0.2" stopColor="#b91c1c" />
              <stop offset="0.45" stopColor="#dc2626" />
              <stop offset="0.65" stopColor="#ef4444" />
              <stop offset="0.85" stopColor="#be123c" />
              <stop offset="1" stopColor="#7f1d1d" />
            </linearGradient>
            {/* neon blue / виски */}
            <linearGradient id="bodyGrad_neon" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#022c5f" />
              <stop offset="0.2" stopColor="#0369a1" />
              <stop offset="0.45" stopColor="#0ea5e9" />
              <stop offset="0.65" stopColor="#38bdf8" />
              <stop offset="0.85" stopColor="#0ea5e9" />
              <stop offset="1" stopColor="#022c5f" />
            </linearGradient>
            {/* frost / шампанское */}
            <linearGradient id="bodyGrad_frost" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#e5e7eb" />
              <stop offset="0.2" stopColor="#f3f4f6" />
              <stop offset="0.45" stopColor="#ffffff" />
              <stop offset="0.65" stopColor="#e5e7eb" />
              <stop offset="0.85" stopColor="#d1d5db" />
              <stop offset="1" stopColor="#9ca3af" />
            </linearGradient>
            {/* baby bottle — мягкий молочный */}
            <linearGradient id="bodyGrad_baby" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fef9c3" />
              <stop offset="0.3" stopColor="#fef3c7" />
              <stop offset="0.6" stopColor="#fde68a" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
            {/* vip bottle — тёмная с золотым бликом */}
            <linearGradient id="bodyGrad_vip" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#1f2937" />
              <stop offset="0.3" stopColor="#111827" />
              <stop offset="0.6" stopColor="#4b5563" />
              <stop offset="1" stopColor="#facc15" />
            </linearGradient>
            {/* milk bottle — холодное стекло */}
            <linearGradient id="bodyGrad_milk" x1="38" y1="50" x2="82" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#e5f4ff" />
              <stop offset="0.3" stopColor="#dbeafe" />
              <stop offset="0.6" stopColor="#bfdbfe" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Spin glow ring */}
      {isSpinning && (
        <div
          className="pointer-events-none absolute inset-[-8px] animate-pulse rounded-full"
          style={{
            border: "2px solid rgba(74, 154, 53, 0.3)",
            boxShadow: "0 0 20px rgba(74, 154, 53, 0.2)",
          }}
        />
      )}
    </div>
  )
}
