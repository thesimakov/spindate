"use client"

import { useState } from "react"
import { Coins, Shield, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { vkBridge } from "@/lib/vk-bridge"

export function PaymentScreen() {
  const { dispatch } = useGame()
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      // Simulate VK payment wall connection
      const success = await vkBridge.showPaymentWall(0)
      if (success) {
        setConnected(true)
        setTimeout(() => {
          dispatch({ type: "SET_SCREEN", screen: "game" })
        }, 1000)
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center overflow-y-auto px-4 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <Coins className="h-8 w-8 text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground text-balance text-center">
            {"Подключите оплату"}
          </h2>
          <p className="text-sm text-muted-foreground text-center text-pretty">
            {"Для игры потребуются сердечки. Подключите способ оплаты для пополнения сердечек."}
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{"Безопасно"}</p>
                <p className="text-xs text-muted-foreground">{"Оплата через официальный VK Pay"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{"10 сердец"}</p>
                <p className="text-xs text-muted-foreground">{"Стоимость одного общения"}</p>
              </div>
            </div>
          </div>
        </div>

        {connected ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-primary animate-in zoom-in duration-300" />
            <p className="text-sm font-medium text-primary">{"Оплата подключена!"}</p>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded-xl py-6 text-base font-semibold"
            size="lg"
          >
            {loading ? "Подключение..." : "Оплачивать сердцами"}
          </Button>
        )}
      </div>
    </div>
  )
}
