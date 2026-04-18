"use client"

import { useState } from "react"
import { Loader2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  initVkResilient,
  isVkMiniApp,
  joinVkCommunityGroup,
  openVkUrl,
  VK_COMMUNITY_PUBLIC_URL,
} from "@/lib/vk-bridge"

export function TechnicalMaintenanceScreen() {
  const [busy, setBusy] = useState(false)

  const handleSubscribe = async () => {
    if (busy) return
    setBusy(true)
    try {
      await initVkResilient()
      if (isVkMiniApp()) {
        await joinVkCommunityGroup()
      }
      await openVkUrl(VK_COMMUNITY_PUBLIC_URL)
    } catch {
      // ignore: button should remain harmless if VK API temporarily fails
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto bg-[#0a0f18] px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      <div className="relative my-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/90 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.65)] sm:p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
          <Wrench className="h-4 w-4" aria-hidden />
          ТЕХ работы
        </div>

        <div className="mb-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <img
            src="/assets/maintenance-kruti-znakomsya.png"
            alt="Крути и Знакомься — идут технические работы"
            className="mx-auto block h-auto w-full max-h-[min(62vh,620px)] object-contain object-center"
            draggable={false}
          />
        </div>

        <p className="text-base font-semibold leading-snug text-white">
          У нас техническое обновление бутылочки. Скоро все заработает. Будь в курсе событий.
        </p>

        <Button
          type="button"
          disabled={busy}
          onClick={() => void handleSubscribe()}
          className="mt-5 h-11 w-full rounded-2xl border border-cyan-400/45 bg-gradient-to-r from-cyan-600 via-cyan-500 to-sky-500 text-sm font-semibold text-white hover:from-cyan-500 hover:via-cyan-400 hover:to-sky-400 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Открываем VK...
            </>
          ) : (
            "Подписаться на группу VK"
          )}
        </Button>
      </div>
    </div>
  )
}
