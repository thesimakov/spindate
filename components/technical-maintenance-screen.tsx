"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
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
    <div className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto bg-[#070b12] px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      {/* мягкий фон без лишних элементов сверху */}
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(56,189,248,0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(99,102,241,0.08), transparent 50%)",
        }}
      />
      <div className="relative my-auto w-full max-w-lg rounded-[1.75rem] border border-white/[0.08] bg-slate-950/80 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm sm:max-w-xl sm:p-6">
        <div className="mb-4 w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-slate-900/80 to-black/50 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.04]">
          <img
            src="/assets/maintenance-kruti-znakomsya.png"
            alt="Крути и Знакомься — идут технические работы"
            className="mx-auto block h-auto w-full max-h-[min(58vh,560px)] object-contain object-center"
            draggable={false}
          />
        </div>

        <p className="mx-auto max-w-md text-center text-[0.9375rem] leading-relaxed text-slate-200/95">
          У нас техническое обновление бутылочки. Скоро всё заработает. Будь в курсе событий.
        </p>

        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleSubscribe()}
            className="h-10 shrink-0 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-600/95 via-cyan-500 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(34,211,238,0.22)] hover:from-cyan-500 hover:via-cyan-400 hover:to-sky-400 disabled:opacity-60 sm:h-9 sm:px-4 sm:text-[0.8125rem]"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                Открываем VK...
              </>
            ) : (
              "Подписаться на группу VK"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
