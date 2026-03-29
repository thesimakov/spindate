"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PointerEvent,
} from "react"
import { FortuneWheelBottleVisual } from "@/components/fortune-wheel-bottle-visual"
import { assetUrl, BOTTLE_IMAGES } from "@/lib/assets"
import { generateLogId } from "@/lib/game-context"
import type { BottleSkin, GameAction, Player } from "@/lib/game-types"
import { cn } from "@/lib/utils"

const BOTTLE_CATALOG_SKINS: Array<{
  id: BottleSkin
  name: string
  img: string
  cost: number
}> = [
  { id: "classic", name: "Классическая", img: assetUrl(BOTTLE_IMAGES.classic), cost: 0 },
  { id: "ruby", name: "Лимонад", img: assetUrl(BOTTLE_IMAGES.ruby), cost: 5 },
  { id: "neon", name: "Виски", img: assetUrl(BOTTLE_IMAGES.neon), cost: 5 },
  { id: "frost", name: "Шампанское", img: assetUrl(BOTTLE_IMAGES.frost), cost: 5 },
  { id: "baby", name: "Детская", img: assetUrl(BOTTLE_IMAGES.baby), cost: 5 },
  { id: "vip", name: "VIP-бутылка", img: assetUrl(BOTTLE_IMAGES.vip), cost: 5 },
  { id: "milk", name: "Молочная", img: assetUrl(BOTTLE_IMAGES.milk), cost: 5 },
  { id: "frame_69", name: "Бутылочка 69", img: assetUrl(BOTTLE_IMAGES.frame_69), cost: 5 },
  { id: "frame_70", name: "Бутылочка 70", img: assetUrl(BOTTLE_IMAGES.frame_70), cost: 5 },
  { id: "frame_71", name: "Бутылочка 71", img: assetUrl(BOTTLE_IMAGES.frame_71), cost: 5 },
  { id: "frame_72", name: "Бутылочка 72", img: assetUrl(BOTTLE_IMAGES.frame_72), cost: 5 },
  { id: "frame_73", name: "Бутылочка 73", img: assetUrl(BOTTLE_IMAGES.frame_73), cost: 5 },
  { id: "frame_74", name: "Бутылочка 74", img: assetUrl(BOTTLE_IMAGES.frame_74), cost: 5 },
  { id: "frame_75", name: "Бутылочка 75", img: assetUrl(BOTTLE_IMAGES.frame_75), cost: 5 },
  { id: "frame_76", name: "Бутылочка 76", img: assetUrl(BOTTLE_IMAGES.frame_76), cost: 5 },
  { id: "frame_77", name: "Бутылочка 77", img: assetUrl(BOTTLE_IMAGES.frame_77), cost: 5 },
  { id: "frame_78", name: "Бутылочка 78", img: assetUrl(BOTTLE_IMAGES.frame_78), cost: 5 },
  { id: "frame_79", name: "Бутылочка 79", img: assetUrl(BOTTLE_IMAGES.frame_79), cost: 5 },
  { id: "frame_80", name: "Бутылочка 80", img: assetUrl(BOTTLE_IMAGES.frame_80), cost: 5 },
  { id: "fortune_wheel", name: "Колесо фортуны", img: "", cost: 300 },
]

function formatCooldown(ms: number) {
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export type BottleCatalogModalProps = {
  onClose: () => void
  isPcLayout: boolean
  players: Player[]
  ownedBottleSkins: BottleSkin[] | undefined
  bottleSkin: BottleSkin | undefined
  voiceBalance: number
  bottleCooldownUntil: number | null | undefined
  currentUser: Player | null
  dispatch: Dispatch<GameAction>
  showToast: (message: string, variant: "success" | "error" | "info") => void
}

export function BottleCatalogModal({
  onClose,
  isPcLayout,
  players,
  ownedBottleSkins,
  bottleSkin,
  voiceBalance,
  bottleCooldownUntil,
  currentUser,
  dispatch,
  showToast,
}: BottleCatalogModalProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const cooldownLeftMs = useMemo(() => {
    if (!bottleCooldownUntil) return 0
    return Math.max(0, bottleCooldownUntil - Date.now())
  }, [bottleCooldownUntil, tick])

  const handleBackdropPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const ownedSet = useMemo(() => new Set(ownedBottleSkins ?? ["classic"]), [ownedBottleSkins])

  const isClassicId = (id: BottleSkin) => id === "classic"
  const isVipId = (id: BottleSkin) => id === "vip"
  const isPremiumFortuneId = (id: BottleSkin) => id === "fortune_wheel"

  const entries = useMemo(() => {
    return BOTTLE_CATALOG_SKINS.map((skin) => {
      const owned = ownedSet.has(skin.id)
      const selected = bottleSkin === skin.id
      const cooldownActive = cooldownLeftMs > 0
      const purchaseLocked = cooldownActive && !owned && !isClassicId(skin.id)
      const notEnough = !owned && !isClassicId(skin.id) && voiceBalance < skin.cost
      const disabled = purchaseLocked || notEnough

      const status = owned
        ? selected
          ? "Выбрано"
          : "Куплено"
        : isClassicId(skin.id)
          ? "Бесплатно"
          : purchaseLocked
            ? `Через ${formatCooldown(cooldownLeftMs)}`
            : `${skin.cost} ❤`

      const handleClick = () => {
        if (owned || isClassicId(skin.id)) {
          dispatch({ type: "SET_BOTTLE_SKIN", skin: skin.id })
          return
        }
        if (purchaseLocked) {
          showToast(`Следующая покупка через ${formatCooldown(cooldownLeftMs)}`, "info")
          return
        }
        if (voiceBalance < skin.cost) {
          showToast("Недостаточно сердец", "error")
          return
        }
        dispatch({ type: "PAY_VOICES", amount: skin.cost })
        dispatch({ type: "SET_BOTTLE_SKIN", skin: skin.id })
        dispatch({ type: "SET_BOTTLE_COOLDOWN_UNTIL", ts: Date.now() + 30 * 60 * 1000 })
        if (currentUser) {
          dispatch({ type: "SET_BOTTLE_DONOR", playerId: currentUser.id, playerName: currentUser.name })
          dispatch({
            type: "ADD_LOG",
            entry: {
              id: generateLogId(),
              type: "system",
              fromPlayer: currentUser,
              text: `${currentUser.name} купил(а) бутылочку «${skin.name}»`,
              timestamp: Date.now(),
            },
          })
        }
        showToast("Бутылочка куплена", "success")
      }

      return { skin, owned, selected, disabled, notEnough, purchaseLocked, status, handleClick }
    })
  }, [
    ownedSet,
    bottleSkin,
    cooldownLeftMs,
    voiceBalance,
    dispatch,
    showToast,
    currentUser,
  ])

  const free = entries.filter((e) => isClassicId(e.skin.id))
  const vip = entries.filter((e) => isVipId(e.skin.id))
  const premium = entries.filter((e) => isPremiumFortuneId(e.skin.id))
  const rest = entries.filter((e) => !isClassicId(e.skin.id) && !isVipId(e.skin.id) && !isPremiumFortuneId(e.skin.id))

  const Section = ({ title, items }: { title: string; items: typeof entries }) => (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{title}</span>
        <div className="h-px flex-1" style={{ background: "rgba(148,163,184,0.18)" }} />
      </div>
      <div
        className={cn(
          "grid gap-3",
          isPcLayout ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        )}
      >
        {items.map((e) => {
          const ring = e.selected ? "ring-2 ring-amber-400" : "ring-1 ring-slate-700/40"
          const dim = e.disabled && !e.owned && e.skin.id !== "classic" ? "opacity-55" : ""
          const badgeTone = e.selected
            ? { background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" }
            : e.owned
              ? { background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.22)", color: "#bae6fd" }
              : e.purchaseLocked
                ? { background: "rgba(148,163,184,0.10)", border: "1px solid rgba(148,163,184,0.18)", color: "#cbd5e1" }
                : e.notEnough
                  ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "#fecaca" }
                  : { background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.20)", color: "#fda4af" }

          const ctaLabel = e.selected
            ? "На столу"
            : e.purchaseLocked
              ? `Подать через ${formatCooldown(cooldownLeftMs)}`
              : e.notEnough
                ? "Недостаточно ❤"
                : "Подать на стол"

          return (
            <div
              key={e.skin.id}
              className={`group relative flex min-w-0 flex-col items-stretch rounded-2xl px-3 pb-3 pt-3 text-left ${ring} ${dim}`}
              style={{
                background: "linear-gradient(180deg, rgba(30,41,59,0.30) 0%, rgba(15,23,42,0.18) 100%)",
              }}
            >
              <div
                className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl"
                style={{ background: "radial-gradient(circle at 50% 35%, rgba(251,191,36,0.10) 0%, transparent 60%)" }}
              >
                {e.skin.id === "fortune_wheel" ? (
                  <FortuneWheelBottleVisual
                    segmentCount={players.length > 0 ? players.length : 8}
                    className="h-full w-full max-h-[96px] object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)] pointer-events-none select-none"
                  />
                ) : (
                  <img
                    src={e.skin.img}
                    alt={e.skin.name}
                    className="h-full w-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)] pointer-events-none select-none"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                )}
              </div>

              <div className="mt-2 w-full min-w-0">
                <p className="truncate text-center text-[12px] font-extrabold text-amber-100 sm:text-[13px]">{e.skin.name}</p>
                <div className="mt-1 flex items-center justify-center">
                  <span className="rounded-full px-2.5 py-1 text-xs font-extrabold tracking-tight sm:text-sm" style={badgeTone}>
                    {e.status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => e.handleClick()}
                disabled={e.disabled || e.selected}
                className={
                  "mt-2 w-full touch-manipulation rounded-xl px-2 py-2.5 text-center text-[11px] font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 " +
                  (e.selected
                    ? "border border-emerald-500/35 bg-emerald-950/40 text-emerald-200"
                    : e.disabled
                      ? "border border-slate-600/50 bg-slate-900/80 text-slate-500"
                      : "border border-amber-500/40 text-amber-950 shadow-[0_6px_16px_rgba(251,191,36,0.22)] hover:brightness-110")
                }
                style={
                  e.selected || e.disabled
                    ? undefined
                    : { background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #d97706 100%)" }
                }
              >
                {ctaLabel}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
      role="presentation"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border p-0 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(19,10,4,0.98) 0%, rgba(8,6,4,0.98) 100%)",
          borderColor: "rgba(251, 191, 36, 0.22)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottle-catalog-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "rgba(148, 163, 184, 0.14)", background: "rgba(12, 10, 8, 0.98)" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span id="bottle-catalog-title" className="text-[13px] font-extrabold tracking-wide text-amber-100 sm:text-sm">
                Каталог бутылочек
              </span>
              {cooldownLeftMs > 0 && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-200/90"
                  style={{ background: "rgba(251, 191, 36, 0.12)", border: "1px solid rgba(251, 191, 36, 0.25)" }}
                >
                  Покупка: {formatCooldown(cooldownLeftMs)}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[12px] font-semibold text-amber-200/75 sm:text-[13px]">Выберите бутылочку для стола</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold transition hover:brightness-110 active:scale-[0.99]"
            style={{ border: "1px solid rgba(148,163,184,0.35)", color: "#f0e0c8", background: "rgba(15,23,42,0.12)" }}
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <Section title="Бесплатно" items={free} />
          <Section title="Доступно" items={rest} />
          <Section title="VIP" items={vip} />
          <Section title="Премиум" items={premium} />
        </div>
      </div>
    </div>
  )
}
