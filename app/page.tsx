import { ClientBuildReload } from "@/components/client-build-reload"
import { GameApp } from "@/components/game-app"
import { GameProvider } from "@/lib/game-context"

/**
 * Не задаём `dynamic = "force-dynamic"`: при `output: "export"` (GitHub Pages) сборка падает,
 * а Next 16 не принимает условный `dynamic` (нужен литерал).
 * Свежий HTML на проде после деплоя: `Cache-Control: no-store` для `/` в next.config.mjs + пересборка на сервере.
 */
export default function Page() {
  return (
    <GameProvider>
      <ClientBuildReload />
      <main className="flex h-app min-h-0 w-full min-w-0 max-w-none flex-col overflow-x-hidden overflow-y-auto bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
