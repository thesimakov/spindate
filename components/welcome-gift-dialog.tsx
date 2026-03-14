"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Heart, Flower2 } from "lucide-react"

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
        className="p-0 overflow-hidden border-0 max-w-[400px]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div
          className="w-full px-6 py-6"
          style={{
            background:
              "linear-gradient(180deg, #fef3c7 0%, #fde68a 30%, #fcd34d 60%, #fbbf24 100%)",
          }}
        >
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-800">
              Привет, {displayName}!
            </h2>
            <p className="text-slate-800 text-[15px] leading-snug">
              Чтобы тебе было интересно играть — мы дарим тебе{" "}
              <span className="font-semibold">500 сердец</span> и{" "}
              <span className="font-semibold">10 роз</span>. Ты можешь тратить
              их в нашей игре и получать удовольствие от общения с людьми по
              всему миру.
            </p>
            <div className="flex justify-center gap-4 text-slate-700 text-sm">
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4 fill-current" />
                500
              </span>
              <span className="flex items-center gap-1">
                <Flower2 className="h-4 w-4" />
                10 роз
              </span>
            </div>
            <Button
              onClick={() => {
                onClaim()
                onOpenChange(false)
              }}
              className="w-full rounded-xl py-3 font-semibold bg-slate-800 hover:bg-slate-900 text-white"
            >
              Забрать подарки
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
