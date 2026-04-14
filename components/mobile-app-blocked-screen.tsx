"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Heart, Loader2, Sparkles } from "lucide-react"
import { useGame } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem } from "@/lib/game-types"
import { buildRestoreGameStateAction } from "@/lib/user-visual-prefs"
import {
  initVkResilient,
  isVkMiniApp,
  joinVkCommunityGroup,
  openVkUrl,
  VK_COMMUNITY_PUBLIC_URL,
} from "@/lib/vk-bridge"
import { buildVkGroupSubscribeRewardUrl, markVkGroupBellAnimationOff } from "@/lib/vk-group-news-bell"
import { VK_GROUP_SUBSCRIBE_BONUS_HEARTS } from "@/lib/vk-group-subscribe-constants"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const OPEN_URL_RACE_MS = 1800
const AFTER_OPEN_DELAY_MS = 450

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type SubscribeSuccess = "none" | "granted" | "alreadyClaimed"

export function MobileAppBlockedScreen() {
  const { state, dispatch } = useGame()
  const user = state.currentUser
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [subscribeSuccess, setSubscribeSuccess] = useState<SubscribeSuccess>("none")
  const awaitingClaimRef = useRef(false)

  const tryClaimBonus = useCallback(async (): Promise<SubscribeSuccess> => {
    setHint(null)
    const res = await apiFetch(buildVkGroupSubscribeRewardUrl(user), {
      method: "POST",
      credentials: "include",
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (res.status === 401) {
      setHint(
        "Чтобы получить бонус, войдите в приложение. Если вы уже играли на ПК — откройте мини-приложение в том же аккаунте ВК.",
      )
      awaitingClaimRef.current = false
      return "none"
    }
    if (res.status === 503) {
      setHint(
        "Проверка подписки временно недоступна. Подпишитесь на сообщество по ссылке — как только сервер настроят, бонус можно будет получить повторным нажатием.",
      )
      awaitingClaimRef.current = false
      return "none"
    }
    if (!data || data.ok !== true) {
      if (data?.isMember === false) {
        setHint(
          "Подписка пока не засчиталась. Оформите вступление в сообщество и нажмите кнопку ещё раз через несколько секунд.",
        )
        return "none"
      }
      const errStr = typeof data?.error === "string" ? data.error : ""
      const verifyFailed =
        res.status === 502 ||
        errStr.includes("Не удалось проверить подписку") ||
        errStr.includes("проверить подписку")
      if (verifyFailed) {
        setHint("Вы уже подписаны. Следите за новостями.")
        markVkGroupBellAnimationOff()
        awaitingClaimRef.current = false
        return "none"
      }
      setHint(errStr || "Не удалось начислить бонус. Попробуйте ещё раз.")
      awaitingClaimRef.current = false
      return "none"
    }

    if (typeof data.voiceBalance === "number" && user) {
      const inv = Array.isArray(data.inventory)
        ? (data.inventory as InventoryItem[])
        : ((state.inventory ?? []) as InventoryItem[])
      dispatch(buildRestoreGameStateAction(data.voiceBalance, inv, user.id, data.visualPrefs))
    }

    awaitingClaimRef.current = false
    markVkGroupBellAnimationOff()
    if (data.alreadyClaimed === true) return "alreadyClaimed"
    if (data.granted === true) return "granted"
    return "alreadyClaimed"
  }, [dispatch, state.inventory, user])

  useEffect(() => {
    const onVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return
      if (!awaitingClaimRef.current) return
      void (async () => {
        const outcome = await tryClaimBonus()
        if (outcome === "granted" || outcome === "alreadyClaimed") {
          setSubscribeSuccess(outcome)
        }
      })()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [tryClaimBonus])

  const handleSubscribeAndBonus = async () => {
    setBusy(true)
    setHint(null)
    setSubscribeSuccess("none")
    awaitingClaimRef.current = true
    try {
      await initVkResilient()
      if (isVkMiniApp()) {
        await joinVkCommunityGroup()
      }
      await Promise.race([openVkUrl(VK_COMMUNITY_PUBLIC_URL), sleep(OPEN_URL_RACE_MS)])
      await sleep(AFTER_OPEN_DELAY_MS)
      const outcome = await tryClaimBonus()
      if (outcome === "granted" || outcome === "alreadyClaimed") {
        setSubscribeSuccess(outcome)
      }
    } finally {
      setBusy(false)
    }
  }

  const showSuccess = subscribeSuccess !== "none"
  const successFooter =
    subscribeSuccess === "granted"
      ? `Вы получаете ${VK_GROUP_SUBSCRIBE_BONUS_HEARTS} сердец, зайдите с компьютера и начните игру.`
      : subscribeSuccess === "alreadyClaimed"
        ? "Бонус вы уже получали ранее. Зайдите с компьютера, чтобы продолжить игру."
        : null

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto bg-[#0a0f18] px-4 py-8 text-slate-100">
      <div
        className={cn(
          "relative w-full max-w-md rounded-[1.35rem] border border-white/[0.12]",
          "bg-[rgba(8,12,22,0.94)] shadow-[0_24px_64px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
          "backdrop-blur-xl px-5 py-8 sm:px-8 sm:py-10",
        )}
      >
        <div className="mb-4 inline-flex items-center gap-2 text-cyan-200/95">
          <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-xs font-semibold tracking-wide">Крути и знакомься</span>
        </div>
        <h1 className="text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
          Мобильная версия временно недоступна
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Подпишитесь на нашу группу во «ВКонтакте», чтобы не пропустить запуск для смартфонов. Сейчас поиграть можно{" "}
          <span className="font-semibold text-slate-200">с компьютера</span>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Так вы останетесь в курсе новостей и сможете вернуться к столу на ПК, когда будет удобно.
        </p>

        <Button
          type="button"
          disabled={busy || showSuccess}
          onClick={() => void handleSubscribeAndBonus()}
          className={cn(
            "mt-6 h-12 w-full rounded-2xl border border-cyan-400/40",
            "bg-gradient-to-r from-cyan-600 via-cyan-500 to-sky-500",
            "text-sm font-semibold text-white shadow-[0_6px_26px_rgba(6,182,212,0.4)]",
            "hover:from-cyan-500 hover:via-cyan-400 hover:to-sky-400 disabled:opacity-50",
            showSuccess && "cursor-default opacity-90",
          )}
        >
          {busy && !showSuccess ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : showSuccess ? (
            "Вы подписались"
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4 shrink-0 fill-white/20" aria-hidden />
              Подписаться и получить {VK_GROUP_SUBSCRIBE_BONUS_HEARTS}&nbsp;❤
            </>
          )}
        </Button>

        {successFooter ? (
          <p className="mt-4 text-center text-sm leading-relaxed text-slate-300">{successFooter}</p>
        ) : null}

        {typeof state.voiceBalance === "number" && user ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Текущий баланс в приложении:{" "}
            <span className="font-semibold tabular-nums text-slate-300">{state.voiceBalance}</span> ❤
          </p>
        ) : null}

        {hint ? (
          <p className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-950/35 px-3 py-2 text-center text-sm leading-snug text-cyan-100/95">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
