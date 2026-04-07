"use client"

import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-fetch"
import {
  TICKER_AD_TIERS,
  TICKER_AD_TIER_ORDER,
  type TickerAdTierId,
} from "@/lib/ticker-player-ads-constants"
import { cn } from "@/lib/utils"
import type { InlineToastType } from "@/hooks/use-inline-toast"

type TickerAnnouncementModalProps = {
  open: boolean
  onClose: () => void
  authorDisplayName: string
  /** Суффикс запроса: `?vk_user_id=...` для VK */
  authQuery: string
  /** Текущий баланс сердец (игровой банк). */
  voiceBalance: number
  onSuccess: (newBalance: number) => void
  showToast: (message: string, type?: InlineToastType) => void
}

export function TickerAnnouncementModal({
  open,
  onClose,
  authorDisplayName,
  authQuery,
  voiceBalance,
  onSuccess,
  showToast,
}: TickerAnnouncementModalProps) {
  const [body, setBody] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [tier, setTier] = useState<TickerAdTierId>("5m")
  const [busy, setBusy] = useState(false)

  const canAfford = useCallback(
    (id: TickerAdTierId) => voiceBalance >= TICKER_AD_TIERS[id].cost_hearts,
    [voiceBalance],
  )

  useEffect(() => {
    if (!open) return
    setTier((prev) => {
      if (canAfford(prev)) return prev
      const first = TICKER_AD_TIER_ORDER.find((id) => canAfford(id))
      return first ?? TICKER_AD_TIER_ORDER[0]
    })
  }, [open, voiceBalance, canAfford])

  const reset = useCallback(() => {
    setBody("")
    setLinkUrl("")
    setTier("5m")
  }, [])

  const handleClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  const submit = useCallback(async () => {
    if (!canAfford(tier)) return
    setBusy(true)
    try {
      const path = `/api/ticker/announcement${authQuery.startsWith("?") ? authQuery : authQuery ? `?${authQuery}` : ""}`
      const res = await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body,
          linkUrl,
          tier,
          authorDisplayName: authorDisplayName.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showToast(typeof data?.error === "string" ? data.error : "Не удалось отправить объявление", "error")
        return
      }
      const nb = typeof data.newBalance === "number" ? data.newBalance : null
      if (nb != null) onSuccess(nb)
      showToast("Объявление отправлено на модерацию", "success")
      reset()
      onClose()
    } catch {
      showToast("Ошибка сети", "error")
    } finally {
      setBusy(false)
    }
  }, [authQuery, authorDisplayName, body, canAfford, linkUrl, onClose, onSuccess, reset, showToast, tier])

  if (!open) return null

  const tariff = TICKER_AD_TIERS[tier]
  const canPaySelected = canAfford(tier)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticker-announcement-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="max-h-[min(92dvh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-400/35 bg-slate-950 p-4 shadow-2xl shadow-cyan-950/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="ticker-announcement-title" className="text-lg font-bold text-cyan-100">
            Добавление вашего объявления
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3 text-xs text-slate-300 leading-relaxed">
          <p>
            <span className="font-semibold text-slate-200">Пример:</span> «Познакомлюсь с девушкой 20–25 лет!»
          </p>
          <p>
            <span className="font-semibold text-slate-200">Правила:</span> без рекламы запрещённых товаров и услуг,
            без спама и оскорблений. Текст и ссылка проходят модерацию; при нарушении объявление отклоняют без
            размещения (возврат сердец при отклонении в этой версии не предусмотрен).
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-400">
            Текст
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={400}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="Текст объявления"
              disabled={busy}
            />
          </label>

          <label className="block text-xs font-medium text-slate-400">
            Ссылка (только VK)
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="https://vk.com/..."
              disabled={busy}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-400">Срок показа</legend>
            <div className="flex flex-col gap-2">
              {TICKER_AD_TIER_ORDER.map((id) => {
                const affordable = canAfford(id)
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      !affordable && "pointer-events-none cursor-not-allowed opacity-45",
                      affordable && tier === id
                        ? "cursor-pointer border-cyan-400/60 bg-cyan-950/40 text-cyan-50"
                        : affordable
                          ? "cursor-pointer border-slate-600 bg-slate-900/40 text-slate-200"
                          : "border-slate-700/80 bg-slate-950/40 text-slate-500",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ticker-tier"
                        checked={tier === id}
                        onChange={() => affordable && setTier(id)}
                        disabled={busy || !affordable}
                        className="accent-cyan-400 disabled:opacity-50"
                      />
                      {TICKER_AD_TIERS[id].label}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        affordable ? "text-rose-300" : "text-slate-500",
                      )}
                    >
                      {TICKER_AD_TIERS[id].cost_hearts} ❤
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <p className="text-center text-sm font-semibold text-slate-200">
            К оплате: <span className="text-rose-300">{tariff.cost_hearts}</span> ❤
            {voiceBalance < tariff.cost_hearts && (
              <span className="mt-1 block text-xs font-normal text-amber-400/90">Недостаточно сердец</span>
            )}
          </p>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
              Отмена
            </Button>
            <Button
              type="button"
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40"
              onClick={() => void submit()}
              disabled={busy || !canPaySelected}
            >
              {busy ? "Отправка…" : "Оплатить и отправить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
