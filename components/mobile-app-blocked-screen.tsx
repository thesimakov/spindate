"use client"

import { useCallback, useState } from "react"
import { Heart, Loader2, Sparkles } from "lucide-react"
import { useGame } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem, Player } from "@/lib/game-types"
import {
  initVkResilient,
  isVkMiniApp,
  joinVkCommunityGroup,
  openVkUrl,
  readVkUserIdFromClientLocation,
  VK_COMMUNITY_PUBLIC_URL,
} from "@/lib/vk-bridge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function buildSubscribeRewardUrl(user: Player | null): string {
  let vk: number | null = null
  if (user) {
    if (user.authProvider === "vk") {
      const id = typeof user.vkUserId === "number" ? user.vkUserId : user.id
      if (typeof id === "number" && id > 0) vk = id
    } else if (typeof user.vkUserId === "number" && user.vkUserId > 0) {
      vk = user.vkUserId
    }
  }
  if (vk == null) vk = readVkUserIdFromClientLocation()
  if (vk != null) {
    return `/api/rewards/vk-group-subscribe?vk_user_id=${encodeURIComponent(String(vk))}`
  }
  return "/api/rewards/vk-group-subscribe"
}

export function MobileAppBlockedScreen() {
  const { state, dispatch } = useGame()
  const user = state.currentUser
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const tryClaimBonus = useCallback(async () => {
    setHint(null)
    const res = await apiFetch(buildSubscribeRewardUrl(user), {
      method: "POST",
      credentials: "include",
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (res.status === 401) {
      setHint("Чтобы получить бонус, войдите в приложение. Если вы уже играли на ПК — откройте мини-приложение в том же аккаунте ВК.")
      return
    }
    if (res.status === 503) {
      setHint("Проверка подписки временно недоступна. Подпишитесь на сообщество по ссылке — как только сервер настроят, бонус можно будет получить повторным нажатием.")
      return
    }
    if (!data || data.ok !== true) {
      if (data?.isMember === false) {
        setHint("Подписка пока не засчиталась. Оформите вступление в сообщество и нажмите кнопку ещё раз через несколько секунд.")
        return
      }
      setHint(typeof data?.error === "string" ? data.error : "Не удалось начислить бонус. Попробуйте ещё раз.")
      return
    }

    if (typeof data.voiceBalance === "number") {
      dispatch({
        type: "RESTORE_GAME_STATE",
        voiceBalance: data.voiceBalance,
        inventory: (state.inventory ?? []) as InventoryItem[],
      })
    }
    if (data.alreadyClaimed === true) {
      setHint("Бонус уже был получен ранее. Спасибо, что с нами!")
    } else if (data.granted === true) {
      setHint("Готово: на баланс начислено 30 ❤. Зайдите с компьютера, чтобы продолжить игру.")
    }
  }, [dispatch, state.inventory, user])

  const handleSubscribeAndBonus = async () => {
    setBusy(true)
    setHint(null)
    try {
      await initVkResilient()
      if (isVkMiniApp()) {
        await joinVkCommunityGroup()
      }
      await openVkUrl(VK_COMMUNITY_PUBLIC_URL)
      await new Promise((r) => setTimeout(r, 900))
      await tryClaimBonus()
    } finally {
      setBusy(false)
    }
  }

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
          disabled={busy}
          onClick={() => void handleSubscribeAndBonus()}
          className={cn(
            "mt-6 h-12 w-full rounded-2xl border border-cyan-400/40",
            "bg-gradient-to-r from-cyan-600 via-cyan-500 to-sky-500",
            "text-sm font-semibold text-white shadow-[0_6px_26px_rgba(6,182,212,0.4)]",
            "hover:from-cyan-500 hover:via-cyan-400 hover:to-sky-400 disabled:opacity-50",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4 shrink-0 fill-white/20" aria-hidden />
              Подписаться и получить 30&nbsp;❤
            </>
          )}
        </Button>

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
