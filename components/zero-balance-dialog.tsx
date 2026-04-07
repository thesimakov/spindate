"use client"

import { useEffect, useState } from "react"
import { Coins, Heart, Wallet } from "lucide-react"
import { useGame } from "@/lib/game-context"
import { setVkPersistentBannerSuppressedForOverlay } from "@/lib/vk-bridge"

/**
 * Окно «не хватает средств» при нулевом балансе сердец за столом.
 * Пока баланс 0 — один раз за «цикл» (пока не закроют или не пополнят).
 */
export function ZeroBalanceDialog() {
  const { state, dispatch } = useGame()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (state.voiceBalance > 0) setDismissed(false)
  }, [state.voiceBalance])

  const open =
    state.screen === "game" &&
    state.currentUser != null &&
    state.voiceBalance === 0 &&
    !dismissed &&
    state.gameSidePanel == null

  useEffect(() => {
    if (!open) return
    setVkPersistentBannerSuppressedForOverlay("zero-balance-dialog", true)
    return () => setVkPersistentBannerSuppressedForOverlay("zero-balance-dialog", false)
  }, [open])

  if (!open) return null

  const goShop = () => {
    setDismissed(true)
    dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
  }

  const goBack = () => setDismissed(true)

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Закрыть"
        onClick={goBack}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="zero-balance-title"
        aria-describedby="zero-balance-desc"
        className="relative z-10 w-full max-w-[min(100%,20rem)] rounded-[2rem] bg-white px-6 pb-6 pt-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2
          id="zero-balance-title"
          className="text-center text-xl font-extrabold leading-tight text-[#4c1d95] sm:text-[1.35rem]"
        >
          Не хватает сердец
        </h2>

        <div className="relative mx-auto mt-5 flex h-[9.5rem] w-full max-w-[220px] items-end justify-center gap-1">
          <div
            className="absolute inset-x-0 top-0 h-24 rounded-full bg-gradient-to-b from-amber-100/90 to-amber-50/30 blur-sm"
            aria-hidden
          />
          <Wallet
            className="relative z-[1] h-[5.5rem] w-[5.5rem] text-amber-900 drop-shadow-md"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="relative z-[2] flex flex-col items-center">
            <Coins
              className="h-16 w-16 text-amber-400 drop-shadow-[0_4px_8px_rgba(180,83,9,0.35)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="-mt-2 flex gap-0.5">
              <Heart className="h-6 w-6 fill-rose-400 text-rose-500" strokeWidth={1.5} aria-hidden />
              <Heart className="h-5 w-5 fill-rose-300 text-rose-400" strokeWidth={1.5} aria-hidden />
            </div>
          </div>
        </div>

        <p id="zero-balance-desc" className="mt-5 text-center text-sm leading-snug text-neutral-500">
          Не хватает сердец! Перейди в магазин, чтобы купить ещё
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={goShop}
            className="w-full rounded-full border-2 border-[#3d7a1f] bg-gradient-to-b from-[#a3e635] via-[#84cc16] to-[#65a30d] py-3.5 text-center text-base font-extrabold text-white shadow-[0_4px_0_#3f6212,inset_0_1px_0_rgba(255,255,255,0.35)] transition active:translate-y-px active:shadow-[0_2px_0_#3f6212]"
          >
            В магазин
          </button>
          <button
            type="button"
            onClick={goBack}
            className="w-full rounded-full border-2 border-[#7c3aed] bg-white py-3.5 text-center text-base font-extrabold text-[#6d28d9] shadow-sm transition hover:bg-violet-50"
          >
            Вернуться
          </button>
        </div>
      </div>
    </div>
  )
}
