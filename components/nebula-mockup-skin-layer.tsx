"use client"

import { useMemo, type CSSProperties } from "react"

/**
 * Фон для скина стола nebula_mockup: фиолетово-синий космос по макету,
 * локальное тёплое свечение у центра/низа (зона «Крутиться»), звёздное поле без ракет.
 */
export function NebulaMockupSkinLayer() {
  const nebulaStyle = useMemo(
    () =>
      ({
        background: [
          // Сверху слева — глубокий синий
          "radial-gradient(ellipse 85% 70% at 8% 12%, rgba(37, 99, 235, 0.22), transparent 52%)",
          // Справа сверху — индиго
          "radial-gradient(ellipse 65% 55% at 92% 8%, rgba(67, 56, 202, 0.17), transparent 50%)",
          // Центр-право — фиолетовая туманность
          "radial-gradient(ellipse 75% 60% at 72% 38%, rgba(124, 58, 237, 0.15), transparent 54%)",
          // Слева по центру — сине-фиолетовое пятно
          "radial-gradient(ellipse 60% 50% at 18% 52%, rgba(88, 28, 135, 0.13), transparent 50%)",
          // Снизу по центру — узкий янтарный акцент (кнопка «Крутиться»), без заливки всего низа
          "radial-gradient(ellipse 55% 38% at 50% 96%, rgba(245, 158, 11, 0.20), transparent 58%)",
          "linear-gradient(165deg, rgba(15, 23, 42, 0.52) 0%, rgba(30, 27, 75, 0.32) 38%, rgba(15, 23, 42, 0.58) 72%, rgba(9, 9, 26, 0.64) 100%)",
        ].join(", "),
      }) satisfies CSSProperties,
    [],
  )

  const starLayerCommon: CSSProperties = {
    mixBlendMode: "screen",
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden nebula-mockup-skin" aria-hidden>
      <div className="nebula-mockup-skin__glow absolute inset-0 animate-nebula-mockup-drift" style={nebulaStyle} />
      <div className="cosmic-stars-parallax absolute inset-0 scale-[1.02]">
        <div
          className="cosmic-stars-layer--a absolute inset-0"
          style={{
            ...starLayerCommon,
            backgroundImage:
              "radial-gradient(1.2px 1.2px at 10% 18%, rgba(240,249,255,0.92) 50%, transparent 52%), radial-gradient(1.1px 1.1px at 72% 36%, rgba(224,242,254,0.78) 50%, transparent 52%), radial-gradient(1.35px 1.35px at 32% 82%, rgba(255,237,213,0.45) 50%, transparent 52%), radial-gradient(1px 1px at 88% 14%, rgba(255,255,255,0.72) 50%, transparent 52%)",
            backgroundSize: "420px 420px, 520px 520px, 640px 640px, 380px 380px",
            backgroundPosition: "0 0, 120px 80px, 40px 200px, 200px 40px",
            opacity: 0.5,
          }}
        />
        <div
          className="cosmic-stars-layer--b absolute inset-0"
          style={{
            ...starLayerCommon,
            backgroundImage:
              "radial-gradient(1px 1px at 54% 26%, rgba(236,254,255,0.78) 50%, transparent 52%), radial-gradient(1.25px 1.25px at 20% 58%, rgba(191,219,254,0.72) 50%, transparent 52%), radial-gradient(0.95px 0.95px at 84% 76%, rgba(255,251,235,0.55) 50%, transparent 52%), radial-gradient(1.15px 1.15px at 44% 10%, rgba(199,210,254,0.68) 50%, transparent 52%)",
            backgroundSize: "480px 440px, 560px 600px, 360px 400px, 500px 480px",
            backgroundPosition: "90px 140px, 200px 30px, 60px 220px, 280px 180px",
            opacity: 0.38,
          }}
        />
        <div
          className="cosmic-stars-layer--c absolute inset-0"
          style={{
            ...starLayerCommon,
            backgroundImage:
              "radial-gradient(0.75px 0.75px at 26% 32%, rgba(255,255,255,0.85) 50%, transparent 55%), radial-gradient(0.65px 0.65px at 64% 52%, rgba(207,250,254,0.7) 50%, transparent 55%), radial-gradient(0.8px 0.8px at 86% 40%, rgba(224,231,255,0.68) 50%, transparent 55%), radial-gradient(0.7px 0.7px at 14% 86%, rgba(254,249,195,0.42) 50%, transparent 55%), radial-gradient(0.7px 0.7px at 48% 48%, rgba(255,255,255,0.48) 50%, transparent 55%)",
            backgroundSize: "320px 360px, 280px 300px, 400px 380px, 340px 320px, 520px 520px",
            backgroundPosition: "40px 60px, 180px 200px, 220px 100px, 100px 40px, 0 140px",
            opacity: 0.34,
          }}
        />
      </div>
      {/* Ореол под кольцом аватаров — чуть ярче, по макету */}
      <div
        className="absolute left-1/2 top-[42%] h-[min(85vw,520px)] w-[min(85vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.18]"
        style={{
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.42) 0%, rgba(245, 158, 11, 0.18) 38%, transparent 64%)",
          filter: "blur(32px)",
        }}
      />
    </div>
  )
}
