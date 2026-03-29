import { GameProvider } from "@/lib/game-context"
import { GameApp } from "@/components/game-app"

/**
 * Не задаём `dynamic = "force-dynamic"`: при `output: "export"` (GitHub Pages) сборка падает,
 * а Next 16 не принимает условный `dynamic` (нужен литерал).
 * Свежий HTML на проде после деплоя: `Cache-Control: no-store` для `/` в next.config.mjs + пересборка на сервере.
 */
export default function Page() {
  return (
    <GameProvider>
      <main className="flex h-app min-h-0 w-full min-w-0 max-w-none flex-col overflow-x-hidden overflow-y-auto bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
