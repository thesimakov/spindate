"use client"

import { GameProvider } from "@/lib/game-context"
import { GameApp } from "@/components/game-app"

export default function Page() {
  return (
    <GameProvider>
      <main className="flex h-app min-h-0 w-full min-w-0 max-w-none flex-col overflow-x-hidden overflow-y-auto bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
