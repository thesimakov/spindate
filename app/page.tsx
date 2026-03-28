"use client"

import { GameProvider } from "@/lib/game-context"
import { GameApp } from "@/components/game-app"

export default function Page() {
  return (
    <GameProvider>
      <main className="min-h-app w-full min-w-0 max-w-none overflow-y-auto overflow-x-hidden bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
