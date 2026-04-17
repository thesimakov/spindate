"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { ArrowRightLeft, ChevronLeft, ChevronRight, Coins, Flower2, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { generateLogId, useGame } from "@/lib/game-context"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { listVotesForPack, payVotesForPack, VK_HEART_PACK_AMOUNTS } from "@/lib/heart-shop-pricing"
import { TELEGRAM_STARS_PACKS, type TelegramStarsPackId } from "@/lib/telegram-stars-pricing"
import { apiFetch } from "@/lib/api-fetch"
import { vkBridge } from "@/lib/vk-bridge"
import { useSocialRuntime } from "@/lib/social-runtime"
import { showEmbeddedPaymentWall } from "@/lib/social-payments"
import { showEmbeddedRewardVideoAd } from "@/lib/social-ads"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { persistUserGameState } from "@/lib/persist-user-game-state"
import { buildRestoreGameStateAction } from "@/lib/user-visual-prefs"
import type { GameLogEntry, InventoryItem } from "@/lib/game-types"

type ShopScreenProps = {
  variant?: "page" | "panel"
  onClose?: () => void
}

/** Склонение «N голос(ов)» для цен в голосах VK. */
function vkVotesWordRu(n: number): string {
  const abs = Math.abs(Math.trunc(n))
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return "голос"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "голоса"
  return "голосов"
}

export function ShopScreen({ variant = "page", onClose }: ShopScreenProps = {}) {
  const { host: runtimeHost } = useSocialRuntime()
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, players, inventory, tableId } = state
  const { toast, showToast } = useInlineToast(1700)
  const rosesCount = inventory.filter((i) => i.type === "rose").length
  const [exchangeTab, setExchangeTab] = useState<
    "voices-to-roses" | "roses-to-voices"
  >("voices-to-roses")
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false)
  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as Window & { Telegram?: { WebApp?: unknown } }) : null
    setIsTelegramMiniApp(Boolean(w?.Telegram?.WebApp))
  }, [])

  const heartOffers = VK_HEART_PACK_AMOUNTS.map((hearts) => {
    const itemKey = `hearts_${hearts}` as keyof typeof vkBridge.VK_ITEM_IDS
    const itemId = vkBridge.VK_ITEM_IDS[itemKey]
    const o = { hearts, itemId }
    const listVotes = listVotesForPack(o.hearts)
    const votes = payVotesForPack(o.hearts)
    return { ...o, votes, listVotes }
  })
  const SHOP_PARTICLE_EASE = [
    "cubic-bezier(0.45, 0.02, 0.29, 0.98)",
    "cubic-bezier(0.33, 0.12, 0.53, 0.94)",
    "cubic-bezier(0.52, 0.01, 0.19, 0.99)",
    "cubic-bezier(0.4, 0.18, 0.32, 0.92)",
    "cubic-bezier(0.28, 0.09, 0.46, 1)",
    "cubic-bezier(0.55, 0.05, 0.15, 0.95)",
  ] as const

  const shopParticles = useMemo(() => {
    let s = 0x5b0b5 % 233280
    s = (s * 9301 + 49297) % 233280
    const count = 10 + (s % 30)
    const list: {
      x: number
      y: number
      duration: number
      delay: number
      isPink: boolean
      isYellow: boolean
      reverse: boolean
      chaos: number
      ease: string
      dustOpacity: number
      dustSize: string
    }[] = []
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280
      const x = 1 + (s / 233280) * 97
      s = (s * 9301 + 49297) % 233280
      const y = 5 + (s / 233280) * 90
      s = (s * 9301 + 49297) % 233280
      const chaos = s % 6
      s = (s * 9301 + 49297) % 233280
      const dustSize = `${(2 + (s / 233280) * 2.9).toFixed(2)}px`
      const dustOpacity = 0.4 + (s / 233280) * 0.5
      list.push({
        x,
        y,
        duration: 16 + (s % 26),
        delay: (s % 36) * 0.3,
        isPink: i % 3 === 1,
        isYellow: i % 3 === 2,
        reverse: (s + i * 3) % 2 === 1,
        chaos,
        ease: SHOP_PARTICLE_EASE[(s + chaos) % SHOP_PARTICLE_EASE.length],
        dustOpacity,
        dustSize,
      })
    }
    return list
  }, [])

  const isPanel = variant === "panel"

  const currentPlayer = currentUser ? players.find((p) => p.id === currentUser.id) : undefined
  const vipUntilTs = currentPlayer?.vipUntilTs
  const isVip = !!currentPlayer?.isVip && (vipUntilTs == null || vipUntilTs > Date.now())
  const vipTrialKey = currentUser ? `spindate_vip_trial_used_${currentUser.id}` : ""
  const [vipTrialUsed, setVipTrialUsed] = useState(false)
  const vipLevelKey = currentUser ? `spindate_vip_level_v1_${currentUser.id}` : ""
  const [vipLevel, setVipLevel] = useState<0 | 1 | 2 | 3>(0)

  const vipTariffsScrollRef = useRef<HTMLDivElement>(null)
  const [vipTariffsScrollEdges, setVipTariffsScrollEdges] = useState({ atStart: true, atEnd: false })

  const updateVipTariffsScrollEdges = useCallback(() => {
    const el = vipTariffsScrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setVipTariffsScrollEdges({
      atStart: scrollLeft <= 4,
      atEnd: scrollLeft + clientWidth >= scrollWidth - 4,
    })
  }, [])

  const scrollVipTariffs = useCallback(
    (direction: -1 | 1) => {
      const el = vipTariffsScrollRef.current
      if (!el) return
      const firstCard = el.querySelector<HTMLElement>("[data-vip-tariff-card]")
      const gap = 12
      const step = (firstCard?.offsetWidth ?? 296) + gap
      el.scrollBy({ left: direction * step, behavior: "smooth" })
    },
    [],
  )

  useEffect(() => {
    updateVipTariffsScrollEdges()
    const el = vipTariffsScrollRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => updateVipTariffsScrollEdges())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateVipTariffsScrollEdges])

  useEffect(() => {
    try {
      setVipTrialUsed(localStorage.getItem(vipTrialKey) === "1")
    } catch {
      setVipTrialUsed(false)
    }
  }, [vipTrialKey])

  useEffect(() => {
    if (!vipLevelKey) {
      setVipLevel(0)
      return
    }
    try {
      const raw = localStorage.getItem(vipLevelKey)
      const n = raw ? Number.parseInt(raw, 10) : 0
      setVipLevel(n === 1 || n === 2 || n === 3 ? n : 0)
    } catch {
      setVipLevel(0)
    }
  }, [vipLevelKey])

  useEffect(() => {
    if (!vipLevelKey) return
    try {
      localStorage.setItem(vipLevelKey, String(vipLevel))
    } catch {
      // ignore
    }
  }, [vipLevel, vipLevelKey])

  const WELCOME_GIFT_KEY = "spindate_welcome_gift_v1"
  /** Отдельно от окна ежедневной серии (`botl_daily_bonus_v1` в DailyStreakGateScreen). */
  const SHOP_DAILY_HEARTS_KEY = "spindate_shop_daily_hearts_v1"
  const SHOP_DAILY_HEARTS_AMOUNT = 50

  const dailyBonusTodayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  const [shopDailyClaimedToday, setShopDailyClaimedToday] = useState(false)
  const [welcomeGiftDone, setWelcomeGiftDone] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      setShopDailyClaimedToday(false)
      setWelcomeGiftDone(false)
      return
    }
    try {
      const welcomeRaw = localStorage.getItem(WELCOME_GIFT_KEY)
      const welcomeStored = welcomeRaw ? (JSON.parse(welcomeRaw) as Record<string, boolean>) : {}
      const welcomeOk = !!welcomeStored[String(currentUser.id)]
      setWelcomeGiftDone(welcomeOk)
      if (!welcomeOk) {
        setShopDailyClaimedToday(false)
        return
      }
      const shopRaw = localStorage.getItem(SHOP_DAILY_HEARTS_KEY)
      const byUser = shopRaw ? (JSON.parse(shopRaw) as Record<string, string>) : {}
      const lastShopClaim = byUser[String(currentUser.id)]
      setShopDailyClaimedToday(lastShopClaim === dailyBonusTodayKey)
    } catch {
      setShopDailyClaimedToday(false)
    }
  }, [currentUser, dailyBonusTodayKey])

  const handleClaimShopDailyHearts = useCallback(async () => {
    if (!currentUser || !welcomeGiftDone || shopDailyClaimedToday) return

    const amount = SHOP_DAILY_HEARTS_AMOUNT
    const vb = voiceBalance ?? 0
    const nextVoice = vb + amount

    dispatch({ type: "PAY_VOICES", amount: -amount })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} получил(а) ежедневный подарок в магазине: +${amount} сердец`,
        timestamp: Date.now(),
      } satisfies GameLogEntry,
    })
    showToast(`+${amount} сердец в подарок`, "success")

    try {
      const shopRaw = localStorage.getItem(SHOP_DAILY_HEARTS_KEY)
      const byUser = shopRaw ? (JSON.parse(shopRaw) as Record<string, string>) : {}
      byUser[String(currentUser.id)] = dailyBonusTodayKey
      localStorage.setItem(SHOP_DAILY_HEARTS_KEY, JSON.stringify(byUser))
    } catch {
      // ignore
    }

    const persisted = await persistUserGameState(currentUser, nextVoice, inventory)
    if (!persisted) {
      showToast("Не удалось сохранить награду на сервере. Повторите попытку.", "error")
      return
    }
    setShopDailyClaimedToday(true)
  }, [
    currentUser,
    welcomeGiftDone,
    shopDailyClaimedToday,
    dispatch,
    dailyBonusTodayKey,
    showToast,
    voiceBalance,
    inventory,
  ])

  const runLiveKeepAlive = async (user: typeof currentUser, ms: number) => {
    if (!user) return () => {}
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        await apiFetch("/api/table/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode: "sync",
            user,
            tableId,
          }),
        })
      } catch {
        // ignore
      }
    }
    await tick()
    const t = setInterval(() => void tick(), ms)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }

  /** Подтянуть баланс с сервера после оплаты VK (PUT в game-context дебаунсится ~1.5 с). */
  const syncVoiceFromServer = useCallback(async () => {
    if (!currentUser) return
    const endpoint =
      currentUser.authProvider === "vk"
        ? `/api/user/state?vk_user_id=${encodeURIComponent(String(currentUser.id))}`
        : "/api/user/state"
    try {
      const res = await apiFetch(endpoint, { credentials: "include" })
      const data = (await res.json()) as {
        ok?: boolean
        voiceBalance?: number
        inventory?: unknown[]
        visualPrefs?: unknown
      }
      if (data.ok && typeof data.voiceBalance === "number" && currentUser) {
        dispatch(
          buildRestoreGameStateAction(
            data.voiceBalance,
            Array.isArray(data.inventory) ? (data.inventory as InventoryItem[]) : [],
            currentUser.id,
            data.visualPrefs,
          ),
        )
      }
    } catch {
      // ignore
    }
  }, [currentUser, dispatch])

  const handleTelegramStarsPack = useCallback(
    async (packId: TelegramStarsPackId) => {
      if (!currentUser) return
      const w = window as Window & {
        Telegram?: {
          WebApp?: { openInvoice: (url: string, cb?: (status: string) => void) => void }
        }
      }
      const tw = w.Telegram?.WebApp
      if (!tw?.openInvoice) {
        showToast("Оплата Stars доступна в Telegram Mini App", "info")
        return
      }
      try {
        const res = await apiFetch("/api/telegram/stars/invoice", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packId }),
        })
        const data = (await res.json()) as { ok?: boolean; invoiceUrl?: string; error?: string }
        if (!data.ok || !data.invoiceUrl) {
          showToast(data.error ?? "Не удалось создать счёт", "error")
          return
        }
        tw.openInvoice(data.invoiceUrl, (status: string) => {
          if (status === "paid") {
            showToast("Баланс пополнен", "success")
            void syncVoiceFromServer()
          }
        })
      } catch {
        showToast("Ошибка сети", "error")
      }
    },
    [currentUser, showToast, syncVoiceFromServer],
  )

  /**
   * Ждём серверное подтверждение оплаты VK (callback order_status_change может прийти не мгновенно).
   * Возвращает true, если баланс вырос минимум на expectedDelta.
   */
  const waitForServerTopUp = useCallback(
    async (baselineBalance: number, expectedDelta: number): Promise<boolean> => {
      if (!currentUser) return false
      const endpoint =
        currentUser.authProvider === "vk"
          ? `/api/user/state?vk_user_id=${encodeURIComponent(String(currentUser.id))}`
          : "/api/user/state"
      const deadline = Date.now() + 25_000
      while (Date.now() < deadline) {
        try {
          const res = await apiFetch(endpoint, { credentials: "include" })
          const data = (await res.json()) as {
            ok?: boolean
            voiceBalance?: number
            inventory?: unknown[]
            visualPrefs?: unknown
          }
          if (data.ok && typeof data.voiceBalance === "number" && currentUser) {
            dispatch(
              buildRestoreGameStateAction(
                data.voiceBalance,
                Array.isArray(data.inventory) ? (data.inventory as InventoryItem[]) : [],
                currentUser.id,
                data.visualPrefs,
              ),
            )
            if (data.voiceBalance >= baselineBalance + expectedDelta) return true
          }
        } catch {
          // ignore transient network error
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      return false
    },
    [currentUser, dispatch],
  )

  const handleActivateVip = async ({
    days,
    cost,
    itemId,
    isTrial,
  }: {
    days: number
    cost: number
    itemId?: string
    isTrial?: boolean
  }) => {
    // Уровни: 0 нет, 1 триал, 2 куплено 7д, 3 куплено 30д.
    const targetLevel: 1 | 2 | 3 = isTrial ? 1 : days >= 30 ? 3 : 2
    const allowed =
      vipLevel === 0
        ? true
        : vipLevel === 1
          ? targetLevel === 2 || targetLevel === 3
          : vipLevel === 2
            ? targetLevel === 3
            : false

    if (!allowed) {
      showToast("Этот пакет сейчас недоступен", "info")
      return
    }
    if (isTrial && vipTrialUsed) {
      showToast("Пробный VIP уже использован", "info")
      return
    }
    if (!currentUser) return

    if (cost > 0) {
      const stopKeepAlive = await runLiveKeepAlive(currentUser, 12_000)
      const ok = await showEmbeddedPaymentWall(runtimeHost, cost, itemId, {
        userId: String(currentUser.id),
        description: `VIP ${days} дн.`,
      })
      stopKeepAlive()
      if (!ok) {
        showToast("Активация VIP отменена", "error")
        return
      }
    }

    const base = vipUntilTs && vipUntilTs > Date.now() ? vipUntilTs : Date.now()
    const until = base + days * 24 * 60 * 60 * 1000
    dispatch({ type: "SET_VIP_STATUS", playerId: currentUser.id, isVip: true, vipUntilTs: until })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} купил(а) VIP на ${days} дн.`,
        timestamp: Date.now(),
      },
    })
    if (isTrial) {
      try {
        localStorage.setItem(vipTrialKey, "1")
      } catch {
        // ignore
      }
      setVipTrialUsed(true)
    }
    setVipLevel((prev) => (prev >= targetLevel ? prev : targetLevel))
    showToast(`VIP активирован на ${days} дн.`, "success")
    window.setTimeout(() => void syncVoiceFromServer(), 1800)
  }

  const handleTopUp = async (amount: number, votes: number, itemId: string) => {
    if (!currentUser) return
    const baseline = voiceBalance
    const stopKeepAlive = await runLiveKeepAlive(currentUser, 12_000)
    const ok = await showEmbeddedPaymentWall(runtimeHost, votes, itemId, {
      userId: String(currentUser.id),
      description: `Пакет ${amount} сердец`,
    })
    stopKeepAlive()
    if (!ok) {
      showToast("Пополнение отменено", "error")
      return
    }
    const confirmed = await waitForServerTopUp(baseline, amount)
    if (confirmed) {
      showToast(`Баланс пополнен на ${amount} ❤`, "success")
    } else {
      showToast("Платёж принят. Начисление может занять до 1 минуты.", "info")
      window.setTimeout(() => void syncVoiceFromServer(), 4000)
    }
  }

  if (!currentUser) return null

  const goldCard =
    "rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 shadow-[0_10px_26px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.85)]"

  /** Контраст текста зависит от фона: в panel (material) — темнее, в page (тёмный фон) — светлее. */
  const secLabel = isPanel ? "text-slate-500" : "text-slate-500"
  const secTitle = isPanel ? "text-slate-900" : "text-slate-100"
  const secMuted = isPanel ? "text-slate-600" : "text-slate-400"

  // Типографика магазина (единые «токены», чтобы не прыгали размеры)
  const tOverline = "text-[11px] font-extrabold uppercase tracking-[0.18em]"
  const tH2 = "text-lg font-black sm:text-xl"
  const tCardTitle = "text-base font-black sm:text-lg"
  const tCardValue = "text-3xl font-black leading-none sm:text-4xl"
  const tBodySm = "text-xs font-medium"
  const tCta = "text-base font-black sm:text-lg"

  const shopInnerCard = (
    <div
      className={
        "w-full shrink-0 space-y-5 font-sans " +
        (isPanel ? "text-slate-900 " : "text-slate-100 ") +
        (isPanel ? "max-w-full px-0 py-1" : "max-w-md space-y-6 px-1 py-2 sm:max-w-lg")
      }
    >
      {!isPanel && (
        <div className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-100 px-6 py-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
          <h1 className="text-xl font-black tracking-wide text-slate-800 sm:text-2xl">
            Магазин
          </h1>
        </div>
      )}

      {/* Баланс */}
      <div className={`relative overflow-hidden ${goldCard} p-4`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 50% 20%, rgba(125,211,252,0.22) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className={`${tOverline} text-slate-500`}>Баланс</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700">Сердечки</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_12px_rgba(190,24,93,0.35)] ring-1 ring-rose-200/70">
              <Heart className="bank-heart-beat h-7 w-7 text-white drop-shadow" strokeWidth={2} fill="currentColor" aria-hidden />
            </div>
            <span className="text-3xl font-black tabular-nums tracking-tight text-slate-800 sm:text-4xl">
              {voiceBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Ежедневный подарок */}
      <div
        className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 px-3 py-3 shadow-[0_8px_18px_rgba(109,40,217,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-4`}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-purple-700 opacity-80"
          aria-hidden
        />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-700 shadow-[0_10px_18px_rgba(109,40,217,0.25),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/70">
          <Heart className="h-5 w-5 text-white drop-shadow" strokeWidth={2.25} fill="currentColor" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black tracking-tight text-slate-900">Сердечки в подарок</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-700">
            {!welcomeGiftDone ? (
              <>Доступно раз в день — сначала примите приветственный подарок</>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200/80 bg-white/70 px-2 py-0.5 font-extrabold text-fuchsia-700 shadow-[0_6px_12px_rgba(236,72,153,0.12)]">
                  +{SHOP_DAILY_HEARTS_AMOUNT}
                </span>{" "}
                сердечек раз в сутки
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={!welcomeGiftDone || shopDailyClaimedToday}
          onClick={() => void handleClaimShopDailyHearts()}
          className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-violet-400/85 bg-gradient-to-b from-violet-400 via-fuchsia-500 to-purple-700 px-3 py-2 text-xs font-extrabold text-white shadow-[0_4px_0_#4c1d95,0_10px_22px_rgba(139,92,246,0.35),inset_0_2px_0_rgba(255,255,255,0.35)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] transition hover:brightness-[1.06] active:translate-y-px active:shadow-[0_2px_0_#4c1d95,0_8px_18px_rgba(139,92,246,0.3)] disabled:cursor-not-allowed disabled:border-slate-500 disabled:from-slate-400 disabled:via-slate-400 disabled:to-slate-500 disabled:text-slate-100 disabled:shadow-none disabled:hover:brightness-100"
        >
          {!shopDailyClaimedToday && welcomeGiftDone && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
          )}
          <Coins className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          {shopDailyClaimedToday ? "Забрано" : "Забрать"}
        </button>
      </div>

      {/* Заголовок пакетов */}
      <div className="px-1">
        <p className={`${tOverline} ${secLabel}`}>Пополнение</p>
        <h2 className={`${tH2} ${secTitle}`}>Наборы сердец</h2>
        <p className={`${tBodySm} ${secMuted}`}>Оплата голосами VK</p>
      </div>

      {/* Пакеты сердец — карточка: иконка → количество → цена в голосах; скидка — шильдик в углу */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {heartOffers.map((offer) => {
          const hasDiscount = offer.listVotes > offer.votes
          const doubledIcon =
            offer.hearts === 12 || offer.hearts === 60 || offer.hearts === 150 || offer.hearts === 400
          const normalIcon = offer.hearts === 1000 || offer.hearts === 2500 || offer.hearts === 7500
          const benefitPct = hasDiscount
            ? Math.round((offer.listVotes / offer.votes - 1) * 100)
            : 0
          return (
            <div
              key={offer.hearts}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-[#fffdf8] shadow-[0_8px_18px_rgba(15,23,42,0.18),0_1px_0_rgba(255,255,255,0.85)_inset]"
            >
              {hasDiscount && (
                <div
                  className="pointer-events-none absolute right-1 top-1 z-[6] min-w-[4.15rem] rounded-[0.9rem] border-[2px] border-white/70 bg-gradient-to-b from-fuchsia-400 via-violet-500 to-purple-700 px-2 py-0.5 text-center shadow-[0_6px_14px_rgba(76,29,149,0.45),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-purple-900/25 sm:right-1.5 sm:top-1.5 sm:min-w-[4.5rem] sm:rounded-[1rem] sm:px-2.5 sm:py-1"
                  aria-hidden
                >
                  <div className="rounded-[0.62rem] bg-gradient-to-b from-white/15 to-black/20 px-1 py-0.5 leading-none ring-1 ring-white/25 sm:rounded-[0.72rem] sm:px-1.5">
                    <span className="block text-[10px] font-black tabular-nums text-white sm:text-[11px] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                      −{benefitPct}%
                    </span>
                    <span className="mt-0.5 block text-[8px] font-extrabold uppercase tracking-[0.09em] text-violet-100 sm:text-[9px] [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
                      выгода
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col items-center px-2.5 pb-1.5 pt-4 sm:px-3.5 sm:pt-5">
                <div
                  className={`flex w-full items-center justify-center ${
                    doubledIcon ? "h-[7.4rem] sm:h-[9.6rem]" : "h-[4.25rem] sm:h-24"
                  }`}
                >
                  <img
                    src={`/assets/${offer.hearts}.svg`}
                    alt=""
                    className={`select-none ${
                      doubledIcon
                        ? "h-[7rem] w-[7rem] drop-shadow-[0_12px_20px_rgba(0,0,0,0.3)] sm:h-[9rem] sm:w-[9rem]"
                        : normalIcon
                          ? "h-[3.75rem] w-[3.75rem] drop-shadow-[0_6px_10px_rgba(0,0,0,0.2)] sm:h-20 sm:w-20"
                          : "h-[3.75rem] w-[3.75rem] drop-shadow-[0_6px_10px_rgba(0,0,0,0.2)] sm:h-20 sm:w-20"
                    }`}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <span className="text-2xl font-black tabular-nums tracking-tight text-[#3b2a09] sm:text-3xl">
                    {offer.hearts.toLocaleString("ru-RU")}
                  </span>
                  <Heart
                    className="h-7 w-7 shrink-0 text-rose-500 sm:h-8 sm:w-8"
                    strokeWidth={2}
                    fill="currentColor"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="mt-auto flex justify-center px-2.5 pb-3.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => handleTopUp(offer.hearts, offer.votes, offer.itemId)}
                  className="w-full rounded-2xl border border-amber-500/45 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-2 py-2.5 text-center text-[13px] font-black tracking-tight text-[#2f1a04] shadow-[0_6px_12px_rgba(217,119,6,0.32),inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:brightness-105 active:translate-y-px active:shadow-[0_3px_7px_rgba(217,119,6,0.35)] sm:text-sm"
                >
                  <span className="tabular-nums">{offer.votes}</span>
                  <span className="hidden sm:inline"> {vkVotesWordRu(offer.votes)}</span>
                  <span className="sm:hidden"> гол.</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {isTelegramMiniApp && (
        <>
          <div className="px-1 pt-2">
            <p className={`${tOverline} ${secLabel}`}>Пополнение</p>
            <h2 className={`${tH2} ${secTitle}`}>Telegram Stars</h2>
            <p className={`${tBodySm} ${secMuted}`}>1 ⭐ ≈ 10 ❤</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {TELEGRAM_STARS_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-[#fffdf8] shadow-[0_8px_18px_rgba(15,23,42,0.18),0_1px_0_rgba(255,255,255,0.85)_inset]"
              >
                <div className="flex flex-1 flex-col items-center px-2.5 pb-1.5 pt-4 sm:px-3.5 sm:pt-5">
                  <span className="text-2xl font-black tabular-nums text-[#3b2a09] sm:text-3xl">
                    {pack.hearts.toLocaleString("ru-RU")} ❤
                  </span>
                  <span className="mt-1 text-center text-xs font-semibold text-slate-600">{pack.description}</span>
                </div>
                <div className="mt-auto flex justify-center px-2.5 pb-3.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => void handleTelegramStarsPack(pack.id)}
                    className="w-full rounded-2xl border border-sky-500/45 bg-gradient-to-b from-sky-400 to-blue-600 px-2 py-2.5 text-center text-[13px] font-black tracking-tight text-white shadow-[0_6px_12px_rgba(2,132,199,0.32)] transition hover:brightness-105"
                  >
                    <span className="tabular-nums">{pack.stars}</span> ⭐
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* VIP тарифы */}
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className={`${tOverline} ${secLabel}`}>VIP</p>
            <h2 className={`${tH2} ${secTitle}`}>Тарифы</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              aria-label="Предыдущий тариф"
              disabled={vipTariffsScrollEdges.atStart}
              onClick={() => scrollVipTariffs(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Следующий тариф"
              disabled={vipTariffsScrollEdges.atEnd}
              onClick={() => scrollVipTariffs(1)}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <div className="-mx-4 px-2 pb-4 pt-2 sm:-mx-5 sm:px-3">
        <div
          ref={vipTariffsScrollRef}
          onScroll={updateVipTariffsScrollEdges}
          className="overflow-x-auto overflow-y-visible scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max snap-x snap-mandatory gap-3 pl-3 pt-2 pb-1 pr-2 sm:pl-4 sm:pt-2.5 sm:pr-3">
        <div
          data-vip-tariff-card
          className="relative w-[18.5rem] shrink-0 snap-start sm:w-[19.5rem]"
        >
          <div className="pointer-events-none absolute -left-1.5 -top-1.5 z-[3] h-[4.6rem] w-[4.6rem] drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)] sm:-left-2 sm:-top-2 sm:h-[5.25rem] sm:w-[5.25rem]" aria-hidden>
            <img src="/assets/green.png" alt="" className="h-full w-full" />
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-lime-300/70 bg-[#f4f4f5] shadow-[0_6px_14px_rgba(148,163,184,0.22)]">
          <div className="px-4 pt-4 text-center">
            <p className={`${tCardTitle} text-rose-500`}>VIP 1 день</p>
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="rounded-xl border border-slate-300/90 bg-[#e5e7eb] px-3 py-2 text-center text-sm font-semibold text-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
              Попробуйте сейчас!
            </div>
            <p className={`mt-2 text-center ${tCardValue} text-lime-600`}>Бесплатно!</p>
            <button
              type="button"
              disabled={vipTrialUsed || vipLevel !== 0 || !!isVip}
              onClick={() => {
                void (async () => {
                  if (!currentUser || vipTrialUsed || vipLevel !== 0 || isVip) return
                  if (runtimeHost !== "vk") {
                    showToast(
                      runtimeHost === "ok"
                        ? "Пробный VIP за рекламу в Одноклассниках будет доступен после подключения рекламы ОК"
                        : "Пробный VIP за рекламу доступен в приложении ВКонтакте",
                      "info",
                    )
                    return
                  }
                  try {
                    await showEmbeddedRewardVideoAd(runtimeHost)
                  } catch {
                    // ignore
                  }
                  await handleActivateVip({ days: 1, cost: 0, isTrial: true })
                })()
              }}
              className={`mt-2 w-full rounded-full border border-green-700/35 bg-gradient-to-b from-lime-400 to-green-600 py-2.5 ${tCta} text-white shadow-[0_4px_10px_rgba(22,163,74,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-105 disabled:from-slate-400 disabled:to-slate-500 disabled:text-slate-100 disabled:shadow-none`}
            >
              {vipTrialUsed ? "Проба использована" : vipLevel !== 0 || isVip ? "Недоступно" : "Смотреть рекламу"}
            </button>
          </div>
          </div>
        </div>

        <div
          data-vip-tariff-card
          className="w-[18.5rem] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-200 bg-[#f4f4f5] shadow-[0_6px_14px_rgba(148,163,184,0.2)] sm:w-[19.5rem]"
        >
          <div className="px-4 pt-4 text-center">
              <p className={`${tCardTitle} text-rose-500`}>VIP 7 дней</p>
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="rounded-xl border border-slate-300/90 bg-[#e5e7eb] px-3 py-2 text-center text-sm font-semibold text-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
              {Math.round(15 / 7)} голоса в день
            </div>
              <p className="mt-2 text-center text-xl font-black tracking-tight text-slate-800 sm:text-2xl">15 голосов</p>
            <button
              type="button"
              disabled={vipLevel === 2 || vipLevel === 3}
              onClick={() => handleActivateVip({ days: 7, cost: 15, itemId: vkBridge.VK_ITEM_IDS.vip_7d })}
                className={`mt-2 w-full rounded-full border border-rose-600/45 bg-gradient-to-b from-rose-400 to-pink-600 py-2.5 ${tCta} text-white shadow-[0_4px_10px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.42)] transition hover:brightness-105 disabled:from-slate-400 disabled:to-slate-500 disabled:text-slate-100 disabled:shadow-none`}
            >
              {vipLevel === 2 || vipLevel === 3 ? "Недоступно" : "Купить"}
            </button>
          </div>
        </div>

        <div
          data-vip-tariff-card
          className="relative w-[18.5rem] shrink-0 snap-start sm:w-[19.5rem]"
        >
          <div className="pointer-events-none absolute -left-1.5 -top-1.5 z-[3] h-[4.6rem] w-[4.6rem] drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)] sm:-left-2 sm:-top-2 sm:h-[5.25rem] sm:w-[5.25rem]" aria-hidden>
            <img src="/assets/red.png" alt="" className="h-full w-full" />
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#f4f4f5] shadow-[0_6px_14px_rgba(148,163,184,0.2)]">
          <div className="px-4 pt-4 text-center">
              <p className={`${tCardTitle} text-rose-500`}>VIP 30 дней</p>
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="rounded-xl border border-slate-300/90 bg-[#e5e7eb] px-3 py-2 text-center text-sm font-semibold text-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
              {Math.round(50 / 30)} голоса в день
            </div>
              <p className="mt-2 text-center text-xl font-black tracking-tight text-slate-800 sm:text-2xl">50 голосов</p>
            <button
              type="button"
              disabled={vipLevel === 3}
              onClick={() => handleActivateVip({ days: 30, cost: 50, itemId: vkBridge.VK_ITEM_IDS.vip_30d })}
                className={`mt-2 w-full rounded-full border border-rose-600/45 bg-gradient-to-b from-rose-400 to-pink-600 py-2.5 ${tCta} text-white shadow-[0_4px_10px_rgba(225,29,72,0.35),inset_0_1px_0_rgba(255,255,255,0.42)] transition hover:brightness-105 disabled:from-slate-400 disabled:to-slate-500 disabled:text-slate-100 disabled:shadow-none`}
            >
              {vipLevel === 3 ? "Недоступно" : "Купить"}
            </button>
          </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Обмен */}
      <div className="space-y-2 px-1">
        <p className={`${tOverline} ${secLabel}`}>Обмен</p>
        <h2 className={`${tH2} ${secTitle}`}>Сердца и розы</h2>
      </div>
      <div className={`overflow-hidden ${goldCard} p-0`}>
        <div className="space-y-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-cyan-700" strokeWidth={2} aria-hidden />
            <span className="text-sm font-extrabold text-slate-700">Курс</span>
            {(
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">
                <span className="tabular-nums">20</span>
                <Heart className="h-4 w-4 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                <span>=</span>
                <span>1</span>
                <Flower2 className="h-4 w-4 text-fuchsia-600" strokeWidth={2} aria-hidden />
              </span>
            )}
          </div>
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 sm:gap-1.5"
            aria-label="Направление обмена"
          >
            <button
              type="button"
              role="tab"
              aria-selected={exchangeTab === "voices-to-roses"}
              onClick={() => setExchangeTab("voices-to-roses")}
              className={`flex min-h-[2.65rem] items-center justify-center gap-0.5 rounded-xl px-1.5 text-[10px] font-extrabold leading-tight transition sm:min-h-[2.75rem] sm:gap-1 sm:px-2 sm:text-[12px] md:text-sm ${
                exchangeTab === "voices-to-roses"
                  ? "bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-900 shadow"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <span className="inline-flex flex-col items-center gap-0 sm:flex-row sm:gap-1">
                <span className="font-black">Сердце</span>
                <span className="text-slate-900/60 sm:inline" aria-hidden>
                  →
                </span>
                <span className="font-black">Роза</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={exchangeTab === "roses-to-voices"}
              onClick={() => setExchangeTab("roses-to-voices")}
              className={`flex min-h-[2.65rem] items-center justify-center gap-0.5 rounded-xl px-1.5 text-[10px] font-extrabold leading-tight transition sm:min-h-[2.75rem] sm:gap-1 sm:px-2 sm:text-[12px] md:text-sm ${
                exchangeTab === "roses-to-voices"
                  ? "bg-gradient-to-r from-fuchsia-400 to-pink-500 text-white shadow"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <span className="inline-flex flex-col items-center gap-0 sm:flex-row sm:gap-1">
                <span className="font-black">Роза</span>
                <span className={exchangeTab === "roses-to-voices" ? "text-white/80 sm:inline" : "text-slate-900/60 sm:inline"} aria-hidden>
                  →
                </span>
                <span className="font-black">Сердце</span>
              </span>
            </button>
            {/* Кнопка «Подарок → ❤» временно скрыта */}
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          {exchangeTab === "voices-to-roses" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-500">Баланс</span>
                <span className="inline-flex items-center gap-1 text-lg font-black text-slate-800">
                  <span className="tabular-nums">{voiceBalance}</span>
                  <Heart className="h-5 w-5 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {(
                  [
                    { roses: 1, cost: 20 },
                    { roses: 5, cost: 100 },
                    { roses: 10, cost: 200 },
                  ] as const
                ).map(({ roses, cost }) => (
                  <Button
                    key={roses}
                    type="button"
                    variant="outline"
                    disabled={voiceBalance < cost}
                    className="flex h-auto min-h-[4.5rem] min-w-0 flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-extrabold text-slate-800 shadow-[0_4px_10px_rgba(15,23,42,0.08)] hover:bg-slate-50 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                    onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: roses })}
                  >
                    <span className="inline-flex items-center justify-center gap-1 sm:gap-2">
                      <Flower2 className="h-5 w-5 shrink-0 text-fuchsia-600 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
                      +{roses}
                    </span>
                    <span className="heart-price heart-price--compact text-sm">
                      <span className="tabular-nums">{cost}</span>
                      <Heart className="heart-price__icon h-4 w-4 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ) : exchangeTab === "roses-to-voices" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-500">Доступные розы</span>
                <span className="inline-flex items-center gap-1 text-lg font-black text-slate-800">
                  <span className="tabular-nums">{rosesCount}</span>
                  <Flower2 className="h-5 w-5 text-fuchsia-600" strokeWidth={2} aria-hidden />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={rosesCount < 1}
                  className="flex h-auto min-h-[4.5rem] min-w-0 flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-extrabold text-slate-800 shadow-[0_4px_10px_rgba(15,23,42,0.08)] hover:bg-slate-50 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 1 })}
                >
                  1 роза
                  <span className="heart-price heart-price--compact text-sm">
                    +15
                    <Heart className="heart-price__icon h-4 w-4 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={rosesCount < 5}
                  className="flex h-auto min-h-[4.5rem] min-w-0 flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-extrabold text-slate-800 shadow-[0_4px_10px_rgba(15,23,42,0.08)] hover:bg-slate-50 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 5 })}
                >
                  5 роз
                  <span className="heart-price heart-price--compact text-sm">
                    +75
                    <Heart className="heart-price__icon h-4 w-4 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={rosesCount < 1}
                  className="flex h-auto min-h-[4.5rem] min-w-0 flex-col gap-1.5 rounded-2xl border border-violet-300/55 bg-violet-50 px-2 py-2.5 text-[11px] font-extrabold text-violet-900 shadow-[0_4px_10px_rgba(76,29,149,0.12)] hover:bg-violet-100 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: rosesCount })}
                >
                  Все розы
                  <span className="heart-price heart-price--compact text-sm">
                    +{rosesCount * 15}
                    <Heart className="heart-price__icon h-4 w-4 text-rose-500" strokeWidth={2} fill="currentColor" aria-hidden />
                  </span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="rounded-2xl border border-slate-200 bg-slate-50/95 px-4 py-3 text-center sm:text-left">
        <p className="text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Сердечки — виртуальная игровая валюта, не обмениваются на реальные деньги. П. 2.3.8{" "}
          <a
            href="https://dev.vk.com/ru/mini-apps-rules"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-700 underline decoration-slate-400 underline-offset-2"
          >
            правил VK Mini Apps
          </a>
          .
        </p>
      </footer>
    </div>
  )

  if (isPanel) {
    return (
      <>
        {toast && <InlineToast toast={toast} />}
        <GameSidePanelShell
          title="Магазин"
          subtitle=""
          onClose={onClose!}
          variant="material"
          overlayClassName="bg-black/65"
        >
          {shopInnerCard}
        </GameSidePanelShell>
      </>
    )
  }

  return (
    <div className="relative flex h-app min-h-app max-h-app flex-col overflow-hidden bg-gradient-to-b from-[#111827] via-[#0f172a] to-[#020617] entry-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <div className="game-particles game-particles--dust" aria-hidden="true">
        {shopParticles.map((d, idx) => {
          const anim = d.reverse ? `particleChaosRev${d.chaos + 1}` : `particleChaos${d.chaos + 1}`
          return (
            <span
              key={idx}
              className="pointer-events-none absolute"
              style={{ left: `${d.x}%`, top: `${d.y}%`, opacity: d.dustOpacity }}
            >
              <span
                className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""} ${d.isYellow ? "game-particles__dot--yellow" : ""}`}
                style={
                  {
                    position: "relative",
                    left: 0,
                    top: 0,
                    ["--particle-anim"]: anim,
                    ["--particle-dur"]: `${d.duration}s`,
                    ["--particle-delay"]: `${d.delay}s`,
                    ["--particle-ease"]: d.ease,
                    ["--dust-size"]: d.dustSize,
                  } as CSSProperties
                }
              />
            </span>
          )
        })}
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:py-10">
        {shopInnerCard}
      </div>
    </div>
  )
}

