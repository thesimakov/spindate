"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Heart, Gift, Sparkles } from "lucide-react"

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
        overlayClassName="backdrop-blur-xl bg-black/60"
        className="p-0 overflow-hidden border-0 max-w-[460px] w-[calc(100%-2rem)] bg-transparent shadow-none"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Анимированный градиентный фон */}
        <div
          className="w-full px-6 pt-8 pb-8 rounded-3xl border-2 border-amber-400/30 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 50%, rgba(15,23,42,0.95) 100%)",
            boxShadow: "0 0 60px rgba(245,158,11,0.25), 0 24px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Декоративные световые элементы */}
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-rose-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="flex flex-col items-center gap-6 text-center relative z-10">
            {/* Заголовок с иконкой подарка */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-400/30 via-rose-400/30 to-amber-400/30 blur-xl animate-pulse" />
              <div
                className="relative flex items-center justify-center w-16 h-16 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #f43f5e 50%, #8b5cf6 100%)",
                  boxShadow: "0 8px 32px rgba(245,158,11,0.5), inset 0 2px 4px rgba(255,255,255,0.3)",
                }}
              >
                <Gift className="h-8 w-8 text-white" strokeWidth={2} />
              </div>
            </div>

            <div className="space-y-2">
              <h2
                className="text-2xl font-black tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #fbbf24 0%, #f43f5e 50%, #a855f7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                }}
              >
                Привет, {displayName}!
              </h2>
              <p className="text-slate-300/95 text-[15px] leading-relaxed max-w-[340px]">
                Чтобы тебе было интересно играть — мы дарим тебе подарок! 🎉
                <br />
                <span className="text-amber-300/90">Трать его в игре</span> и получай удовольствие от общения с людьми по всему миру.
              </p>
            </div>

            {/* Карточка приза — яркая с анимацией */}
            <div className="relative">
              {/* Glow-эффект позади */}
              <div
                className="absolute -inset-3 rounded-3xl blur-xl opacity-60 animate-pulse"
                style={{
                  background: "linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%)",
                  animationDuration: "2s",
                }}
              />
              <div
                className="relative flex flex-col items-center gap-2 rounded-3xl px-10 py-6 min-w-[160px] border-2"
                style={{
                  background: "linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                  borderColor: "rgba(244,63,94,0.4)",
                  boxShadow: "0 8px 32px rgba(244,63,94,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {/* Пульсирующее сердечко */}
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-rose-500/40 blur-lg animate-ping" style={{ animationDuration: "2s" }} />
                  <Heart
                    className="relative h-14 w-14 text-rose-400 animate-pulse"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth={1}
                    style={{
                      filter: "drop-shadow(0 0 20px rgba(244,63,94,0.8)) drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                    }}
                  />
                </div>
                <span
                  className="text-4xl font-black tabular-nums"
                  style={{
                    background: "linear-gradient(135deg, #fda4af 0%, #f43f5e 50%, #e11d48 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                  }}
                >
                  150
                </span>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-rose-200/90 uppercase tracking-wider">
                    сердец
                  </span>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
              </div>
            </div>

            {/* Кнопка с градиентом и свечением */}
            <Button
              onClick={() => {
                onClaim()
                onOpenChange(false)
              }}
              className="w-full relative overflow-hidden rounded-2xl py-4 text-lg font-black text-white border-0 transition-all hover:scale-[1.03] active:scale-[0.98] group"
              style={{
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 25%, #15803d 50%, #16a34a 75%, #22c55e 100%)",
                backgroundSize: "200% 200%",
                boxShadow: "0 8px 32px rgba(34,197,94,0.5), 0 4px 0 #14532d, inset 0 1px 0 rgba(255,255,255,0.2)",
                animation: "gradientShift 3s ease infinite",
              }}
            >
              {/* Блик на кнопке */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-2">
                <Gift className="h-5 w-5" />
                Забрать подарок
                <Heart className="h-5 w-5 fill-white" />
              </span>
            </Button>

            <p className="text-xs text-slate-500/80">
              Подарок доступен только при первом входе
            </p>
          </div>
        </div>
      </DialogContent>

      <style jsx global>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </Dialog>
  )
}
