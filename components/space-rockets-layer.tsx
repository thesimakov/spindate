"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { assetUrl } from "@/lib/assets"

const ROCKET_SPRITES = [
  assetUrl("/assets/space-rocket-1.png"),
  assetUrl("/assets/space-rocket-2.png"),
  assetUrl("/assets/space-rocket-3.png"),
  assetUrl("/assets/space-rocket-4.png"),
  assetUrl("/assets/space-rocket-5.png"),
] as const

type FlyingRocket = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  deg: number
  src: string
  size: number
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Угол CSS rotate (°): верх PNG (нос «вверх» экрана, −Y) совпадает с (vx, vy); Y растёт вниз. */
function rotationDegForVelocity(vx: number, vy: number) {
  return (Math.atan2(vx, -vy) * 180) / Math.PI
}

export function SpaceRocketsLayer() {
  const [rockets, setRockets] = useState<FlyingRocket[]>([])
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const rocketsRef = useRef<FlyingRocket[]>([])
  const sizeRef = useRef({ w: 1, h: 1 })
  const nextIdRef = useRef(1)
  const randRef = useRef(mulberry32(Date.now() % 2147483647))

  const spawnRocket = () => {
    const rand = randRef.current
    const { w, h } = sizeRef.current
    if (w < 32 || h < 32) return

    const src = ROCKET_SPRITES[Math.floor(rand() * ROCKET_SPRITES.length)] ?? ROCKET_SPRITES[0]
    const speed = 60 + rand() * 110
    const angleRad = rand() * Math.PI * 2
    const vx = Math.cos(angleRad) * speed
    const vy = Math.sin(angleRad) * speed

    const margin = 40
    const x = -margin + rand() * (w + margin * 2)
    const y = -margin + rand() * (h + margin * 2)

    const deg = rotationDegForVelocity(vx, vy)

    const size = 28 + rand() * 34

    const rocket: FlyingRocket = {
      id: nextIdRef.current++,
      x,
      y,
      vx,
      vy,
      deg,
      src,
      size,
    }

    rocketsRef.current = [...rocketsRef.current, rocket]
    setRockets(rocketsRef.current)
  }

  useEffect(() => {
    const el = document.getElementById("space-rockets-root")
    if (!el) return

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    sizeRef.current = { w: rect.width, h: rect.height }

    const tick = (ts: number) => {
      const last = lastTsRef.current
      lastTsRef.current = ts
      const dt = last == null ? 0 : Math.min(0.05, (ts - last) / 1000)

      if (dt > 0) {
        const { w, h } = sizeRef.current
        const pad = 120
        const next: FlyingRocket[] = []
        for (const r of rocketsRef.current) {
          const nx = r.x + r.vx * dt
          const ny = r.y + r.vy * dt
          if (nx > -pad && nx < w + pad && ny > -pad && ny < h + pad) {
            next.push({ ...r, x: nx, y: ny })
          }
        }
        rocketsRef.current = next
        setRockets(next)
      }

      const rand = randRef.current
      if (rand() < 0.018) spawnRocket()

      rafRef.current = window.requestAnimationFrame(tick)
    }

    rafRef.current = window.requestAnimationFrame(tick)
    for (let i = 0; i < 6; i++) spawnRocket()

    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useMemo(
    () => ({
      background:
        "radial-gradient(1200px 700px at 50% 20%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(900px 500px at 20% 80%, rgba(147,51,234,0.12), transparent 55%), radial-gradient(800px 520px at 85% 70%, rgba(244,63,94,0.08), transparent 55%), linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(15,23,42,0.35) 45%, rgba(2,6,23,0.62) 100%)",
    }),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={style} />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "radial-gradient(1.2px 1.2px at 10% 20%, rgba(255,255,255,0.85) 50%, transparent 52%), radial-gradient(1.1px 1.1px at 70% 40%, rgba(255,255,255,0.75) 50%, transparent 52%), radial-gradient(1.4px 1.4px at 30% 80%, rgba(255,255,255,0.65) 50%, transparent 52%), radial-gradient(1px 1px at 90% 15%, rgba(255,255,255,0.55) 50%, transparent 52%)",
          backgroundSize: "420px 420px, 520px 520px, 640px 640px, 380px 380px",
          backgroundPosition: "0 0, 120px 80px, 40px 200px, 200px 40px",
          mixBlendMode: "screen",
        }}
      />
      <div id="space-rockets-root" className="absolute inset-0">
        {rockets.map((r) => (
          <img
            key={r.id}
            src={r.src}
            alt=""
            draggable={false}
            className="absolute select-none will-change-transform"
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
              transform: `translate(-50%, -50%) rotate(${r.deg}deg)`,
              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.55))",
              opacity: 0.92,
            }}
          />
        ))}
      </div>
    </div>
  )
}
