"use client"

import { useMemo } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type DayStatus = "claimed" | "available" | "locked"

export interface DailyBonusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  day: number // 1..5
  claimedToday: boolean
  onClaim: () => void
}

const DAYS = [1, 2, 3, 4, 5] as const

function clampDay(day: number) {
  if (day < 1) return 1
  if (day > 5) return 5
  return day
}

export function DailyBonusDialog({
  open,
  onOpenChange,
  day,
  claimedToday,
  onClaim,
}: DailyBonusDialogProps) {
  const d = clampDay(day)
  const canDismiss = claimedToday

  const statuses = useMemo(() => {
    const next: Record<number, DayStatus> = {}
    for (const x of DAYS) {
      if (x < d) next[x] = "claimed"
      else if (x === d) next[x] = claimedToday ? "claimed" : "available"
      else next[x] = "locked"
    }
    return next
  }, [d, claimedToday])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !canDismiss) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden border-0 max-w-[760px]"
        onEscapeKeyDown={(e) => {
          if (!canDismiss) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (!canDismiss) e.preventDefault()
        }}
      >
        <div
          className="w-full"
          style={{
            background:
              "linear-gradient(180deg, #d6f6a6 0%, #bff07a 25%, #a5e65c 50%, #94db4c 100%)",
          }}
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="text-white text-2xl font-extrabold drop-shadow">
              {"Ежедневный бонус"}
            </div>
            <div className="mt-3 text-black text-2xl font-extrabold leading-tight">
              {"Получи свой бонус сердечек за сегодня!"}
            </div>
            <div className="mt-1 text-black text-xl font-extrabold leading-tight">
              {"Заходи каждый день, чтобы получать больше!"}
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="mx-auto max-w-[560px] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {DAYS.slice(0, 4).map((x) => (
                  <DayRow key={x} day={x} status={statuses[x]} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DayRow day={5} status={statuses[5]} />
                <div />
              </div>

              <div className="pt-4 flex justify-center">
                <Button
                  onClick={onClaim}
                  disabled={claimedToday}
                  className="rounded-xl px-10 py-6 text-xl font-extrabold"
                  style={{
                    background: claimedToday ? "#9ca3af" : "#8fd14a",
                    color: "#ffffff",
                  }}
                >
                  {claimedToday ? "Получено" : "Получить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DayRow({ day, status }: { day: number; status: DayStatus }) {
  const isActive = status === "available"
  const isClaimed = status === "claimed"

  return (
    <div
      className="flex items-center justify-between rounded-2xl px-5 py-4"
      style={{
        background: isActive
          ? "rgba(255,255,255,0.35)"
          : "rgba(255,255,255,0.55)",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center"
          style={{
            background: isClaimed ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.9)",
          }}
        >
          {isClaimed ? (
            <span className="text-green-600 font-black text-xl">{"✓"}</span>
          ) : (
            <span className="text-transparent">{"."}</span>
          )}
        </div>

        <div className="text-black text-2xl font-extrabold">
          {"день "}
          {day}
        </div>
      </div>

      <div className="relative">
        <div className="text-[44px] leading-none select-none">{"❤"}</div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: "translateY(-2px)" }}
        >
          <div className="text-white text-xl font-black drop-shadow">
            {day}
          </div>
        </div>
      </div>
    </div>
  )
}

