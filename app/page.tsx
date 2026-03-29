import { GameProvider } from "@/lib/game-context"
import { GameApp } from "@/components/game-app"

/**
 * Главная не должна зависать в prerender-кэше между деплоями:
 * иначе браузер получает старый HTML со старыми хэшами /_next/static/*.
 */
export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <GameProvider>
      <main className="flex h-app min-h-0 w-full min-w-0 max-w-none flex-col overflow-x-hidden overflow-y-auto bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
