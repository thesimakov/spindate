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
        className="p-0 overflow-hidden border-0 max-w-[420px] shadow-2xl shadow-amber-900/30"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div
          className="w-full px-6 pt-6 pb-6 rounded-2xl"
          style={{
            background:
              "linear-gradient(165deg, #fffbeb 0%, #fef3c7 25%, #fde68a 50%, #fcd34d 85%, #fbbf24 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 24px rgba(251,191,36,0.25)",
          }}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-900/90">
              <Gift className="h-6 w-6" strokeWidth={2} />
              <h2 className="text-xl font-bold tracking-tight">
                Привет, {displayName}!
              </h2>
            </div>
            <p className="text-slate-800 text-[15px] leading-snug max-w-[340px]">
              Чтобы тебе было интересно играть — мы дарим тебе подарок. Трать
              его в игре и получай удовольствие от общения с людьми по всему миру.
            </p>

            {/* Карточки призов — крупно и заметно */}
            <div className="flex gap-4 w-full justify-center">
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl px-6 py-4 min-w-[120px]"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  boxShadow: "0 2px 12px rgba(225,29,72,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
                  border: "2px solid rgba(225,29,72,0.35)",
                }}
              >
                <Heart
                  className="h-10 w-10 text-rose-500 drop-shadow-sm"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <span className="text-2xl font-black text-rose-600 tabular-nums">500</span>
                <span className="text-xs font-semibold text-rose-700/90 uppercase tracking-wide">
                  сердец
                </span>
              </div>
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl px-6 py-4 min-w-[120px]"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  boxShadow: "0 2px 12px rgba(190,18,60,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
                  border: "2px solid rgba(190,18,60,0.35)",
                }}
              >
                <Flower2
                  className="h-10 w-10 text-rose-600 drop-shadow-sm"
                  strokeWidth={2}
                />
                <span className="text-2xl font-black text-rose-700 tabular-nums">10</span>
                <span className="text-xs font-semibold text-rose-800/90 uppercase tracking-wide">
                  роз
                </span>
              </div>
            </div>

            <Button
              onClick={() => {
                onClaim()
                onOpenChange(false)
              }}
              className="w-full rounded-xl py-3.5 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(180deg, #16a34a 0%, #15803d 100%)",
                color: "white",
                border: "none",
                boxShadow: "0 4px 14px rgba(22,163,74,0.45)",
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
