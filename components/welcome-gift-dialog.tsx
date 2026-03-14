"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Heart, Flower2, Gift } from "lucide-react"

export interface WelcomeGiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  onClaim: () => void
}

export function WelcomeGiftDialog({
  open,
  onOpenChange,
  userName,
  onClaim,
}: WelcomeGiftDialogProps) {
  const displayName = userName?.trim() || "друг"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="backdrop-blur-md"
        className="p-0 overflow-hidden border-0 max-w-[420px] w-[calc(100%-2rem)] bg-transparent shadow-none"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Контейнер в единой стилистике с профилем и игровыми карточками */}
        <div
          className="w-full px-6 pt-6 pb-6 rounded-2xl border border-slate-800"
          style={{
            background: "rgba(2,6,23,0.85)",
            boxShadow: "0 24px 50px rgba(0,0,0,0.75)",
          }}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-200/95">
              <Gift className="h-6 w-6" strokeWidth={2} />
              <h2 className="text-xl font-bold tracking-tight">
                Привет, {displayName}!
              </h2>
            </div>
            <p className="text-slate-300/95 text-[15px] leading-snug max-w-[340px]">
              Чтобы тебе было интересно играть — мы дарим тебе подарок. Трать
              его в игре и получай удовольствие от общения с людьми по всему миру.
            </p>

            {/* Карточки призов — как блоки в боковом меню */}
            <div className="flex gap-4 w-full justify-center">
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl px-6 py-4 min-w-[120px] border border-slate-600/80"
                style={{
                  background: "rgba(15,23,42,0.9)",
                }}
              >
                <Heart
                  className="h-10 w-10 text-rose-400"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <span className="text-2xl font-black text-rose-300 tabular-nums">500</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  сердец
                </span>
              </div>
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl px-6 py-4 min-w-[120px] border border-slate-600/80"
                style={{
                  background: "rgba(15,23,42,0.9)",
                }}
              >
                <Flower2
                  className="h-10 w-10 text-rose-400"
                  strokeWidth={2}
                />
                <span className="text-2xl font-black text-rose-300 tabular-nums">10</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  роз
                </span>
              </div>
            </div>

            <Button
              onClick={() => {
                onClaim()
                onOpenChange(false)
              }}
              className="w-full rounded-xl py-3.5 text-base font-bold border border-emerald-600/80 bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                boxShadow: "0 2px 0 #065f46",
              }}
            >
              Забрать подарки
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
