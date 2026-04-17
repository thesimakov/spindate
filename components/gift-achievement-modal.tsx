"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type GiftAchievementModalProps = {
  open: boolean
  imageUrl: string
  achievementTitle: string
  description: string
  /** Пол получателя (текущего пользователя), чтобы заголовок был грамматически корректным. */
  recipientGender?: "male" | "female"
  shareBusy?: boolean
  onClose: () => void
  onShare: () => void
}

export function GiftAchievementModal({
  open,
  imageUrl,
  achievementTitle,
  description,
  recipientGender,
  shareBusy = false,
  onClose,
  onShare,
}: GiftAchievementModalProps) {
  if (!open) return null

  const hasLoggedRef = useRef(false)
  useEffect(() => {
    if (!open) return
    if (hasLoggedRef.current) return
    hasLoggedRef.current = true
    // #region agent log
    process.env.NODE_ENV === "development" && fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b06cc0" },
      body: JSON.stringify({
        sessionId: "b06cc0",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "gift-achievement-modal.tsx:render",
        message: "GiftAchievementModal render for closeability",
        timestamp: Date.now(),
        data: { open, shareBusy, recipientGender },
      }),
    }).catch(() => {})
    // #endregion
  }, [open, shareBusy, recipientGender])

  const handleClose = () => {
    // #region agent log
    process.env.NODE_ENV === "development" && fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b06cc0" },
      body: JSON.stringify({
        sessionId: "b06cc0",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "gift-achievement-modal.tsx:handleClose",
        message: "GiftAchievementModal close handler invoked",
        timestamp: Date.now(),
        data: { open, shareBusy, recipientGender },
      }),
    }).catch(() => {})
    // #endregion
    onClose()
  }

  const titleText =
    recipientGender === "female" ? "Ты получила достижение" : recipientGender === "male" ? "Ты получил достижение" : "Ты получил(А) достижение"

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-achievement-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !shareBusy) {
          // #region agent log
          process.env.NODE_ENV === "development" && fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b06cc0" },
            body: JSON.stringify({
              sessionId: "b06cc0",
              runId: "pre-fix",
              hypothesisId: "H3",
              location: "gift-achievement-modal.tsx:overlayClick",
              message: "Overlay click on background triggers close",
              timestamp: Date.now(),
              data: { shareBusy },
            }),
          }).catch(() => {})
          // #endregion
          handleClose()
        }
      }}
    >
      <div className="relative w-full max-w-[min(100%,26rem)] overflow-hidden rounded-[2rem] bg-[#f4f4fb] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#ff0066_0%,#ff1f7a_42%,#ff4c98_100%)] px-6 pb-6 pt-5 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right_top,rgba(255,220,120,0.45),transparent_28%),radial-gradient(circle_at_left_center,rgba(255,255,255,0.2),transparent_35%)]" />
          <button
            type="button"
            onClick={handleClose}
            disabled={shareBusy}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 id="gift-achievement-title" className="relative text-2xl font-black tracking-tight text-white sm:text-[1.85rem]">
            {titleText}
          </h2>
        </div>

        <div className="px-6 pb-7 pt-6 text-center">
          <p className="text-lg font-black text-slate-900">{achievementTitle}</p>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-700">{description}</p>

          <div className="mt-5 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={achievementTitle}
              className="h-auto max-h-[21rem] w-auto max-w-full rounded-[1.6rem] shadow-[0_14px_32px_rgba(15,23,42,0.2)]"
            />
          </div>

          <button
            type="button"
            onClick={onShare}
            disabled={shareBusy}
            className={cn(
              "mt-6 w-full rounded-[1.35rem] px-4 py-4 text-lg font-black text-white transition",
              "bg-[linear-gradient(180deg,#ff005c_0%,#f40057_100%)] shadow-[0_8px_24px_rgba(244,0,87,0.35)]",
              "hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70",
            )}
          >
            {shareBusy ? "Открываем VK Stories..." : "Рассказать друзьям"}
          </button>
        </div>
      </div>
    </div>
  )
}
